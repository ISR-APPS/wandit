import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
} from "@nestjs/common";
import type {
	CreateMonthlyCostRequest,
	ListMonthlyCostsQuery,
	ListMonthlyCostsResponse,
	MonthKey,
	MonthlyCostEntry,
	MonthlyCostResponse,
	UpdateMonthlyCostRequest,
} from "@wandit/contracts";

import {
	AdminCostsRepository,
	type AdminMonthlyCostRow,
} from "../../infrastructure/persistence/admin-costs.repository";

@Injectable()
export class AdminCostsService {
	constructor(
		@Inject(AdminCostsRepository)
		private readonly adminCostsRepository: AdminCostsRepository,
	) {}

	async list(query: ListMonthlyCostsQuery): Promise<ListMonthlyCostsResponse> {
		const { fromMonth, toMonth } = resolveListRange(query, new Date());
		const rows = await this.adminCostsRepository.list(
			monthKeyToDate(fromMonth),
			monthKeyToDate(toMonth),
		);

		return { months: rows.map(mapMonthlyCostEntry) };
	}

	async create(
		adminUserId: string,
		request: CreateMonthlyCostRequest,
	): Promise<MonthlyCostResponse> {
		const normalized = normalizeCostInput(request);
		const created = await this.adminCostsRepository.create({
			...normalized,
			adminUserId,
			month: monthKeyToDate(request.month),
		});

		if (!created) {
			throw new ConflictException(
				`Monthly costs already exist for ${request.month}`,
			);
		}

		return { month: mapMonthlyCostEntry(created) };
	}

	async update(
		adminUserId: string,
		month: MonthKey,
		request: UpdateMonthlyCostRequest,
	): Promise<MonthlyCostResponse> {
		const { version: expectedVersion, ...changes } = request;
		const normalized = normalizeCostChanges(changes);
		const updated = await this.adminCostsRepository.updateIfVersion({
			changes: normalized,
			expectedVersion,
			month: monthKeyToDate(month),
			updatedByUserId: adminUserId,
		});

		if (!updated) {
			throw new ConflictException(
				`Monthly costs for ${month} changed; reload and try again`,
			);
		}

		return { month: mapMonthlyCostEntry(updated) };
	}

	async delete(month: MonthKey): Promise<void> {
		await this.adminCostsRepository.delete(monthKeyToDate(month));
	}
}

function resolveListRange(
	query: ListMonthlyCostsQuery,
	now: Date,
): { fromMonth: MonthKey; toMonth: MonthKey } {
	const currentMonth = monthKey(now);
	const toMonth = query.toMonth ?? currentMonth;
	const fromMonth = query.fromMonth ?? addUtcMonths(toMonth, -11);

	if (fromMonth > toMonth) {
		throw new BadRequestException("toMonth must be on or after fromMonth");
	}

	return { fromMonth, toMonth };
}

function normalizeCostInput(request: CreateMonthlyCostRequest) {
	return {
		currency: normalizeCurrency(request.currency),
		adSpendBySourceCents: normalizeAdSpend(request.adSpendBySourceCents),
		infrastructureCostCents: request.infrastructureCostCents,
		otherCostCents: request.otherCostCents,
		notes: request.notes,
	};
}

function normalizeCostChanges(
	changes: Omit<UpdateMonthlyCostRequest, "version">,
): Partial<
	Pick<
		AdminMonthlyCostRow,
		| "adSpendBySourceCents"
		| "currency"
		| "infrastructureCostCents"
		| "notes"
		| "otherCostCents"
	>
> {
	return {
		...(changes.currency === undefined
			? {}
			: { currency: normalizeCurrency(changes.currency) }),
		...(changes.adSpendBySourceCents === undefined
			? {}
			: {
					adSpendBySourceCents: normalizeAdSpend(changes.adSpendBySourceCents),
				}),
		...(changes.infrastructureCostCents === undefined
			? {}
			: { infrastructureCostCents: changes.infrastructureCostCents }),
		...(changes.otherCostCents === undefined
			? {}
			: { otherCostCents: changes.otherCostCents }),
		...(changes.notes === undefined ? {} : { notes: changes.notes }),
	};
}

function normalizeCurrency(currency: string): string {
	const normalized = currency.trim().toLowerCase();
	if (!normalized) throw new BadRequestException("currency must not be blank");
	return normalized;
}

function normalizeAdSpend(
	spend: Record<string, number>,
): Record<string, number> {
	const normalized: Record<string, number> = {};

	for (const [source, cents] of Object.entries(spend)) {
		const key = source.trim().toLowerCase();
		if (!key) {
			throw new BadRequestException("Ad-spend source names must not be blank");
		}
		normalized[key] = (normalized[key] ?? 0) + cents;
	}

	return normalized;
}

function mapMonthlyCostEntry(row: AdminMonthlyCostRow): MonthlyCostEntry {
	const totalAdSpendCents = Object.values(row.adSpendBySourceCents).reduce(
		(sum, cents) => sum + cents,
		0,
	);

	return {
		month: row.month.slice(0, 7),
		currency: row.currency,
		adSpendBySourceCents: row.adSpendBySourceCents,
		infrastructureCostCents: row.infrastructureCostCents,
		otherCostCents: row.otherCostCents,
		notes: row.notes,
		totalAdSpendCents,
		totalCostCents:
			totalAdSpendCents + row.infrastructureCostCents + row.otherCostCents,
		version: row.version,
		updatedAt: row.updatedAt.toISOString(),
	};
}

function monthKeyToDate(month: MonthKey): string {
	return `${month}-01`;
}

function monthKey(value: Date): MonthKey {
	return value.toISOString().slice(0, 7) as MonthKey;
}

function addUtcMonths(month: MonthKey, offset: number): MonthKey {
	const value = new Date(`${month}-01T00:00:00.000Z`);
	value.setUTCMonth(value.getUTCMonth() + offset);
	return monthKey(value);
}
