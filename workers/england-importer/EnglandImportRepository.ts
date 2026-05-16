import type { EnglandBnfItem, EnglandPractice, EnglandPrescriptionItem, EnglandImportSummary } from "./EnglandImportTypes";

export class EnglandImportRepository {
	constructor(private readonly db: D1Database) {}

	async createImportRun(run: {
		id: string;
		sourceName: string;
		startedAt: string;
		status: EnglandImportSummary["status"] | "running";
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO import_runs (
					id, source_name, started_at, status
				) VALUES (?, ?, ?, ?)`,
			)
			.bind(run.id, run.sourceName, run.startedAt, run.status)
			.run();
	}

	async finishImportRun(run: {
		id: string;
		completedAt: string;
		status: EnglandImportSummary["status"];
		rawRowCount: number;
		prescribedItemCount: number;
		practiceCount: number;
		bnfItemCount: number;
		periodCount: number;
		errorSummary?: string | null;
	}): Promise<void> {
		await this.db
			.prepare(
				`UPDATE import_runs
				 SET completed_at = ?, status = ?, raw_row_count = ?, prescribed_item_count = ?, practice_count = ?, bnf_item_count = ?, period_count = ?, error_summary = ?
				 WHERE id = ?`,
			)
			.bind(
				run.completedAt,
				run.status,
				run.rawRowCount,
				run.prescribedItemCount,
				run.practiceCount,
				run.bnfItemCount,
				run.periodCount,
				run.errorSummary ?? null,
				run.id,
			)
			.run();
	}

	async savePrescribedItems(items: readonly EnglandPrescriptionItem[], batchSize = 500): Promise<void> {
		await this.saveInBatches(items, batchSize, (item) =>
			this.db
				.prepare(
					`INSERT INTO prescribed_items (
						import_run_id, row_number, practice_code, bnf_code, bnf_description, items, nic_pence, actual_cost_pence, quantity, total_quantity, period_end_date, data_originator
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(import_run_id, row_number) DO UPDATE SET
						practice_code = excluded.practice_code,
						bnf_code = excluded.bnf_code,
						bnf_description = excluded.bnf_description,
						items = excluded.items,
						nic_pence = excluded.nic_pence,
						actual_cost_pence = excluded.actual_cost_pence,
						quantity = excluded.quantity,
						total_quantity = excluded.total_quantity,
						period_end_date = excluded.period_end_date,
						data_originator = excluded.data_originator`,
				)
				.bind(
					item.importRunId,
					item.rowNumber,
					item.practiceCode,
					item.bnfCode,
					item.bnfDescription,
					item.items,
					item.nicPence,
					item.actualCostPence,
					item.quantity,
					item.totalQuantity,
					item.periodEndDate,
					item.dataOriginator,
				),
		);
	}

	async savePractices(practices: readonly EnglandPractice[], batchSize = 500): Promise<void> {
		await this.saveInBatches(practices, batchSize, (practice) =>
			this.db
				.prepare(
					`INSERT INTO practices (code, name, addr1, addr2, addr3, addr4, addr5)
					 VALUES (?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(code) DO UPDATE SET
						name = excluded.name,
						addr1 = excluded.addr1,
						addr2 = excluded.addr2,
						addr3 = excluded.addr3,
						addr4 = excluded.addr4,
						addr5 = excluded.addr5`,
				)
				.bind(practice.code, practice.name, practice.addr1, practice.addr2, practice.addr3, practice.addr4, practice.addr5),
		);
	}

	async saveBnfItems(items: readonly EnglandBnfItem[], batchSize = 500): Promise<void> {
		await this.saveInBatches(items, batchSize, (item) =>
			this.db
				.prepare(
					`INSERT INTO bnf_items (code, name)
					 VALUES (?, ?)
					 ON CONFLICT(code, name) DO NOTHING`,
				)
				.bind(item.code, item.name),
		);
	}

	async savePeriods(periods: readonly string[], dataOriginator = "NhsEngland", batchSize = 500): Promise<void> {
		await this.saveInBatches(periods, batchSize, (periodEndDate) =>
			this.db
				.prepare(
					`INSERT INTO periods (period_end_date, data_originator)
					 VALUES (?, ?)
					 ON CONFLICT(period_end_date) DO UPDATE SET
						data_originator = excluded.data_originator`,
				)
				.bind(periodEndDate, dataOriginator),
		);
	}

	async saveImportError(run: {
		importRunId: string;
		rowNumber?: number | null;
		message: string;
		rawRow?: string | null;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO import_errors (import_run_id, row_number, message, raw_row)
				 VALUES (?, ?, ?, ?)`,
			)
			.bind(run.importRunId, run.rowNumber ?? null, run.message, run.rawRow ?? null)
			.run();
	}

	async readTableCounts(): Promise<{
		prescribedItems: number;
		practices: number;
		bnfItems: number;
		periods: number;
	}> {
		const [prescribedItems, practices, bnfItems, periods] = await Promise.all([
			this.countRows("prescribed_items"),
			this.countRows("practices"),
			this.countRows("bnf_items"),
			this.countRows("periods"),
		]);

		return {
			prescribedItems,
			practices,
			bnfItems,
			periods,
		};
	}

	private async countRows(tableName: string): Promise<number> {
		const result = await this.db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).all<{ count: number }>();
		return Number(result.results[0]?.count ?? 0);
	}

	async readRunCounts(importRunId: string): Promise<{
		prescribedItemCount: number;
		practiceCount: number;
		bnfItemCount: number;
		periodCount: number;
	}> {
		const result = await this.db
			.prepare(
				`SELECT
					COUNT(*) AS prescribed_item_count,
					COUNT(DISTINCT practice_code) AS practice_count,
					COUNT(DISTINCT bnf_code || char(0) || bnf_description) AS bnf_item_count,
					COUNT(DISTINCT period_end_date) AS period_count
				 FROM prescribed_items
				 WHERE import_run_id = ?`,
			)
			.bind(importRunId)
			.all<{
				prescribed_item_count: number;
				practice_count: number;
				bnf_item_count: number;
				period_count: number;
			}>();

		const row = result.results[0];
		return {
			prescribedItemCount: Number(row?.prescribed_item_count ?? 0),
			practiceCount: Number(row?.practice_count ?? 0),
			bnfItemCount: Number(row?.bnf_item_count ?? 0),
			periodCount: Number(row?.period_count ?? 0),
		};
	}

	private async saveInBatches<T>(
		items: readonly T[],
		batchSize: number,
		buildStatement: (item: T) => D1PreparedStatement,
	): Promise<void> {
		for (let index = 0; index < items.length; index += batchSize) {
			const batch = items.slice(index, index + batchSize).map(buildStatement);
			if (batch.length > 0) {
				await this.db.batch(batch);
			}
		}
	}
}
