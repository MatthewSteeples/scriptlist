import { englandUnifiedRequiredHeaders, type EnglandBnfItem, type EnglandPractice, type EnglandPrescriptionItem } from "./EnglandImportTypes";
import { parseEnglandPeriodEndDate } from "./EnglandPeriodParser";

type CsvRow = Record<string, string>;
export type HeaderIndexMap = Record<(typeof englandUnifiedRequiredHeaders)[number], number>;

const headerAliases: Record<(typeof englandUnifiedRequiredHeaders)[number], readonly string[]> = {
	PRACTICE_CODE: ["PRACTICE_CODE"],
	BNF_CODE: ["BNF_CODE", "BNF_PRESENTATION_CODE"],
	BNF_DESCRIPTION: ["BNF_DESCRIPTION", "BNF_PRESENTATION_NAME"],
	ITEMS: ["ITEMS"],
	NIC: ["NIC"],
	ACTUAL_COST: ["ACTUAL_COST", "ACT COST"],
	QUANTITY: ["QUANTITY"],
	TOTAL_QUANTITY: ["TOTAL_QUANTITY"],
	YEAR_MONTH: ["YEAR_MONTH", "PERIOD"],
	PRACTICE_NAME: ["PRACTICE_NAME"],
	ADDRESS_1: ["ADDRESS_1"],
	ADDRESS_2: ["ADDRESS_2"],
	ADDRESS_3: ["ADDRESS_3"],
	ADDRESS_4: ["ADDRESS_4"],
	POSTCODE: ["POSTCODE"],
};

export interface EnglandMappedRow {
	prescribedItem: EnglandPrescriptionItem;
	practice: EnglandPractice;
	bnfItem: EnglandBnfItem;
	periodEndDate: string;
}

export function parseEnglandCsv(text: string): CsvRow[] {
	const normalizedText = text.replace(/^\uFEFF/, "");
	const rows = normalizedText
		.split(/\r?\n/)
		.filter((line) => line.length > 0)
		.map(parseEnglandCsvLine);

	if (rows.length === 0) {
		throw new Error("England CSV is empty.");
	}

	const [headerRow, ...dataRows] = rows;
	const resolvedHeaderIndex = validateEnglandHeaders(headerRow);


	return dataRows
		.filter((row) => row.some((value) => value.length > 0))
		.map((row) => {
			const record: CsvRow = {};
			for (const header of englandUnifiedRequiredHeaders) {
				const columnIndex = resolvedHeaderIndex[header];
				record[header] = row[columnIndex] ?? "";
			}
			return record;
		});
}

export function parseEnglandCsvLine(line: string): string[] {
	const fields: string[] = [];
	let currentField = "";
	let inQuotes = false;

	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		const nextChar = line[index + 1];

		if (inQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					currentField += '"';
					index += 1;
				} else {
					inQuotes = false;
				}
			} else {
				currentField += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}

		if (char === ",") {
			fields.push(currentField);
			currentField = "";
			continue;
		}

		currentField += char;
	}

	fields.push(currentField);
	return fields;
}

export function validateEnglandHeaders(headers: string[]): HeaderIndexMap {
	const headerIndex = new Map<string, number>();
	for (let index = 0; index < headers.length; index += 1) {
		headerIndex.set(headers[index], index);
	}

	const missing: string[] = [];
	const resolved = {} as HeaderIndexMap;

	for (const header of englandUnifiedRequiredHeaders) {
		const aliases = headerAliases[header];
		const matched = aliases.find((alias) => headerIndex.has(alias));
		if (!matched) {
			missing.push(header);
			continue;
		}

		const columnIndex = headerIndex.get(matched);
		if (columnIndex === undefined) {
			missing.push(header);
			continue;
		}

		resolved[header] = columnIndex;
	}

	if (missing.length > 0) {
		throw new Error(`England CSV is missing required headers: ${missing.join(", ")}`);
	}

	return resolved;
}

export function rowFromResolvedHeaderIndex(values: string[], resolvedHeaderIndex: HeaderIndexMap): CsvRow {
	const row: CsvRow = {};
	for (const header of englandUnifiedRequiredHeaders) {
		const columnIndex = resolvedHeaderIndex[header];
		row[header] = values[columnIndex] ?? "";
	}
	return row;
}

export function mapEnglandRow(row: CsvRow, rowNumber: number, importRunId: string): EnglandMappedRow {
	const practiceCode = requireField(row, "PRACTICE_CODE");
	const bnfCode = requireField(row, "BNF_CODE");
	const bnfDescription = requireField(row, "BNF_DESCRIPTION");
	const periodEndDate = parseEnglandPeriodEndDate(requireField(row, "YEAR_MONTH"));

	return {
		prescribedItem: {
			importRunId,
			rowNumber,
			practiceCode,
			bnfCode,
			bnfDescription,
			items: parseIntegerField(row, "ITEMS"),
			nicPence: toPence(row, "NIC"),
			actualCostPence: toPence(row, "ACTUAL_COST"),
			quantity: parseNumberField(row, "QUANTITY"),
			totalQuantity: parseNumberField(row, "TOTAL_QUANTITY"),
			periodEndDate,
			dataOriginator: "NhsEngland",
		},
		practice: {
			code: practiceCode,
			name: requireField(row, "PRACTICE_NAME"),
			addr1: requireField(row, "ADDRESS_1"),
			addr2: requireField(row, "ADDRESS_2"),
			addr3: requireField(row, "ADDRESS_3"),
			addr4: requireField(row, "ADDRESS_4"),
			addr5: requireField(row, "POSTCODE").replace(/, /g, "").trim(),
		},
		bnfItem: {
			code: bnfCode,
			name: bnfDescription,
		},
		periodEndDate,
	};
}

function requireField(row: CsvRow, key: string): string {
	const value = row[key];

	if (value === undefined) {
		throw new Error(`England CSV is missing field ${key}`);
	}

	return value;
}

function parseIntegerField(row: CsvRow, key: string): number {
	const value = Number(requireField(row, key));

	if (!Number.isFinite(value)) {
		throw new Error(`England CSV field ${key} is not numeric`);
	}

	return Math.trunc(value);
}

function parseNumberField(row: CsvRow, key: string): number {
	const value = Number(requireField(row, key));

	if (!Number.isFinite(value)) {
		throw new Error(`England CSV field ${key} is not numeric`);
	}

	return value;
}

function toPence(row: CsvRow, key: string): number {
	return Math.trunc(parseNumberField(row, key) * 100);
}
