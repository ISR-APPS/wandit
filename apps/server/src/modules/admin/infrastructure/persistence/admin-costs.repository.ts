import { Inject, Injectable } from "@nestjs/common";
import { type SQL, sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type AdminMonthlyCostRow = {
	adSpendBySourceCents: Record<string, number>;
	createdAt: Date;
	createdByUserId: string;
	currency: string;
	infrastructureCostCents: number;
	month: string;
	notes: string | null;
	otherCostCents: number;
	updatedAt: Date;
	updatedByUserId: string;
	version: number;
};

export type CreateAdminMonthlyCostRow = {
	adSpendBySourceCents: Record<string, number>;
	adminUserId: string;
	currency: string;
	infrastructureCostCents: number;
	month: string;
	notes: string | null;
	otherCostCents: number;
};

export type UpdateAdminMonthlyCostRow = {
	changes: Partial<
		Pick<
			AdminMonthlyCostRow,
			| "adSpendBySourceCents"
			| "currency"
			| "infrastructureCostCents"
			| "notes"
			| "otherCostCents"
		>
	>;
	expectedVersion: number;
	month: string;
	updatedByUserId: string;
};

type AdminMonthlyCostDbRow = {
	ad_spend_by_source_cents: Record<string, number>;
	created_at: Date;
	created_by_user_id: string;
	currency: string;
	infrastructure_cost_cents: number;
	month: string;
	notes: string | null;
	other_cost_cents: number;
	updated_at: Date;
	updated_by_user_id: string;
	version: number;
};

@Injectable()
export class AdminCostsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async list(
		fromMonth: string,
		toMonth: string,
	): Promise<AdminMonthlyCostRow[]> {
		const result = await this.db.execute<AdminMonthlyCostDbRow>(sql`
			select ${monthlyCostSelection()}
			from monthly_costs c
			where c.month >= ${fromMonth}::date
				and c.month <= ${toMonth}::date
			order by c.month desc
		`);

		return result.rows.map(mapMonthlyCostRow);
	}

	async create(
		input: CreateAdminMonthlyCostRow,
	): Promise<AdminMonthlyCostRow | null> {
		const result = await this.db.execute<AdminMonthlyCostDbRow>(sql`
			insert into monthly_costs as c (
				month,
				currency,
				ad_spend_by_source_cents,
				infrastructure_cost_cents,
				other_cost_cents,
				notes,
				created_by_user_id,
				updated_by_user_id
			)
			values (
				${input.month}::date,
				${input.currency},
				${JSON.stringify(input.adSpendBySourceCents)}::jsonb,
				${input.infrastructureCostCents},
				${input.otherCostCents},
				${input.notes},
				${input.adminUserId},
				${input.adminUserId}
			)
			on conflict (month) do nothing
			returning ${monthlyCostSelection()}
		`);

		return result.rows[0] ? mapMonthlyCostRow(result.rows[0]) : null;
	}

	async updateIfVersion(
		input: UpdateAdminMonthlyCostRow,
	): Promise<AdminMonthlyCostRow | null> {
		const assignments: SQL[] = [];

		if (input.changes.currency !== undefined) {
			assignments.push(sql`currency = ${input.changes.currency}`);
		}
		if (input.changes.adSpendBySourceCents !== undefined) {
			assignments.push(
				sql`ad_spend_by_source_cents = ${JSON.stringify(
					input.changes.adSpendBySourceCents,
				)}::jsonb`,
			);
		}
		if (input.changes.infrastructureCostCents !== undefined) {
			assignments.push(
				sql`infrastructure_cost_cents = ${input.changes.infrastructureCostCents}`,
			);
		}
		if (input.changes.otherCostCents !== undefined) {
			assignments.push(sql`other_cost_cents = ${input.changes.otherCostCents}`);
		}
		if (input.changes.notes !== undefined) {
			assignments.push(sql`notes = ${input.changes.notes}`);
		}

		assignments.push(
			sql`updated_by_user_id = ${input.updatedByUserId}`,
			sql`updated_at = now()`,
			sql`version = version + 1`,
		);

		const result = await this.db.execute<AdminMonthlyCostDbRow>(sql`
			update monthly_costs as c
			set ${sql.join(assignments, sql`, `)}
			where c.month = ${input.month}::date
				and c.version = ${input.expectedVersion}
			returning ${monthlyCostSelection()}
		`);

		return result.rows[0] ? mapMonthlyCostRow(result.rows[0]) : null;
	}

	async delete(month: string): Promise<void> {
		await this.db.execute(sql`
			delete from monthly_costs
			where month = ${month}::date
		`);
	}
}

function monthlyCostSelection(): SQL {
	return sql`
		c.month::text as month,
		c.currency,
		c.ad_spend_by_source_cents,
		c.infrastructure_cost_cents,
		c.other_cost_cents,
		c.notes,
		c.version,
		c.created_by_user_id,
		c.updated_by_user_id,
		c.created_at,
		c.updated_at
	`;
}

function mapMonthlyCostRow(row: AdminMonthlyCostDbRow): AdminMonthlyCostRow {
	return {
		month: row.month.slice(0, 10),
		currency: String(row.currency),
		adSpendBySourceCents: row.ad_spend_by_source_cents ?? {},
		infrastructureCostCents: Number(row.infrastructure_cost_cents),
		otherCostCents: Number(row.other_cost_cents),
		notes: row.notes,
		version: Number(row.version),
		createdByUserId: String(row.created_by_user_id),
		updatedByUserId: String(row.updated_by_user_id),
		createdAt: new Date(row.created_at),
		updatedAt: new Date(row.updated_at),
	};
}
