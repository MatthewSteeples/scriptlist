export function parseEnglandPeriodEndDate(value: string): string {
	const normalized = value.trim();
	let yearText = "";
	let parsedMonthText = "";

	const dashed = /^(\d{4})-(\d{1,2})$/.exec(normalized);
	if (dashed) {
		yearText = dashed[1];
		parsedMonthText = dashed[2];
	} else {
		const compact = /^(\d{4})(\d{1,2})$/.exec(normalized);
		if (compact) {
			yearText = compact[1];
			parsedMonthText = compact[2];
		}
	}

	if (!yearText || !parsedMonthText) {
		throw new Error(`Invalid England YEAR_MONTH value: ${value}`);
	}

	const year = Number(yearText);
	const month = Number(parsedMonthText);

	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
		throw new Error(`Invalid England YEAR_MONTH value: ${value}`);
	}

	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const monthText = String(month).padStart(2, "0");
	const dayText = String(lastDay).padStart(2, "0");

	return `${String(year).padStart(4, "0")}-${monthText}-${dayText}`;
}
