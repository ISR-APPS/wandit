/**
 * Reads and changes team organizations for the admin dashboard.
 * AdminOrganizationsController calls it. It calls AdminOrganizationsRepository
 * and CreditsService for credit grants to the org pool.
 */
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminGrantCreditsInput,
	type AdminListOrganizationsQuery,
	type AdminListOrganizationsResponse,
	type AdminOrganizationDetail,
	type AdminSetMemberRoleInput,
	centiCreditsToCredits,
	creditsToCentiCredits,
	isAdminRole,
	normalizeStoredRole,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { orgOwner } from "../../../credits/domain/credit-owner";
import {
	mapAdminOrganizationLedgerEntry,
	mapAdminOrganizationMember,
	mapAdminOrganizationSubscription,
	mapAdminOrganizationSummary,
} from "../../infrastructure/mappers/admin-organization.mapper";
import { AdminOrganizationsRepository } from "../../infrastructure/persistence/admin-organizations.repository";

const RECENT_LEDGER_LIMIT = 50;

@Injectable()
export class AdminOrganizationsService {
	private readonly logger = new Logger(AdminOrganizationsService.name);

	constructor(
		@Inject(AdminOrganizationsRepository)
		private readonly repository: AdminOrganizationsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	async listOrganizations(
		query: AdminListOrganizationsQuery,
	): Promise<AdminListOrganizationsResponse> {
		const page = await this.repository.listOrganizations(query);

		return {
			items: page.items.map(mapAdminOrganizationSummary),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async getOrganizationDetail(
		organizationId: string,
	): Promise<AdminOrganizationDetail> {
		const summary =
			await this.repository.findOrganizationSummary(organizationId);

		if (!summary) {
			throw new NotFoundException();
		}

		const [
			members,
			subscription,
			balance,
			ledger,
			pendingInvitationsCount,
			defaultMemberMonthlyCreditLimit,
			memberLimits,
			spentByUser,
			attributionUserId,
			aiSpend,
		] = await Promise.all([
			this.repository.listMembersWithUsers(organizationId),
			this.repository.findLatestSubscription(organizationId),
			this.creditsService.getSettledBalance(orgOwner(organizationId)),
			this.repository.listRecentLedger(organizationId, RECENT_LEDGER_LIMIT),
			this.repository.countPendingInvitations(organizationId),
			this.repository.findDefaultMemberLimit(organizationId),
			this.repository.listMemberLimits(organizationId),
			this.repository.sumMemberSpendThisMonth(organizationId, new Date()),
			this.repository.findAttributionUserId(organizationId),
			this.repository.sumAiSpend(organizationId),
		]);

		return {
			...mapAdminOrganizationSummary(summary),
			members: members.map((row) =>
				mapAdminOrganizationMember(
					row,
					memberLimits.get(row.userId) ?? null,
					spentByUser.get(row.userId) ?? 0,
				),
			),
			pendingInvitationsCount,
			subscription: subscription
				? mapAdminOrganizationSubscription(subscription)
				: null,
			// CreditsService balances are internal centi-credits; the API carries
			// decimal credits.
			balance: {
				balance: centiCreditsToCredits(balance.balance),
				plan: centiCreditsToCredits(balance.plan),
				promo: centiCreditsToCredits(balance.promo),
				settledBalance: centiCreditsToCredits(balance.settledBalance),
				settledPlan: centiCreditsToCredits(balance.settledPlan),
				settledPromo: centiCreditsToCredits(balance.settledPromo),
				settledTopup: centiCreditsToCredits(balance.settledTopup),
				topup: centiCreditsToCredits(balance.topup),
			},
			creditLedger: ledger.map(mapAdminOrganizationLedgerEntry),
			aiSpend: {
				totalCostUsdMicros: Number(aiSpend.totalCostUsdMicros),
				meteredOperations: Number(aiSpend.meteredOperations),
			},
			defaultMemberMonthlyCreditLimit:
				defaultMemberMonthlyCreditLimit === null
					? null
					: centiCreditsToCredits(defaultMemberMonthlyCreditLimit),
			attributionUserId,
		};
	}

	/**
	 * Adds promo credits to an organization's shared pool.
	 * `actor` is the signed-in staff account. Its id goes to `meta.grantedBy` for the grant log.
	 * Throws 400 when a non-admin staff account is a member of the organization.
	 */
	async grantCredits(
		actor: Pick<AuthUser, "id" | "role">,
		organizationId: string,
		input: AdminGrantCreditsInput,
	): Promise<AdminOrganizationDetail> {
		await this.ensureOrganizationExists(organizationId);

		// Support cannot grant credits to a pool that it spends from. Admins are exempt.
		if (
			!isAdminRole(actor.role) &&
			(await this.repository.findMember(organizationId, actor.id)) !== null
		) {
			throw new BadRequestException(
				"Support accounts cannot grant credits to an organization they belong to",
			);
		}

		// "org:" namespaces the key away from personal grants — Better Auth user
		// ids never contain a colon prefix, so the two families cannot collide.
		// The API amount is decimal credits; the ledger takes centi-credits.
		await this.creditsService.grant(
			orgOwner(organizationId),
			creditsToCentiCredits(input.amount),
			{
				bucket: "promo",
				idempotencyKey: `admin-grant:org:${organizationId}:${input.requestId}`,
				meta: {
					reason: "admin_grant",
					grantedBy: actor.id,
					note: input.reason ?? null,
				},
			},
		);

		this.logger.log(
			`admin_grant_org_credits admin=${actor.id} role=${normalizeStoredRole(actor.role)} org=${organizationId} amountCredits=${input.amount}`,
		);

		return this.getOrganizationDetail(organizationId);
	}

	/**
	 * Direct member-row write — the zero-owner repair tool (§1.1/§10).
	 * Deliberately allows demoting the last owner (repair needs the
	 * unrestricted write); an ownerless outcome is logged loudly instead.
	 */
	async setMemberRole(
		actingAdminId: string,
		organizationId: string,
		userId: string,
		input: AdminSetMemberRoleInput,
	): Promise<AdminOrganizationDetail> {
		await this.ensureOrganizationExists(organizationId);

		const target = await this.repository.findMember(organizationId, userId);

		if (!target) {
			throw new NotFoundException();
		}

		await this.repository.updateMemberRole(organizationId, userId, input.role);

		this.logger.log(
			`admin_set_member_role admin=${actingAdminId} org=${organizationId} target=${userId} role=${input.role} previous=${target.role}`,
		);

		const members = await this.repository.listMembersWithUsers(organizationId);
		const hasOwner = members.some((row) =>
			row.role
				.split(",")
				.some((value) => value.trim().toLowerCase() === "owner"),
		);

		if (!hasOwner) {
			this.logger.warn(
				`admin_set_member_role left org=${organizationId} with ZERO owners — promote a member to owner`,
			);
		}

		return this.getOrganizationDetail(organizationId);
	}

	private async ensureOrganizationExists(
		organizationId: string,
	): Promise<void> {
		const summary =
			await this.repository.findOrganizationSummary(organizationId);

		if (!summary) {
			throw new NotFoundException();
		}
	}
}
