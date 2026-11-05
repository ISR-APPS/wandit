/**
 * Reads and changes organizations (team and personal workspaces) for the admin dashboard.
 * AdminOrganizationsController calls it. It calls AdminOrganizationsRepository,
 * CreditsService for balances and credit grants to the org pool, and
 * MembershipCleanupService after a change to viewer.
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
	isViewerOnly,
	splitWorkspaceRoles,
} from "@wandit/auth/workspace-membership-rules";
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
import { orgOwner, userOwner } from "../../../credits/domain/credit-owner";
import { MembershipCleanupService } from "../../../workspaces";
import {
	mapAdminOrganizationLedgerEntry,
	mapAdminOrganizationMember,
	mapAdminOrganizationSubscription,
	mapAdminOrganizationSummary,
} from "../../infrastructure/mappers/admin-organization.mapper";
import {
	type AdminOrganizationSummaryRow,
	AdminOrganizationsRepository,
} from "../../infrastructure/persistence/admin-organizations.repository";

const RECENT_LEDGER_LIMIT = 50;

@Injectable()
export class AdminOrganizationsService {
	private readonly logger = new Logger(AdminOrganizationsService.name);

	constructor(
		@Inject(AdminOrganizationsRepository)
		private readonly repository: AdminOrganizationsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(MembershipCleanupService)
		private readonly membershipCleanup: Pick<
			MembershipCleanupService,
			"handleMembershipReduced"
		>,
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

	/**
	 * The detail page. For a personal workspace the balance is the owner's
	 * personal pool. The ledger, subscription, and AI spend stay org-scoped.
	 */
	async getOrganizationDetail(
		organizationId: string,
	): Promise<AdminOrganizationDetail> {
		const summary = await this.requireOrganizationSummary(organizationId);
		// A personal workspace has no pool of its own: its owner's personal pool pays.
		const pool =
			summary.personalOwnerUserId === null
				? orgOwner(organizationId)
				: userOwner(summary.personalOwnerUserId);

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
			this.creditsService.getSettledBalance(pool),
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
			personalOwnerUserId: summary.personalOwnerUserId,
		};
	}

	/**
	 * Adds promo credits to an organization's shared pool.
	 * `actor` is the signed-in staff account. Its id goes to `meta.grantedBy` for the grant log.
	 * Throws 400 for a personal workspace, and when a non-admin staff account is a member of the organization.
	 */
	async grantCredits(
		actor: Pick<AuthUser, "id" | "role">,
		organizationId: string,
		input: AdminGrantCreditsInput,
	): Promise<AdminOrganizationDetail> {
		const summary = await this.requireOrganizationSummary(organizationId);

		// The owner's personal pool pays in a personal workspace. Staff grant to the user instead.
		if (summary.personalOwnerUserId !== null) {
			throw new BadRequestException(
				"A personal workspace has no credit pool. Grant the credits to its owner",
			);
		}

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
	 * In a personal workspace, throws 400 for `owner` on another member and for
	 * any other role on the personal owner. A change to viewer whose cleanup
	 * fails writes the old role back and rethrows.
	 */
	async setMemberRole(
		actingAdminId: string,
		organizationId: string,
		userId: string,
		input: AdminSetMemberRoleInput,
	): Promise<AdminOrganizationDetail> {
		const summary = await this.requireOrganizationSummary(organizationId);

		// A personal workspace has exactly one owner: its personal owner (workspaces-sharing.md 0).
		if (summary.personalOwnerUserId !== null) {
			const isPersonalOwner = userId === summary.personalOwnerUserId;

			if (input.role === "owner" && !isPersonalOwner) {
				throw new BadRequestException(
					"A personal workspace cannot have another owner",
				);
			}

			if (input.role !== "owner" && isPersonalOwner) {
				throw new BadRequestException(
					"The owner of a personal workspace must keep the owner role",
				);
			}
		}

		const target = await this.repository.findMember(organizationId, userId);

		if (!target) {
			throw new NotFoundException();
		}

		await this.repository.updateMemberRole(organizationId, userId, input.role);

		// A change to viewer runs the same cleanup as the Better Auth hook: it cancels the
		// member's open turns and revokes the links (workspaces-sharing.md 2.1).
		if (
			input.role === "viewer" &&
			!isViewerOnly(splitWorkspaceRoles(target.role))
		) {
			try {
				await this.membershipCleanup.handleMembershipReduced({
					change: "viewer",
					ipAddress: null,
					organizationId,
					userId,
				});
			} catch (error) {
				// Without the undo, a retry finds no role change and skips the cleanup.
				await this.repository.updateMemberRole(
					organizationId,
					userId,
					target.role,
				);
				throw error;
			}
		}

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

	private async requireOrganizationSummary(
		organizationId: string,
	): Promise<AdminOrganizationSummaryRow> {
		const summary =
			await this.repository.findOrganizationSummary(organizationId);

		if (!summary) {
			throw new NotFoundException();
		}

		return summary;
	}
}
