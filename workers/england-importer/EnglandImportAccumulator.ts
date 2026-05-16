import type { EnglandBnfItem, EnglandPractice, EnglandPrescriptionItem } from "./EnglandImportTypes";

export class EnglandImportAccumulator {
	private prescribedItemCount = 0;

	private readonly practices = new Map<string, EnglandPractice>();

	private readonly bnfItems = new Map<string, EnglandBnfItem>();

	private readonly periods = new Set<string>();

	record(item: {
		prescribedItem: EnglandPrescriptionItem;
		practice: EnglandPractice;
		bnfItem: EnglandBnfItem;
		periodEndDate: string;
	}): void {
		this.prescribedItemCount += 1;
		this.practices.set(item.practice.code, item.practice);
		this.bnfItems.set(`${item.bnfItem.code}\u0000${item.bnfItem.name}`, item.bnfItem);
		this.periods.add(item.periodEndDate);
	}

	get prescribedCount(): number {
		return this.prescribedItemCount;
	}

	get practiceList(): readonly EnglandPractice[] {
		return [...this.practices.values()];
	}

	get bnfList(): readonly EnglandBnfItem[] {
		return [...this.bnfItems.values()];
	}

	get periodList(): readonly string[] {
		return [...this.periods.values()];
	}
}
