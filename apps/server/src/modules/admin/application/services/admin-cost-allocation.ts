export type MonthlyCostAllocationRow = {
	adSpendBySourceCents: Record<string, number>;
	infrastructureCostCents: number;
	month: string;
	otherCostCents: number;
};

export type AdminCostAllocation = {
	adSpendBySourceCents: Record<string, number>;
	adSpendCents: number;
	costCoverageComplete: boolean;
	infrastructureCostCents: number;
	otherCostCents: number;
	totalCostCents: number;
};

const MILLISECONDS_PER_DAY = 86_400_000;

export function prorateMonthlyCosts(
	rows: readonly MonthlyCostAllocationRow[],
	rangeStart: Date,
	rangeEnd: Date,
): AdminCostAllocation {
	const monthKeys = intersectingMonthKeys(rangeStart, rangeEnd);
	const rowsByMonth = new Map(rows.map((row) => [row.month.slice(0, 7), row]));
	const costCoverageComplete = monthKeys.every((month) =>
		rowsByMonth.has(month),
	);

	if (!costCoverageComplete) {
		return emptyAllocation(false);
	}

	let adSpendCentsExact = 0;
	let infrastructureCostCentsExact = 0;
	let otherCostCentsExact = 0;
	const adSpendBySourceExact = new Map<string, number>();

	for (const month of monthKeys) {
		const row = rowsByMonth.get(month);
		if (!row) continue;

		const factor = monthOverlapFactor(month, rangeStart, rangeEnd);
		infrastructureCostCentsExact +=
			nonnegativeFinite(row.infrastructureCostCents) * factor;
		otherCostCentsExact += nonnegativeFinite(row.otherCostCents) * factor;

		for (const [source, cents] of Object.entries(row.adSpendBySourceCents)) {
			const normalizedSource = source.trim().toLowerCase();
			if (!normalizedSource) continue;

			const proratedCents = nonnegativeFinite(cents) * factor;
			adSpendCentsExact += proratedCents;
			adSpendBySourceExact.set(
				normalizedSource,
				(adSpendBySourceExact.get(normalizedSource) ?? 0) + proratedCents,
			);
		}
	}

	const adSpendCents = Math.round(adSpendCentsExact);
	const infrastructureCostCents = Math.round(infrastructureCostCentsExact);
	const otherCostCents = Math.round(otherCostCentsExact);

	return {
		adSpendBySourceCents: Object.fromEntries(
			[...adSpendBySourceExact].map(([source, cents]) => [
				source,
				Math.round(cents),
			]),
		),
		adSpendCents,
		costCoverageComplete,
		infrastructureCostCents,
		otherCostCents,
		totalCostCents: adSpendCents + infrastructureCostCents + otherCostCents,
	};
}

function emptyAllocation(costCoverageComplete: boolean): AdminCostAllocation {
	return {
		adSpendBySourceCents: {},
		adSpendCents: 0,
		costCoverageComplete,
		infrastructureCostCents: 0,
		otherCostCents: 0,
		totalCostCents: 0,
	};
}

function intersectingMonthKeys(rangeStart: Date, rangeEnd: Date): string[] {
	if (rangeEnd.getTime() <= rangeStart.getTime()) return [];

	const monthKeys: string[] = [];
	const cursor = new Date(
		Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1),
	);
	const lastIncludedInstant = new Date(rangeEnd.getTime() - 1);
	const finalMonth = Date.UTC(
		lastIncludedInstant.getUTCFullYear(),
		lastIncludedInstant.getUTCMonth(),
		1,
	);

	while (cursor.getTime() <= finalMonth) {
		monthKeys.push(cursor.toISOString().slice(0, 7));
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}

	return monthKeys;
}

function monthOverlapFactor(
	month: string,
	rangeStart: Date,
	rangeEnd: Date,
): number {
	const [yearText, monthText] = month.split("-");
	const year = Number(yearText);
	const monthIndex = Number(monthText) - 1;
	const monthStart = new Date(Date.UTC(year, monthIndex, 1));
	const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));
	const overlapStart = new Date(
		Math.max(monthStart.getTime(), rangeStart.getTime()),
	);
	const overlapEnd = new Date(Math.min(monthEnd.getTime(), rangeEnd.getTime()));

	if (overlapEnd.getTime() <= overlapStart.getTime()) return 0;

	const firstOverlappingDay = utcDayStart(overlapStart);
	const afterLastOverlappingDay = utcDayCeiling(overlapEnd);
	const overlappingDays = Math.max(
		0,
		(afterLastOverlappingDay.getTime() - firstOverlappingDay.getTime()) /
			MILLISECONDS_PER_DAY,
	);
	const daysInMonth =
		(monthEnd.getTime() - monthStart.getTime()) / MILLISECONDS_PER_DAY;

	return overlappingDays / daysInMonth;
}

function utcDayStart(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

function utcDayCeiling(value: Date): Date {
	const start = utcDayStart(value);
	return start.getTime() === value.getTime()
		? start
		: new Date(start.getTime() + MILLISECONDS_PER_DAY);
}

function nonnegativeFinite(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}
