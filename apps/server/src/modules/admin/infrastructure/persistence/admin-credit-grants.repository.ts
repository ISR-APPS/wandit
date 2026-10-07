/**
 * Reads the manual credit grant log from `credit_ledger`.
 * AdminCreditGrantsService calls it for GET /api/v1/admin/credit-grants.
 * Each row joins the granter, and the recipient user or organization.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminListCreditGrantsQuery,
	PaginatedResult,
} from "@wandit/contracts";
import { alias, desc, eq, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { creditLedger } from "@wandit/db/schema/credits";
import { organization } from "@wandit/db/schema/organizations";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** One `admin_grant` ledger row. A joined column is null when its join finds no row. */
export type AdminCreditGrantRow = {
	id: string;
	createdAt: Date;
	/** Centi-credits (100 = 1 credit). Always above zero for a grant. */
	delta: number;
	/** `meta.note`: the text the staff member typed in the grant dialog. */
	note: string | null;
	/** `meta.grantedBy`: the id of the staff user that made the grant. */
	granterId: string | null;
	granterName: string | null;
	granterEmail: string | null;
	/** Stored platform role. It can be comma-joined, for example "user,support". */
	granterRole: string | null;
	/** Set on a grant to a personal wallet. */
	userId: string | null;
	userName: string | null;
	userEmail: string | null;
	/** Set on a grant to an organization pool. */
	organizationId: string | null;
	organizationName: string | null;
};

// The literal stays in the SQL text so it matches the predicate of
// credit_ledger_adminGrant_createdAt_idx. A bind parameter can stop the planner
// from using that partial index.
const isAdminGrant = sql`(${creditLedger.meta} ->> 'reason') = 'admin_grant'`;

/** Read-only. It never writes to `credit_ledger`; CreditsService owns the writes. */
@Injectable()
export class AdminCreditGrantsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** One page of manual grants, newest first. `total` counts every manual grant. */
	async listCreditGrants(
		query: AdminListCreditGrantsQuery,
	): Promise<PaginatedResult<AdminCreditGrantRow>> {
		const { countQuery, listQuery } = this.buildListCreditGrantsQueries(query);
		const [[totalRow], items] = await Promise.all([countQuery, listQuery]);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	private buildListCreditGrantsQueries(query: AdminListCreditGrantsQuery) {
		const granter = alias(user, "granter");
		const offset = (query.page - 1) * query.pageSize;

		// The joins never add or drop a row (left joins on unique ids), so the
		// count needs only the ledger and agrees with the list.
		const countQuery = this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(creditLedger)
			.where(isAdminGrant);

		const listQuery = this.db
			.select({
				id: creditLedger.id,
				createdAt: creditLedger.createdAt,
				delta: creditLedger.delta,
				note: sql<string | null>`${creditLedger.meta} ->> 'note'`,
				granterId: sql<string | null>`${creditLedger.meta} ->> 'grantedBy'`,
				granterName: granter.name,
				granterEmail: granter.email,
				granterRole: granter.role,
				userId: creditLedger.userId,
				userName: user.name,
				userEmail: user.email,
				organizationId: creditLedger.organizationId,
				organizationName: organization.name,
			})
			.from(creditLedger)
			.leftJoin(
				granter,
				eq(granter.id, sql`${creditLedger.meta} ->> 'grantedBy'`),
			)
			.leftJoin(user, eq(user.id, creditLedger.userId))
			.leftJoin(organization, eq(organization.id, creditLedger.organizationId))
			.where(isAdminGrant)
			.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
			.limit(query.pageSize)
			.offset(offset);

		return { countQuery, listQuery };
	}
}
