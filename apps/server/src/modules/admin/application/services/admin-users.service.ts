import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AdminGrantCreditsInput,
	type AdminListUsersQuery,
	type AdminListUsersResponse,
	type AdminSetBannedInput,
	type AdminSetRoleInput,
	type AdminUserDetail,
	type AdminUserPage,
	type AdminUserPagesQuery,
	type AdminUserPagesResponse,
	type AdminUserProjectsQuery,
	type AdminUserProjectsResponse,
	isAdminRole,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import { canonicalDomainHost } from "../../../domains/domain/domain-hosts";
import {
	mapAdminUserDetail,
	mapAdminUserProject,
	mapAdminUserSummary,
} from "../../infrastructure/mappers/admin-user.mapper";
import {
	AdminRepository,
	type AdminUserPageRow,
} from "../../infrastructure/persistence/admin.repository";
import { AdminOrganizationsRepository } from "../../infrastructure/persistence/admin-organizations.repository";

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
		const row = await this.adminRepository.findUserDetail(userId);

		if (!row) {
			throw new NotFoundException();
		}

		const [subscription, projects, creditLedger, memberships, aiSpend] =
			await Promise.all([
				this.adminRepository.findLatestSubscription(userId),
				this.adminRepository.listRecentProjects(userId, RECENT_PROJECTS_LIMIT),
				this.adminRepository.listRecentCreditLedger(
					userId,
					RECENT_LEDGER_LIMIT,
				),
				this.adminOrganizationsRepository.listUserMemberships(userId),
				this.adminRepository.sumAiSpendForUser(userId),
			]);

		return mapAdminUserDetail(
			row,
			subscription,
			projects,
			creditLedger,
			memberships,
			aiSpend,
		);
	}

	async grantCredits(
		actingAdminId: string,
		userId: string,
		input: AdminGrantCreditsInput,
	): Promise<AdminUserDetail> {
		await this.ensureUserExists(userId);

		await this.creditsService.grant(userOwner(userId), input.amount, {
			bucket: "promo",
			idempotencyKey: `admin-grant:${userId}:${input.requestId}`,
			meta: {
				reason: "admin_grant",
				grantedBy: actingAdminId,
				note: input.reason ?? null,
			},
		});

		this.logger.log(
			`admin_grant_credits admin=${actingAdminId} target=${userId} amount=${input.amount}`,
		);

		return this.getUserDetail(userId);
	}

	async setRole(
		actingAdminId: string,
		userId: string,
		input: AdminSetRoleInput,
	): Promise<AdminUserDetail> {
		if (actingAdminId === userId) {
			throw new BadRequestException("Admins cannot change their own role");
		}

		await this.ensureUserExists(userId);
		await this.adminRepository.updateUserRole(userId, input.role);

		this.logger.log(
			`admin_set_role admin=${actingAdminId} target=${userId} role=${input.role}`,
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

		if (input.banned && isAdminRole(target.role)) {
			throw new BadRequestException("Admins cannot be banned");
		}

		await this.adminRepository.setUserBanned(
			userId,
			input.banned,
			input.reason ?? null,
		);

		if (input.banned) {
			// Kill live sessions so the ban takes effect immediately.
			await this.adminRepository.deleteUserSessions(userId);
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
