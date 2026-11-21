/**
 * Reads and changes user accounts for the admin dashboard.
 * AdminUsersController calls it. It calls AdminRepository, the view-grant
 * repository, CreditsService for credit grants, and StarterPassesRepository for the Starter pass.
 */
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminGrantCreditsInput,
	type AdminListUsersQuery,
	type AdminListUsersResponse,
	type AdminSetAdminViewsInput,
	type AdminSetBannedInput,
	type AdminSetRoleInput,
	type AdminStarterPassBody,
	type AdminStarterPassResponse,
	type AdminUserDetail,
	type AdminUserPage,
	type AdminUserPagesQuery,
	type AdminUserPagesResponse,
	type AdminUserProjectsQuery,
	type AdminUserProjectsResponse,
	creditsToCentiCredits,
	isAdminRole,
	isStaffRole,
	normalizeStoredRole,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { StarterPassesRepository } from "../../../billing/infrastructure/persistence/starter-passes.repository";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import { canonicalDomainHost } from "../../../domains/domain/domain-hosts";
import {
	mapAdminStarterPass,
	mapAdminUserDetail,
	mapAdminUserProject,
	mapAdminUserSummary,
} from "../../infrastructure/mappers/admin-user.mapper";
import {
	AdminRepository,
	type AdminTransaction,
	type AdminUserPageRow,
} from "../../infrastructure/persistence/admin.repository";
import { AdminOrganizationsRepository } from "../../infrastructure/persistence/admin-organizations.repository";
import {
	AdminViewGrantsRepository,
	filterKnownAdminViews,
} from "../../infrastructure/persistence/admin-view-grants.repository";

const RECENT_PROJECTS_LIMIT = 25;
const RECENT_LEDGER_LIMIT = 50;

@Injectable()
export class AdminUsersService {
	private readonly logger = new Logger(AdminUsersService.name);

	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
		@Inject(AdminOrganizationsRepository)
		private readonly adminOrganizationsRepository: AdminOrganizationsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(AdminViewGrantsRepository)
		private readonly adminViewGrantsRepository: AdminViewGrantsRepository,
		@Inject(StarterPassesRepository)
		private readonly starterPasses: Pick<
			StarterPassesRepository,
			"findLive" | "grantIfAbsent" | "revokeLive"
		>,
	) {}

	async listUsers(query: AdminListUsersQuery): Promise<AdminListUsersResponse> {
		const page = await this.adminRepository.listUsers(query);

		return {
			items: page.items.map(mapAdminUserSummary),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listUserPages(
		userId: string,
		query: AdminUserPagesQuery,
	): Promise<AdminUserPagesResponse> {
		const page = await this.adminRepository.listUserPages(userId, query);

		return {
			items: page.items.map(mapAdminUserPage),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listUserProjects(
		userId: string,
		query: AdminUserProjectsQuery,
	): Promise<AdminUserProjectsResponse> {
		const offset = (query.page - 1) * query.pageSize;
		const order = query.sort === "oldest" ? "asc" : "desc";
		const [projects, total] = await Promise.all([
			this.adminRepository.listUserProjects(userId, {
				limit: query.pageSize,
				offset,
				order,
			}),
			this.adminRepository.countUserProjects(userId),
		]);

		return {
			items: projects.map(mapAdminUserProject),
			page: query.page,
			pageSize: query.pageSize,
			total,
		};
	}

	async getUserDetail(userId: string): Promise<AdminUserDetail> {
		// One repeatable-read snapshot for the financial reads: the money numbers on
		// the detail card can never mix two moments of the ledger.
		return this.adminRepository.readTransaction(async (tx) => {
			const row = await this.adminRepository.findUserDetail(userId, tx);

			if (!row) {
				throw new NotFoundException();
			}

			const adminViewsPromise =
				normalizeStoredRole(row.role) === "support"
					? this.adminViewGrantsRepository
							.findViews(userId, tx)
							.then(filterKnownAdminViews)
					: Promise.resolve(null);
			const [
				subscription,
				projects,
				creditLedger,
				memberships,
				aiSpend,
				adminViews,
			] = await Promise.all([
				this.adminRepository.findLatestSubscription(userId, tx),
				this.adminRepository.listRecentProjects(
					userId,
					RECENT_PROJECTS_LIMIT,
					tx,
				),
				this.adminRepository.listRecentCreditLedger(
					userId,
					RECENT_LEDGER_LIMIT,
					tx,
				),
				this.adminOrganizationsRepository.listUserMemberships(userId, tx),
				this.adminRepository.sumAiSpendForUser(userId, tx),
				adminViewsPromise,
			]);

			return mapAdminUserDetail(
				row,
				subscription,
				projects,
				creditLedger,
				memberships,
				aiSpend,
				adminViews,
			);
		});
	}

	/**
	 * Adds promo credits to a user's personal wallet.
	 * `actor` is the signed-in staff account. Its id goes to `meta.grantedBy` for the grant log.
	 * Throws 400 when a non-admin staff account targets its own account.
	 */
	async grantCredits(
		actor: Pick<AuthUser, "id" | "role">,
		userId: string,
		input: AdminGrantCreditsInput,
	): Promise<AdminUserDetail> {
		await this.ensureUserExists(userId);

		// Support can grant credits to customers, but not to its own account. Admins are exempt.
		if (!isAdminRole(actor.role) && actor.id === userId) {
			throw new BadRequestException(
				"Support accounts cannot grant credits to their own account",
			);
		}

		// The API amount is decimal credits; the ledger takes centi-credits.
		await this.creditsService.grant(
			userOwner(userId),
			creditsToCentiCredits(input.amount),
			{
				bucket: "promo",
				idempotencyKey: `admin-grant:${userId}:${input.requestId}`,
				meta: {
					reason: "admin_grant",
					grantedBy: actor.id,
					note: input.reason ?? null,
				},
			},
		);

		this.logger.log(
			`admin_grant_credits admin=${actor.id} role=${normalizeStoredRole(actor.role)} target=${userId} amountCredits=${input.amount}`,
		);

		return this.getUserDetail(userId);
	}

	/**
	 * Gives the Starter pass to the personal pool, with source `admin`. Returns the live pass.
	 * A pool that already has a live pass keeps it: the call returns that pass and writes nothing.
	 * Throws 404 for an unknown user, and 400 when a non-admin staff account targets its own account.
	 */
	async grantStarterPass(
		actor: Pick<AuthUser, "id" | "role">,
		userId: string,
		input: AdminStarterPassBody,
	): Promise<AdminStarterPassResponse> {
		await this.ensureUserExists(userId);

		// Same rule as the credit grant: support cannot unlock its own credits. Admins are exempt.
		if (!isAdminRole(actor.role) && actor.id === userId) {
			throw new BadRequestException(
				"Support accounts cannot grant the Starter pass to their own account",
			);
		}

		const owner = userOwner(userId);
		// The balance lock serializes this write with the receipt grant, the reverse, and the dispute paths.
		const result = await this.adminRepository.withCreditOwnerLock(
			owner,
			async (tx) => {
				const live = await this.starterPasses.findLive(owner, tx);

				if (live) {
					return { pass: live, granted: false };
				}

				const granted = await this.starterPasses.grantIfAbsent(
					owner,
					{ source: "admin", grantedByUserId: actor.id, note: input.note },
					tx,
				);

				// Null means a writer without the owner lock inserted a pass after the read above.
				if (!granted) {
					throw new ConflictException(
						"The Starter pass changed during the grant. Try again",
					);
				}

				return { pass: granted, granted: true };
			},
		);

		this.logger.log(
			`admin_grant_starter_pass admin=${actor.id} role=${normalizeStoredRole(actor.role)} target=${userId} pass=${result.pass.id} granted=${result.granted}`,
		);

		return { starterPass: mapAdminStarterPass(result.pass) };
	}

	/**
	 * Revokes the live Starter pass of the personal pool. The reason is `admin:{note}`.
	 * A pool with no live pass is a no-op. The answer is always `{ starterPass: null }`.
	 * Throws 404 for an unknown user.
	 */
	async revokeStarterPass(
		actor: Pick<AuthUser, "id" | "role">,
		userId: string,
		input: AdminStarterPassBody,
	): Promise<AdminStarterPassResponse> {
		await this.ensureUserExists(userId);

		const owner = userOwner(userId);
		// The balance lock serializes this write with the receipt grant, the reverse, and the dispute paths.
		const revoked = await this.adminRepository.withCreditOwnerLock(
			owner,
			(tx) =>
				this.starterPasses.revokeLive(
					owner,
					{ revokedByUserId: actor.id, reason: `admin:${input.note}` },
					tx,
				),
		);

		this.logger.log(
			`admin_revoke_starter_pass admin=${actor.id} role=${normalizeStoredRole(actor.role)} target=${userId} pass=${revoked?.id ?? "none"}`,
		);

		return { starterPass: null };
	}

	async setRole(
		actingAdminId: string,
		userId: string,
		input: AdminSetRoleInput,
	): Promise<AdminUserDetail> {
		if (actingAdminId === userId) {
			throw new BadRequestException("Admins cannot change their own role");
		}
		const normalizedViews =
			input.views === undefined
				? undefined
				: (filterKnownAdminViews(input.views) ?? []);

		await this.adminRepository.withUserTransaction(
			userId,
			async (tx: AdminTransaction) => {
				const target = await this.adminRepository.findUserAccess(userId, tx);

				if (!target) {
					throw new NotFoundException();
				}

				await this.adminRepository.updateUserRole(userId, input.role, tx);

				if (input.role === "support") {
					if (normalizedViews !== undefined) {
						await this.adminViewGrantsRepository.upsertViews(
							userId,
							normalizedViews,
							actingAdminId,
							tx,
						);
					}
				} else {
					await this.adminViewGrantsRepository.deleteViews(userId, tx);
				}
			},
		);

		this.logger.log(
			`admin_set_role admin=${actingAdminId} target=${userId} role=${input.role}${normalizedViews === undefined ? "" : ` views=${JSON.stringify(normalizedViews)}`}`,
		);

		return this.getUserDetail(userId);
	}

	async setAdminViews(
		actingAdminId: string,
		userId: string,
		input: AdminSetAdminViewsInput,
	): Promise<AdminUserDetail> {
		const normalizedViews = filterKnownAdminViews(input.views) ?? [];

		await this.adminRepository.withUserTransaction(
			userId,
			async (tx: AdminTransaction) => {
				const target = await this.adminRepository.findUserAccess(userId, tx);

				if (!target) {
					throw new NotFoundException();
				}

				if (normalizeStoredRole(target.role) !== "support") {
					throw new BadRequestException(
						"Only support accounts have admin views",
					);
				}

				await this.adminViewGrantsRepository.upsertViews(
					userId,
					normalizedViews,
					actingAdminId,
					tx,
				);
			},
		);

		this.logger.log(
			`admin_set_admin_views admin=${actingAdminId} target=${userId} views=${JSON.stringify(normalizedViews)}`,
		);

		return this.getUserDetail(userId);
	}

	async setBanned(
		actingAdminId: string,
		userId: string,
		input: AdminSetBannedInput,
	): Promise<AdminUserDetail> {
		const target = await this.adminRepository.findUserAccess(userId);

		if (!target) {
			throw new NotFoundException();
		}

		if (input.banned && isStaffRole(target.role)) {
			throw new BadRequestException("Staff accounts cannot be banned");
		}

		await this.adminRepository.setUserBanned(
			userId,
			input.banned,
			input.reason ?? null,
		);

		if (input.banned) {
			// Remove durable sessions. A signed session cache can remain valid for
			// up to five minutes, then the missing Postgres row enforces the ban.
			await this.adminRepository.deleteUserSessions(userId);
			// The MCP grants go too. Without this, an agent that a thief connected works again after an unban.
			await this.adminRepository.deleteUserOAuthGrants(userId);
		}

		this.logger.log(
			`admin_set_banned admin=${actingAdminId} target=${userId} banned=${input.banned}`,
		);

		return this.getUserDetail(userId);
	}

	private async ensureUserExists(userId: string): Promise<void> {
		const target = await this.adminRepository.findUserAccess(userId);

		if (!target) {
			throw new NotFoundException();
		}
	}
}

export function mapAdminUserPage(row: AdminUserPageRow): AdminUserPage {
	const published = row.activeDeploymentSlug !== null;
	const liveUrl = published
		? `https://${row.activeDeploymentSlug}.${env.SITES_DOMAIN}`
		: null;
	const primaryDomain =
		row.primaryDomainName !== null && row.primaryDomainStatus !== null
			? {
					name: row.primaryDomainName,
					status: row.primaryDomainStatus,
				}
			: null;

	return {
		project: {
			id: row.projectId,
			name: row.projectName,
			organizationId: row.organizationId,
			previewImageUrl: row.previewImageUrl,
			createdAt: row.projectCreatedAt.toISOString(),
			updatedAt: toIso(row.projectUpdatedAt),
		},
		page: {
			activeVersion:
				row.activeVersionId !== null &&
				row.activeVersionNumber !== null &&
				row.activeVersionCreatedAt !== null
					? {
							id: row.activeVersionId,
							number: row.activeVersionNumber,
							createdAt: row.activeVersionCreatedAt.toISOString(),
						}
					: null,
			latestGeneration:
				row.latestGenerationStatus !== null &&
				row.latestGenerationCreatedAt !== null
					? {
							status: row.latestGenerationStatus,
							createdAt: row.latestGenerationCreatedAt.toISOString(),
							completedAt:
								row.latestGenerationCompletedAt?.toISOString() ?? null,
						}
					: null,
		},
		deployment: {
			published,
			latestStatus: row.latestDeploymentStatus,
			slug: row.activeDeploymentSlug,
			liveUrl,
			publicUrl:
				published && primaryDomain
					? `https://${canonicalDomainHost(primaryDomain.name)}`
					: liveUrl,
			publishedAt: row.activeDeploymentUpdatedAt?.toISOString() ?? null,
		},
		primaryDomain,
	};
}

// Raw SQL expressions can surface as Date or string depending on pg parsers.
function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}
