import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AdminBetaEnrollInput,
	type AdminGrantCreditsInput,
	type AdminListUsersQuery,
	type AdminListUsersResponse,
	type AdminSetAccessInput,
	type AdminSetBannedInput,
	type AdminSetRoleInput,
	type AdminUserDetail,
	isAdminRole,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import {
	mapAdminUserDetail,
	mapAdminUserSummary,
} from "../../infrastructure/mappers/admin-user.mapper";
import { AdminOrganizationsRepository } from "../../infrastructure/persistence/admin-organizations.repository";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import { BetaAccessService } from "./beta-access.service";

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
		@Inject(BetaAccessService)
		private readonly betaAccessService: BetaAccessService,
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

	async getUserDetail(userId: string): Promise<AdminUserDetail> {
		const row = await this.adminRepository.findUserDetail(userId);

		if (!row) {
			throw new NotFoundException();
		}

		const [subscription, projects, creditLedger, memberships] =
			await Promise.all([
				this.adminRepository.findLatestSubscription(userId),
				this.adminRepository.listRecentProjects(userId, RECENT_PROJECTS_LIMIT),
				this.adminRepository.listRecentCreditLedger(
					userId,
					RECENT_LEDGER_LIMIT,
				),
				this.adminOrganizationsRepository.listUserMemberships(userId),
			]);

		return mapAdminUserDetail(
			row,
			subscription,
			projects,
			creditLedger,
			memberships,
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

	async betaEnroll(
		actingAdminId: string,
		userId: string,
		input: AdminBetaEnrollInput,
	): Promise<AdminUserDetail> {
		await this.betaAccessService.enroll(actingAdminId, userId, input);

		this.logger.log(
			`admin_beta_enroll admin=${actingAdminId} target=${userId} credits=${input.credits}`,
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

	async setAccess(
		actingAdminId: string,
		userId: string,
		input: AdminSetAccessInput,
	): Promise<AdminUserDetail> {
		await this.betaAccessService.setAccess(
			actingAdminId,
			userId,
			input.granted,
		);

		this.logger.log(
			`admin_set_access admin=${actingAdminId} target=${userId} granted=${input.granted}`,
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
