export const canonicalEnglandFixtureName = "EPD_202301.csv";
export const canonicalEnglandR2Key = "england/canonical/EPD_202301.csv";

export const englandUnifiedRequiredHeaders = [
	"PRACTICE_CODE",
	"BNF_CODE",
	"BNF_DESCRIPTION",
	"ITEMS",
	"NIC",
	"ACTUAL_COST",
	"QUANTITY",
	"TOTAL_QUANTITY",
	"YEAR_MONTH",
	"PRACTICE_NAME",
	"ADDRESS_1",
	"ADDRESS_2",
	"ADDRESS_3",
	"ADDRESS_4",
	"POSTCODE",
] as const;

export interface EnglandPrescriptionItem {
	importRunId: string;
	rowNumber: number;
	practiceCode: string;
	bnfCode: string;
	bnfDescription: string;
	items: number;
	nicPence: number;
	actualCostPence: number;
	quantity: number;
	totalQuantity: number;
	periodEndDate: string;
	dataOriginator: "NhsEngland";
}

export interface EnglandPractice {
	code: string;
	name: string;
	addr1: string;
	addr2: string;
	addr3: string;
	addr4: string;
	addr5: string;
}

export interface EnglandBnfItem {
	code: string;
	name: string;
}

export interface EnglandImportSummary {
	importRunId: string;
	sourceName: string;
	startedAt: string;
	completedAt: string;
	elapsedMs: number;
	status: "completed" | "failed";
	rawRowCount: number;
	prescribedItemCount: number;
	practiceCount: number;
	bnfItemCount: number;
	periodCount: number;
	storedCounts: {
		prescribedItems: number;
		practices: number;
		bnfItems: number;
		periods: number;
	};
}

export interface EnglandWorkerBindings {
	DB: D1Database;
	CSV_BUCKET: R2Bucket;
	IMPORT_ORCHESTRATOR: DurableObjectNamespace;
}
