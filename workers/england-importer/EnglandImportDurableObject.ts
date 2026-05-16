import type {
	EnglandBnfItem,
	EnglandPractice,
	EnglandWorkerBindings,
	EnglandPrescriptionItem,
} from "./EnglandImportTypes";
import { EnglandImportRepository } from "./EnglandImportRepository";
import {
	type HeaderIndexMap,
	mapEnglandRow,
	parseEnglandCsvLine,
	rowFromResolvedHeaderIndex,
	validateEnglandHeaders,
} from "./EnglandRowMapper";

interface ImportCheckpoint {
	jobId: string;
	status: "pending" | "running" | "completed" | "failed";
	r2Key: string;
	sourceName: string;
	importRunId: string;
	startedAt: string;
	lastCheckpointAt?: string;
	completedAt?: string;
	errorSummary?: string;
	offset: number;
	totalSize: number | null;
	rowNumber: number;
	tailBase64: string;
	headerIndex: HeaderIndexMap | null;
}

const CHECKPOINT_KEY = "checkpoint";
const DEFAULT_CHUNK_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIME_BUDGET_MS = 90_000;
const DEFAULT_ROW_BUDGET = 500_000;
const PRESCRIBED_BATCH_SIZE = 500;

export class EnglandImportDurableObject {
	private readonly seenBnfItems = new Set<string>();
	private readonly practiceFingerprintByCode = new Map<string, string>();

	constructor(
		private readonly state: DurableObjectState,
		private readonly env: EnglandWorkerBindings,
	) {}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "POST" && url.pathname.endsWith("/start")) {
			return this.handleStart(url);
		}

		if (request.method === "GET" && url.pathname.endsWith("/status")) {
			return this.handleStatus();
		}

		if (request.method === "POST" && url.pathname.endsWith("/run")) {
			await this.processCheckpoint();
			return this.jsonResponse({ status: "ok" });
		}

		return this.jsonResponse({ error: "Not found" }, 404);
	}

	async alarm(): Promise<void> {
		await this.processCheckpoint();
	}

	private async handleStart(url: URL): Promise<Response> {
		const r2Key = url.searchParams.get("key");
		if (!r2Key) {
			return this.jsonResponse({ error: "Missing required query param: key" }, 400);
		}
		const requestedJobId = url.searchParams.get("jobId");
		if (!requestedJobId) {
			return this.jsonResponse({ error: "Missing required query param: jobId" }, 400);
		}

		const sourceName = url.searchParams.get("source") ?? r2Key.split("/").at(-1) ?? r2Key;
		const existing = await this.readCheckpoint();

		if (existing && (existing.status === "running" || existing.status === "pending")) {
			return this.jsonResponse(existing, 202);
		}

		const importRunId = crypto.randomUUID();
		const startedAt = new Date().toISOString();
		const checkpoint: ImportCheckpoint = {
			jobId: requestedJobId,
			status: "pending",
			r2Key,
			sourceName,
			importRunId,
			startedAt,
			offset: 0,
			totalSize: null,
			rowNumber: 0,
			tailBase64: "",
			headerIndex: null,
		};

		this.seenBnfItems.clear();
		this.practiceFingerprintByCode.clear();

		await this.writeCheckpoint(checkpoint);

		const repository = new EnglandImportRepository(this.env.DB);
		await repository.createImportRun({
			id: importRunId,
			sourceName,
			startedAt,
			status: "running",
		});

		await this.state.storage.setAlarm(Date.now() + 100);

		return this.jsonResponse(checkpoint, 202);
	}

	private async handleStatus(): Promise<Response> {
		const checkpoint = await this.readCheckpoint();
		if (!checkpoint) {
			return this.jsonResponse({ error: "No import job found for this Durable Object." }, 404);
		}
		return this.jsonResponse(checkpoint);
	}

	private async processCheckpoint(): Promise<void> {
		const repository = new EnglandImportRepository(this.env.DB);
		const checkpoint = await this.readCheckpoint();
		if (!checkpoint || checkpoint.status === "completed" || checkpoint.status === "failed") {
			return;
		}

		const startedAtMs = Date.now();
		checkpoint.status = "running";
		await this.writeCheckpoint(checkpoint);

		try {
			let continueProcessing = true;
			let rowsProcessedThisInvocation = 0;

			while (continueProcessing && Date.now() - startedAtMs < DEFAULT_TIME_BUDGET_MS) {
				const object = await this.env.CSV_BUCKET.get(checkpoint.r2Key, {
					range: { offset: checkpoint.offset, length: DEFAULT_CHUNK_BYTES },
				});
				if (!object?.body) {
					throw new Error(`CSV object not found in R2: ${checkpoint.r2Key}`);
				}

				checkpoint.totalSize = object.size;
				const chunkBytes = new Uint8Array(await object.arrayBuffer());
				const reachedEof = checkpoint.offset + chunkBytes.length >= object.size;

				const chunkState = this.processChunkLines(chunkBytes, checkpoint, reachedEof);
				checkpoint.offset += chunkBytes.length;
				checkpoint.rowNumber = chunkState.rowNumber;
				checkpoint.tailBase64 = chunkState.tailBase64;
				checkpoint.headerIndex = chunkState.headerIndex;

				await this.flushChunk(repository, chunkState.prescribedItems, chunkState.practices, chunkState.bnfItems, chunkState.periods);
				rowsProcessedThisInvocation += chunkState.prescribedItems.length;
				await this.writeCheckpoint(checkpoint);

				if (chunkBytes.length === 0 || reachedEof || rowsProcessedThisInvocation >= DEFAULT_ROW_BUDGET) {
					continueProcessing = false;
				}
			}

			if (checkpoint.totalSize !== null && checkpoint.offset >= checkpoint.totalSize) {
				const runCounts = await repository.readRunCounts(checkpoint.importRunId);
				const completedAt = new Date().toISOString();
				await repository.finishImportRun({
					id: checkpoint.importRunId,
					completedAt,
					status: "completed",
					rawRowCount: runCounts.prescribedItemCount,
					prescribedItemCount: runCounts.prescribedItemCount,
					practiceCount: runCounts.practiceCount,
					bnfItemCount: runCounts.bnfItemCount,
					periodCount: runCounts.periodCount,
				});

				checkpoint.status = "completed";
				checkpoint.completedAt = completedAt;
				await this.writeCheckpoint(checkpoint);
				return;
			}

			await this.state.storage.setAlarm(Date.now() + 250);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const completedAt = new Date().toISOString();

			await repository.saveImportError({
				importRunId: checkpoint.importRunId,
				rowNumber: checkpoint.rowNumber > 0 ? checkpoint.rowNumber - 1 : null,
				message,
				rawRow: null,
			});
			await repository.finishImportRun({
				id: checkpoint.importRunId,
				completedAt,
				status: "failed",
				rawRowCount: checkpoint.rowNumber,
				prescribedItemCount: checkpoint.rowNumber,
				practiceCount: 0,
				bnfItemCount: 0,
				periodCount: 0,
				errorSummary: message,
			});

			checkpoint.status = "failed";
			checkpoint.errorSummary = message;
			checkpoint.completedAt = completedAt;
			await this.writeCheckpoint(checkpoint);
		}
	}

	private processChunkLines(
		chunkBytes: Uint8Array,
		checkpoint: ImportCheckpoint,
		reachedEof: boolean,
	): {
		rowNumber: number;
		tailBase64: string;
		headerIndex: HeaderIndexMap | null;
		prescribedItems: EnglandPrescriptionItem[];
		practices: EnglandPractice[];
		bnfItems: EnglandBnfItem[];
		periods: string[];
	} {
		const decoder = new TextDecoder();
		const tail = base64ToBytes(checkpoint.tailBase64);
		const bytes = concatBytes(tail, chunkBytes);
		const practices = new Map<string, EnglandPractice>();
		const bnfItems = new Map<string, EnglandBnfItem>();
		const periods = new Set<string>();
		const prescribedItems: EnglandPrescriptionItem[] = [];

		let start = 0;
		let rowNumber = checkpoint.rowNumber;
		let headerIndex = checkpoint.headerIndex;

		for (let index = 0; index < bytes.length; index += 1) {
			if (bytes[index] !== 0x0a) {
				continue;
			}

			const lineBytes = bytes.subarray(start, index);
			start = index + 1;
			const line = decoder.decode(trimLineEnding(lineBytes));
			if (line.length === 0) {
				continue;
			}

			if (headerIndex === null) {
				const headerLine = line.replace(/^\uFEFF/, "");
				headerIndex = validateEnglandHeaders(parseEnglandCsvLine(headerLine));
				continue;
			}

			const mapped = mapEnglandRow(
				rowFromResolvedHeaderIndex(parseEnglandCsvLine(line), headerIndex),
				rowNumber,
				checkpoint.importRunId,
			);
			rowNumber += 1;
			prescribedItems.push(mapped.prescribedItem);
			practices.set(mapped.practice.code, mapped.practice);
			bnfItems.set(`${mapped.bnfItem.code}\u0000${mapped.bnfItem.name}`, mapped.bnfItem);
			periods.add(mapped.periodEndDate);
		}

		let tailBytes = bytes.subarray(start);
		if (reachedEof && tailBytes.length > 0) {
			const line = decoder.decode(trimLineEnding(tailBytes));
			if (line.length > 0) {
				if (headerIndex === null) {
					headerIndex = validateEnglandHeaders(parseEnglandCsvLine(line.replace(/^\uFEFF/, "")));
				} else {
					const mapped = mapEnglandRow(
						rowFromResolvedHeaderIndex(parseEnglandCsvLine(line), headerIndex),
						rowNumber,
						checkpoint.importRunId,
					);
					rowNumber += 1;
					prescribedItems.push(mapped.prescribedItem);
					practices.set(mapped.practice.code, mapped.practice);
					bnfItems.set(`${mapped.bnfItem.code}\u0000${mapped.bnfItem.name}`, mapped.bnfItem);
					periods.add(mapped.periodEndDate);
				}
			}
			tailBytes = new Uint8Array(0);
		}

		return {
			rowNumber,
			tailBase64: bytesToBase64(tailBytes),
			headerIndex,
			prescribedItems,
			practices: [...practices.values()],
			bnfItems: [...bnfItems.values()],
			periods: [...periods.values()],
		};
	}

	private async flushChunk(
		repository: EnglandImportRepository,
		prescribedItems: EnglandPrescriptionItem[],
		practices: EnglandPractice[],
		bnfItems: EnglandBnfItem[],
		periods: string[],
	): Promise<void> {
		if (prescribedItems.length > 0) {
			await repository.savePrescribedItems(prescribedItems, PRESCRIBED_BATCH_SIZE);
		}
		if (practices.length > 0) {
			const uncachedPractices = practices.filter((practice) => {
				const fingerprint = `${practice.name}\u0000${practice.addr1}\u0000${practice.addr2}\u0000${practice.addr3}\u0000${practice.addr4}\u0000${practice.addr5}`;
				const existing = this.practiceFingerprintByCode.get(practice.code);
				if (existing === fingerprint) {
					return false;
				}
				this.practiceFingerprintByCode.set(practice.code, fingerprint);
				return true;
			});
			if (uncachedPractices.length > 0) {
				await repository.savePractices(uncachedPractices);
			}
		}
		if (bnfItems.length > 0) {
			const uncachedBnfItems = bnfItems.filter((item) => {
				const key = `${item.code}\u0000${item.name}`;
				if (this.seenBnfItems.has(key)) {
					return false;
				}
				this.seenBnfItems.add(key);
				return true;
			});
			if (uncachedBnfItems.length > 0) {
				await repository.saveBnfItems(uncachedBnfItems);
			}
		}
		if (periods.length > 0) {
			await repository.savePeriods(periods);
		}
	}

	private async readCheckpoint(): Promise<ImportCheckpoint | null> {
		return (await this.state.storage.get<ImportCheckpoint>(CHECKPOINT_KEY)) ?? null;
	}

	private async writeCheckpoint(checkpoint: ImportCheckpoint): Promise<void> {
		checkpoint.lastCheckpointAt = new Date().toISOString();
		await this.state.storage.put(CHECKPOINT_KEY, checkpoint);
	}

	private jsonResponse(data: unknown, status = 200): Response {
		return new Response(JSON.stringify(data), {
			status,
			headers: { "content-type": "application/json" },
		});
	}
}

function trimLineEnding(lineBytes: Uint8Array): Uint8Array {
	if (lineBytes.length > 0 && lineBytes[lineBytes.length - 1] === 0x0d) {
		return lineBytes.subarray(0, lineBytes.length - 1);
	}
	return lineBytes;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
	if (a.length === 0) {
		return b;
	}
	if (b.length === 0) {
		return a;
	}

	const merged = new Uint8Array(a.length + b.length);
	merged.set(a, 0);
	merged.set(b, a.length);
	return merged;
}

function bytesToBase64(bytes: Uint8Array): string {
	if (bytes.length === 0) {
		return "";
	}
	let text = "";
	for (const byte of bytes) {
		text += String.fromCharCode(byte);
	}
	return btoa(text);
}

function base64ToBytes(value: string): Uint8Array {
	if (!value) {
		return new Uint8Array(0);
	}
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
