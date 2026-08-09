import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "@wandit/db";
import { aiUsageEvents } from "@wandit/db/schema/credits";
import {
	organizationBillingSettings,
	organizationMemberCreditLimits,
} from "@wandit/db/schema/organizations";

import {
	creditOwnerLockValue,
	orgOwner,
} from "../../../credits/domain/credit-owner";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type OrganizationBillingSettingsRow =
	typeof organizationBillingSettings.$inferSelect;
export type OrganizationMemberCreditLimitRow =
	typeof organizationMemberCreditLimits.$inferSelect;

type LimitsDbClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update" | "delete"
>;

/**
 * Per-member credit-limit resolution: explicit member row binds anyone;
 * the org default binds non-exempt members only (owners/admins skip it).
 * NULL anywhere = unlimited.
 */
export type ResolvedMemberLimit = {
	limitCredits: number | null;
	source: "member" | "org-default" | "none";
};

@Injectable()
export class OrganizationLimitsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Serialize limit WRITES against in-flight metering reserves by taking the
	 * SAME advisory lock as the org's credit balance (creditOwnerLockValue) —
	 * a lowered limit can never interleave with a reserve that already read
	 * the old value (confirmed design-review finding).
	 */
	async withOrgCreditLock<T>(
		organizationId: string,
		fn: (tx: LimitsDbClient) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(orgOwner(organizationId))}))`,
			);

			return fn(tx);
		});
	}

	async resolveMemberLimit(
		organizationId: string,
		userId: string,
		actorIsExempt: boolean,
		client: LimitsDbClient = this.db,
	): Promise<ResolvedMemberLimit> {
		const [memberRow] = await client
			.select()
			.from(organizationMemberCreditLimits)
			.where(
				and(
					eq(organizationMemberCreditLimits.organizationId, organizationId),
					eq(organizationMemberCreditLimits.userId, userId),
				),
			)
			.limit(1);

		if (memberRow) {
			return { limitCredits: memberRow.monthlyCreditLimit, source: "member" };
		}

		if (actorIsExempt) {
			return { limitCredits: null, source: "none" };
		}

		const [settings] = await client
			.select()
			.from(organizationBillingSettings)
			.where(eq(organizationBillingSettings.organizationId, organizationId))
			.limit(1);

		if (settings?.defaultMemberMonthlyCreditLimit != null) {
			return {
				limitCredits: settings.defaultMemberMonthlyCreditLimit,
				source: "org-default",
			};
		}

		return { limitCredits: null, source: "none" };
	}

	async findSettings(
		organizationId: string,
		client: LimitsDbClient = this.db,
	): Promise<OrganizationBillingSettingsRow | null> {
		const [row] = await client
			.select()
			.from(organizationBillingSettings)
			.where(eq(organizationBillingSettings.organizationId, organizationId))
			.limit(1);

		return row ?? null;
	}

	async listMemberLimits(
		organizationId: string,
		client: LimitsDbClient = this.db,
	): Promise<OrganizationMemberCreditLimitRow[]> {
		return client
			.select()
			.from(organizationMemberCreditLimits)
			.where(eq(organizationMemberCreditLimits.organizationId, organizationId));
	}

	async upsertSettings(
		organizationId: string,
		defaultMemberMonthlyCreditLimit: number | null,
		updatedByUserId: string,
		client: LimitsDbClient = this.db,
	): Promise<void> {
		await client
			.insert(organizationBillingSettings)
			.values({
				defaultMemberMonthlyCreditLimit,
				organizationId,
				updatedByUserId,
			})
			.onConflictDoUpdate({
				set: {
					defaultMemberMonthlyCreditLimit,
					updatedAt: new Date(),
					updatedByUserId,
				},
				target: organizationBillingSettings.organizationId,
			});
	}

	async upsertMemberLimit(
		organizationId: string,
		userId: string,
		monthlyCreditLimit: number,
		updatedByUserId: string,
		client: LimitsDbClient = this.db,
	): Promise<void> {
		await client
			.insert(organizationMemberCreditLimits)
			.values({
				monthlyCreditLimit,
				organizationId,
				updatedByUserId,
				userId,
			})
			.onConflictDoUpdate({
				set: {
					monthlyCreditLimit,
					updatedAt: new Date(),
					updatedByUserId,
				},
				target: [
					organizationMemberCreditLimits.organizationId,
					organizationMemberCreditLimits.userId,
				],
			});
	}

	async deleteMemberLimit(
		organizationId: string,
		userId: string,
		client: LimitsDbClient = this.db,
	): Promise<void> {
		await client
			.delete(organizationMemberCreditLimits)
			.where(
				and(
					eq(organizationMemberCreditLimits.organizationId, organizationId),
					eq(organizationMemberCreditLimits.userId, userId),
				),
			);
	}

	/**
	 * Member spend this calendar month (UTC): reserved-or-final credits over
	 * the org's usage events. COALESCE(final, reserved) makes refunded work
	 * count 0 (refunds settle finalCredits to 0) while open reservations count
	 * their full hold.
	 */
	async sumMemberSpendThisMonth(
		organizationId: string,
		userId: string,
		now: Date,
		client: LimitsDbClient = this.db,
	): Promise<number> {
		const monthStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		);
		const [row] = await client
			.select({
				spent: sql<number>`coalesce(sum(coalesce(${aiUsageEvents.finalCredits}, ${aiUsageEvents.reservedCredits})), 0)::int`,
			})
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.organizationId, organizationId),
					eq(aiUsageEvents.userId, userId),
					gte(aiUsageEvents.createdAt, monthStart),
				),
			);

		return Number(row?.spent ?? 0);
	}
}
