import { EnglandImportAccumulator } from "./EnglandImportAccumulator";
import { EnglandImportRepository } from "./EnglandImportRepository";
import { strFromU8, Unzip, unzipSync, UnzipInflate, UnzipPassThrough } from "fflate/browser";
import {
	canonicalEnglandFixtureName,
	canonicalEnglandR2Key,
	type EnglandImportSummary,
} from "./EnglandImportTypes";
import { mapEnglandRow, parseEnglandCsv, parseEnglandCsvLine, validateEnglandHeaders } from "./EnglandRowMapper";

export class EnglandImporterWorker {
	constructor(
		private readonly db: D1Database,
		private readonly csvBucket: R2Bucket,
	) {}

	async importCanonicalFixture(): Promise<EnglandImportSummary> {
		return this.importCsvFromR2(canonicalEnglandR2Key, canonicalEnglandFixtureName);
	}

	async storeCsvToR2(
		key: string,
		body: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | string | Blob,
		contentType = "text/csv; charset=utf-8",
	): Promise<void> {
		await this.csvBucket.put(key, body, {
			httpMetadata: {
				contentType,
			},
		});
	}

	async storeCsvFromUrlToR2(url: string, key: string): Promise<{
		key: string;
		sourceUrl: string;
		contentType: string;
		contentLength: string | null;
	}> {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new Error(`Only http/https URLs are supported: ${url}`);
		}

		const response = await fetch(parsed.toString(), {
			method: "GET",
			redirect: "follow",
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch source URL (${response.status} ${response.statusText}): ${url}`);
		}

		if (!response.body) {
			throw new Error(`Source URL returned an empty body: ${url}`);
		}

		const contentType = response.headers.get("content-type") ?? "text/csv; charset=utf-8";
		await this.storeCsvToR2(key, response.body, contentType);

		return {
			key,
			sourceUrl: parsed.toString(),
			contentType,
			contentLength: response.headers.get("content-length"),
		};
	}

	async storeCsvFromZipUrlToR2(
		url: string,
		key: string,
		entryNameHint?: string,
	): Promise<{
		key: string;
		sourceUrl: string;
		entryName: string;
		contentType: string;
		contentLength: string | null;
	}> {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new Error(`Only http/https URLs are supported: ${url}`);
		}

		const response = await fetch(parsed.toString(), {
			method: "GET",
			redirect: "follow",
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch source URL (${response.status} ${response.statusText}): ${url}`);
		}

		if (!response.body) {
			throw new Error(`Source URL returned an empty body: ${url}`);
		}

		const reader = response.body.getReader();
		const transform = new TransformStream<Uint8Array, Uint8Array>();
		const writer = transform.writable.getWriter();
		const unzip = new Unzip();
		unzip.register(UnzipInflate);
		unzip.register(UnzipPassThrough);

		const contentType = "text/csv; charset=utf-8";
		const hint = entryNameHint?.trim().toLowerCase();

		let selectedEntryName: string | null = null;
		let sawCsvEntry = false;
		let selectedEntryCompleted = false;
		let finalized = false;
		let extractionError: unknown = null;
		let putPromise: Promise<R2Object> | null = null;
		let writeChain: Promise<void> = Promise.resolve();

		const fail = (error: unknown): never => {
			if (!finalized) {
				finalized = true;
				extractionError = error;
				void writer.abort(error);
			}
			throw error instanceof Error ? error : new Error(String(error));
		};

		unzip.onfile = (file) => {
			const fileName = file.name.replace(/\\/g, "/");
			const fileNameLower = fileName.toLowerCase();
			const isCsv = fileNameLower.endsWith(".csv");

			if (!isCsv) {
				file.ondata = (err) => {
					if (err && !finalized) {
						finalized = true;
						extractionError = err;
						void writer.abort(err);
					}
				};
				file.start();
				return;
			}

			sawCsvEntry = true;

			const shouldSelect = hint
				? fileNameLower === hint || fileNameLower.endsWith(`/${hint}`)
				: selectedEntryName === null;

			if (!shouldSelect || selectedEntryName !== null) {
				file.ondata = (err) => {
					if (err && !finalized) {
						finalized = true;
						extractionError = err;
						void writer.abort(err);
					}
				};
				file.start();
				return;
			}

			selectedEntryName = fileName;
			putPromise = this.csvBucket.put(key, transform.readable, {
				httpMetadata: { contentType },
			});

			file.ondata = (err, chunk, final) => {
				if (err || finalized) {
					if (!finalized) {
						finalized = true;
						extractionError = err ?? new Error("ZIP extraction failed.");
						void writer.abort(err ?? new Error("ZIP extraction failed."));
					}
					return;
				}

				if (chunk && chunk.length > 0) {
					writeChain = writeChain.then(() => writer.write(chunk));
				}

				if (final) {
					selectedEntryCompleted = true;
					writeChain = writeChain.then(() => writer.close());
				}
			};

			file.start();
		};

		while (true) {
			const { value, done } = await reader.read();
			try {
				unzip.push(value ?? new Uint8Array(), done);
			} catch (error) {
				fail(error);
			}

			if (done) {
				break;
			}
		}

		if (extractionError) {
			fail(extractionError);
		}

		if (!sawCsvEntry) {
			fail(new Error("ZIP stream does not contain any CSV entries."));
		}

		if (selectedEntryName === null) {
			throw new Error(`CSV entry not found in ZIP stream: ${entryNameHint}`);
		}
		const finalizedEntryName: string = selectedEntryName;

		await writeChain;

		if (!selectedEntryCompleted) {
			fail(new Error(`CSV entry did not complete extraction: ${finalizedEntryName}`));
		}

		if (!putPromise) {
			fail(new Error("R2 upload did not start for selected CSV entry."));
		}

		await putPromise;

		return {
			key,
			sourceUrl: parsed.toString(),
			entryName: finalizedEntryName,
			contentType,
			contentLength: response.headers.get("content-length"),
		};
	}

	async storeCsvFromZipToR2(
		zipFile: ArrayBuffer,
		key: string,
		entryNameHint?: string,
	): Promise<{
		key: string;
		entryName: string;
		contentType: string;
	}> {
		const archive = unzipSync(new Uint8Array(zipFile));
		const entryNames = Object.keys(archive);

		const csvEntries = entryNames.filter((name) => name.toLowerCase().endsWith(".csv"));
		if (csvEntries.length === 0) {
			throw new Error("ZIP file does not contain any CSV entries.");
		}

		const hint = entryNameHint?.trim();
		let selectedName: string | undefined;

		if (hint) {
			selectedName = csvEntries.find((name) => name.toLowerCase() === hint.toLowerCase());
			if (!selectedName) {
				throw new Error(`CSV entry not found in ZIP: ${hint}`);
			}
		} else {
			selectedName = csvEntries.find((name) => /^epd/i.test(name.split("/").at(-1) ?? name)) ?? csvEntries[0];
		}

		const csvBytes = archive[selectedName];
		const csvText = strFromU8(csvBytes);
		const contentType = "text/csv; charset=utf-8";

		await this.storeCsvToR2(key, csvText, contentType);

		return {
			key,
			entryName: selectedName,
			contentType,
		};
	}

	async importCsvFromR2(key: string, sourceName: string): Promise<EnglandImportSummary> {
		const object = await this.csvBucket.get(key);

		if (!object?.body) {
			throw new Error(`CSV object not found in R2: ${key}`);
		}

		return this.importCsvStream(object.body, sourceName);
	}

	async importCsv(csvText: string, sourceName: string): Promise<EnglandImportSummary> {
		const repository = new EnglandImportRepository(this.db);
		const importRunId = crypto.randomUUID();
		const startedAt = new Date().toISOString();
		const startedAtMs = Date.now();
		const batchSize = 500;

		await repository.createImportRun({
			id: importRunId,
			sourceName,
			startedAt,
			status: "running",
		});

		let rows: ReturnType<typeof parseEnglandCsv> = [];
		const accumulator = new EnglandImportAccumulator();
		const prescribedBatch: ReturnType<typeof mapEnglandRow>[] = [];

		try {
			rows = parseEnglandCsv(csvText);

			for (let rowNumber = 0; rowNumber < rows.length; rowNumber += 1) {
				const mapped = mapEnglandRow(rows[rowNumber], rowNumber, importRunId);
				accumulator.record(mapped);
				prescribedBatch.push(mapped);

				if (prescribedBatch.length >= batchSize) {
					await repository.savePrescribedItems(prescribedBatch.map((entry) => entry.prescribedItem), batchSize);
					prescribedBatch.length = 0;
				}
			}

			if (prescribedBatch.length > 0) {
				await repository.savePrescribedItems(prescribedBatch.map((entry) => entry.prescribedItem), batchSize);
			}

			await repository.savePractices(accumulator.practiceList);
			await repository.saveBnfItems(accumulator.bnfList);
			await repository.savePeriods(accumulator.periodList);

			const completedAt = new Date().toISOString();
			const storedCounts = await repository.readTableCounts();

			const summary: EnglandImportSummary = {
				importRunId,
				sourceName,
				startedAt,
				completedAt,
				elapsedMs: Date.now() - startedAtMs,
				status: "completed",
				rawRowCount: rows.length,
				prescribedItemCount: accumulator.prescribedCount,
				practiceCount: accumulator.practiceList.length,
				bnfItemCount: accumulator.bnfList.length,
				periodCount: accumulator.periodList.length,
				storedCounts,
			};

			await repository.finishImportRun({
				id: importRunId,
				completedAt,
				status: summary.status,
				rawRowCount: summary.rawRowCount,
				prescribedItemCount: summary.prescribedItemCount,
				practiceCount: summary.practiceCount,
				bnfItemCount: summary.bnfItemCount,
				periodCount: summary.periodCount,
			});

			return summary;
		} catch (error) {
			const completedAt = new Date().toISOString();
			const message = error instanceof Error ? error.message : String(error);

			await repository.saveImportError({
				importRunId,
				rowNumber: rows.length > 0 ? rows.length - 1 : null,
				message,
				rawRow: null,
			});
			await repository.finishImportRun({
				id: importRunId,
				completedAt,
				status: "failed",
				rawRowCount: rows.length,
				prescribedItemCount: accumulator.prescribedCount,
				practiceCount: accumulator.practiceList.length,
				bnfItemCount: accumulator.bnfList.length,
				periodCount: accumulator.periodList.length,
				errorSummary: message,
			});

			throw error;
		}
	}

	async importCsvStream(csvBody: ReadableStream<Uint8Array>, sourceName: string): Promise<EnglandImportSummary> {
		const repository = new EnglandImportRepository(this.db);
		const importRunId = crypto.randomUUID();
		const startedAt = new Date().toISOString();
		const startedAtMs = Date.now();
		const decoder = new TextDecoder();
		const reader = csvBody.getReader();
		let buffer = "";
		let resolvedHeaderIndex: ReturnType<typeof validateEnglandHeaders> | null = null;
		let rawRowCount = 0;
		let currentRowNumber = 0;
		const accumulator = new EnglandImportAccumulator();
		const prescribedBatch: ReturnType<typeof mapEnglandRow>[] = [];
		const batchSize = 500;

		await repository.createImportRun({
			id: importRunId,
			sourceName,
			startedAt,
			status: "running",
		});

		const flushBatch = async (): Promise<void> => {
			if (prescribedBatch.length === 0) {
				return;
			}

			await repository.savePrescribedItems(prescribedBatch.map((entry) => entry.prescribedItem), batchSize);
			prescribedBatch.length = 0;
		};

		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) {
					buffer += decoder.decode();
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				let newlineIndex = buffer.indexOf("\n");
				while (newlineIndex >= 0) {
					const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
					buffer = buffer.slice(newlineIndex + 1);
					newlineIndex = buffer.indexOf("\n");

					if (line.length === 0) {
						continue;
					}

					if (resolvedHeaderIndex === null) {
						const headers = parseEnglandCsvLine(line);
						resolvedHeaderIndex = validateEnglandHeaders(headers);
						continue;
					}

					rawRowCount += 1;
					const row = mapEnglandRow(
						rowFromResolvedHeaderIndex(parseEnglandCsvLine(line), resolvedHeaderIndex),
						currentRowNumber,
						importRunId,
					);
					currentRowNumber += 1;
					accumulator.record(row);
					prescribedBatch.push(row);

					if (prescribedBatch.length >= batchSize) {
						await flushBatch();
					}
				}
			}

			if (buffer.length > 0) {
				const line = buffer.replace(/\r$/, "");
				if (line.length > 0) {
					if (resolvedHeaderIndex === null) {
						const headers = parseEnglandCsvLine(line);
						resolvedHeaderIndex = validateEnglandHeaders(headers);
					} else {
						rawRowCount += 1;
						const row = mapEnglandRow(
							rowFromResolvedHeaderIndex(parseEnglandCsvLine(line), resolvedHeaderIndex),
							currentRowNumber,
							importRunId,
						);
						currentRowNumber += 1;
						accumulator.record(row);
						prescribedBatch.push(row);
					}
				}
			}

			await flushBatch();
			await repository.savePractices(accumulator.practiceList);
			await repository.saveBnfItems(accumulator.bnfList);
			await repository.savePeriods(accumulator.periodList);

			const completedAt = new Date().toISOString();
			const storedCounts = await repository.readTableCounts();

			const summary: EnglandImportSummary = {
				importRunId,
				sourceName,
				startedAt,
				completedAt,
				elapsedMs: Date.now() - startedAtMs,
				status: "completed",
				rawRowCount,
				prescribedItemCount: accumulator.prescribedCount,
				practiceCount: accumulator.practiceList.length,
				bnfItemCount: accumulator.bnfList.length,
				periodCount: accumulator.periodList.length,
				storedCounts,
			};

			await repository.finishImportRun({
				id: importRunId,
				completedAt,
				status: summary.status,
				rawRowCount: summary.rawRowCount,
				prescribedItemCount: summary.prescribedItemCount,
				practiceCount: summary.practiceCount,
				bnfItemCount: summary.bnfItemCount,
				periodCount: summary.periodCount,
			});

			return summary;
		} catch (error) {
			const completedAt = new Date().toISOString();
			const message = error instanceof Error ? error.message : String(error);

			await repository.saveImportError({
				importRunId,
				rowNumber: currentRowNumber > 0 ? currentRowNumber - 1 : null,
				message,
				rawRow: null,
			});
			await repository.finishImportRun({
				id: importRunId,
				completedAt,
				status: "failed",
				rawRowCount,
				prescribedItemCount: accumulator.prescribedCount,
				practiceCount: accumulator.practiceList.length,
				bnfItemCount: accumulator.bnfList.length,
				periodCount: accumulator.periodList.length,
				errorSummary: message,
			});

			throw error;
		}
	}
}

function rowFromResolvedHeaderIndex(
	values: string[],
	resolvedHeaderIndex: ReturnType<typeof validateEnglandHeaders>,
): Record<string, string> {
	const row: Record<string, string> = {};
	for (const header of Object.keys(resolvedHeaderIndex)) {
		const key = header as keyof typeof resolvedHeaderIndex;
		row[header] = values[resolvedHeaderIndex[key]] ?? "";
	}
	return row;
}
