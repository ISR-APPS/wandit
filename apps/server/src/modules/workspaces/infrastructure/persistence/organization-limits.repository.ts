/**
 * Reads and writes member credit limits, and sums the month spend of one member.
 * MemberLimitsService and the metering reserve gate call it.
 * It reads `organization`, `organization_billing_settings`, `organization_member_credit_limits`, and `ai_usage_events`.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, type SQL, sql } from "@wandit/db";
import { aiUsageEvents } from "@wandit/db/schema/credits";
import {
	organization,
	organizationBillingSettings,
	organizationMemberCreditLimits,
} from "@wandit/db/schema/organizations";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";

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
	 * SAME advisory lock as the paying pool's balance (creditOwnerLockValue) —
	 * a lowered limit can never interleave with a reserve that already read
	 * the old value (confirmed design-review finding). `pool` is the org pool,
	 * or the owner's personal pool for a personal workspace.
	 */
	async withPoolCreditLock<T>(
		pool: CreditOwner,
		fn: (tx: LimitsDbClient) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${creditOwnerLockValue(pool)}))`,
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

	/**
	 * Id of the personal workspace of `ownerUserId`, or null when it has none.
	 * Its limit rows bind the members who spend the owner's personal pool.
	 */
	async findPersonalOrganizationId(
		ownerUserId: string,
		client: LimitsDbClient = this.db,
	): Promise<string | null> {
		const [row] = await client
			.select({ id: organization.id })
			.from(organization)
			.where(eq(organization.personalOwnerUserId, ownerUserId))
			.limit(1);

		return row?.id ?? null;
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

	/** Spend of one member this calendar month (UTC) from the org pool, in centi-credits. */
	async sumMemberSpendThisMonth(
		organizationId: string,
		userId: string,
		now: Date,
		client: LimitsDbClient = this.db,
	): Promise<number> {
		return this.sumSpendThisMonth(
			[eq(aiUsageEvents.organizationId, organizationId)],
			userId,
			now,
			client,
		);
	}

	/**
	 * Spend of one user this calendar month (UTC) from a personal pool, in
	 * centi-credits. The owner's own events have no `payer_user_id`; a member's
	 * events name the owner.
	 */
	async sumPersonalPoolMemberSpendThisMonth(
		ownerUserId: string,
		userId: string,
		now: Date,
		client: LimitsDbClient = this.db,
	): Promise<number> {
		return this.sumSpendThisMonth(
			[
				isNull(aiUsageEvents.organizationId),
				userId === ownerUserId
					? isNull(aiUsageEvents.payerUserId)
					: eq(aiUsageEvents.payerUserId, ownerUserId),
			],
			userId,
			now,
			client,
		);
	}

	/**
	 * Reserved-or-final credits of `userId` in one pool since the month start
	 * (UTC). COALESCE(final, reserved) makes refunded work count 0 (refunds
	 * settle finalCredits to 0) while open reservations count their full hold.
	 * `poolFilters` are the conditions that select the pool's events.
	 */
	private async sumSpendThisMonth(
		poolFilters: SQL[],
		userId: string,
		now: Date,
		client: LimitsDbClient,
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
					...poolFilters,
					eq(aiUsageEvents.userId, userId),
					gte(aiUsageEvents.createdAt, monthStart),
				),
			);

		return Number(row?.spent ?? 0);
	}
}
