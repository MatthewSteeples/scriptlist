import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { EnglandImporterWorker } from "./england-importer/EnglandImporterWorker";
import {
	canonicalEnglandFixtureName,
	canonicalEnglandR2Key,
	type EnglandWorkerBindings,
} from "./england-importer/EnglandImportTypes";
export { EnglandImportDurableObject } from "./england-importer/EnglandImportDurableObject";

const app = new Hono<{ Bindings: EnglandWorkerBindings }>();

app.post("/api/england/import/canonical", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const summary = await importer.importCanonicalFixture();

		return c.json({
			fixture: canonicalEnglandFixtureName,
			...summary,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.post("/api/england/import/upload", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const body = c.req.raw.body;
	if (!body) {
		return c.json({ error: "Request body is empty." }, 400);
	}

	const sourceName = c.req.query("source") ?? "uploaded-csv";

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const summary = await importer.importCsvStream(body, sourceName);

		return c.json({
			...summary,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.put("/api/england/r2", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const body = c.req.raw.body;
	if (!body) {
		return c.json({ error: "Request body is empty." }, 400);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		await importer.storeCsvToR2(key, body);

		return c.json({
			key,
			sourceName: c.req.query("source") ?? canonicalEnglandFixtureName,
			status: "stored",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.post("/api/england/r2/fetch", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const sourceUrl = c.req.query("url");
	if (!sourceUrl) {
		return c.json({ error: "Missing required query param: url" }, 400);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const stored = await importer.storeCsvFromUrlToR2(sourceUrl, key);

		return c.json({
			status: "stored",
			...stored,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.post("/api/england/r2/fetch-zip", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const sourceUrl = c.req.query("url");
	if (!sourceUrl) {
		return c.json({ error: "Missing required query param: url" }, 400);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;
	const entry = c.req.query("entry") ?? undefined;

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const stored = await importer.storeCsvFromZipUrlToR2(sourceUrl, key, entry);

		return c.json({
			status: "stored",
			...stored,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.put("/api/england/r2/zip", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const body = c.req.raw.body;
	if (!body) {
		return c.json({ error: "Request body is empty." }, 400);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;
	const entryName = c.req.query("entry");

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const zipBytes = await c.req.raw.arrayBuffer();
		const stored = await importer.storeCsvFromZipToR2(zipBytes, key, entryName);

		return c.json({
			status: "stored",
			...stored,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.post("/api/england/import/r2", async (c) => {
	if (!c.env.DB || !c.env.CSV_BUCKET) {
		return c.json({ error: "DB or CSV_BUCKET binding is not configured." }, 500);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;
	const sourceName = c.req.query("source") ?? canonicalEnglandFixtureName;

	try {
		const importer = new EnglandImporterWorker(c.env.DB, c.env.CSV_BUCKET);
		const summary = await importer.importCsvFromR2(key, sourceName);

		return c.json({
			key,
			...summary,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.post("/api/england/import/r2/durable/start", async (c) => {
	if (!c.env.IMPORT_ORCHESTRATOR) {
		return c.json({ error: "IMPORT_ORCHESTRATOR binding is not configured." }, 500);
	}

	const key = c.req.query("key") ?? canonicalEnglandR2Key;
	const sourceName = c.req.query("source") ?? canonicalEnglandFixtureName;
	const jobId = c.req.query("jobId") ?? crypto.randomUUID();

	try {
		const id = c.env.IMPORT_ORCHESTRATOR.idFromName(jobId);
		const stub = c.env.IMPORT_ORCHESTRATOR.get(id);
		const startUrl = new URL("https://do/start");
		startUrl.searchParams.set("key", key);
		startUrl.searchParams.set("source", sourceName);
		startUrl.searchParams.set("jobId", jobId);
		const response = await stub.fetch(startUrl.toString(), { method: "POST" });
		const body = await response.text();
		return new Response(body, {
			status: response.status,
			headers: { "content-type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.get("/api/england/import/r2/durable/status", async (c) => {
	if (!c.env.IMPORT_ORCHESTRATOR) {
		return c.json({ error: "IMPORT_ORCHESTRATOR binding is not configured." }, 500);
	}

	const jobId = c.req.query("jobId");
	if (!jobId) {
		return c.json({ error: "Missing required query param: jobId" }, 400);
	}

	try {
		const fetchStatus = async (id: DurableObjectId): Promise<Response> => {
			const stub = c.env.IMPORT_ORCHESTRATOR.get(id);
			return stub.fetch("https://do/status");
		};

		let response = await fetchStatus(c.env.IMPORT_ORCHESTRATOR.idFromName(jobId));
		if (response.status === 404) {
			try {
				response = await fetchStatus(c.env.IMPORT_ORCHESTRATOR.idFromString(jobId));
			} catch {
				// keep original 404 response
			}
		}
		const body = await response.text();
		return new Response(body, {
			status: response.status,
			headers: { "content-type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: message }, 500);
	}
});

app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default app;
