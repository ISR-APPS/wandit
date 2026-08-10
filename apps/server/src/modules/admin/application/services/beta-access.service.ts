import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	type AdminBetaEnrollInput,
	type AdminBulkSetAccessInput,
	type AdminBulkSetAccessResult,
	type AdminBulkSetAccessUserResult,
	isAdminRole,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";

@Injectable()
export class BetaAccessService {
	private readonly logger = new Logger(BetaAccessService.name);

	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	async enroll(
		actingAdminId: string,
		userId: string,
		input: AdminBetaEnrollInput,
	): Promise<void> {
		await this.adminRepository.withUserTransaction(userId, async (tx) => {
			await this.requireUser(userId, tx);

			const grant = await this.creditsService.grantWithReplayStatus(
				userOwner(userId),
				input.credits,
				{
					bucket: "promo",
					idempotencyKey: `beta-enroll:${userId}:${input.idempotencyKey}`,
					meta: {
						grantedBy: actingAdminId,
						note: input.reason,
						reason: "beta_enroll",
					},
				},
				tx,
			);

			if (grant.replayed) {
				return;
			}

			await this.adminRepository.setUserEarlyAccess(userId, true, tx);
			await this.adminRepository.insertBetaAccessEvent(
				{
					action: "granted",
					actorUserId: actingAdminId,
					reason: input.reason,
					userId,
				},
				tx,
			);
		});
	}

	async setAccess(
		actingAdminId: string,
		userId: string,
		granted: boolean,
	): Promise<void> {
		await this.adminRepository.withUserTransaction(userId, async (tx) => {
			await this.requireUser(userId, tx);
			await this.adminRepository.setUserEarlyAccess(userId, granted, tx);
			await this.adminRepository.insertBetaAccessEvent(
				{
					action: granted ? "granted" : "revoked",
					actorUserId: actingAdminId,
					reason: "manual_admin_access",
					userId,
				},
				tx,
			);
		});
	}

	async bulkSetAccess(
		actingAdminId: string,
		input: AdminBulkSetAccessInput,
	): Promise<AdminBulkSetAccessResult> {
		const result: AdminBulkSetAccessResult = {
			updated: 0,
			skipped: 0,
			failed: 0,
			results: [],
		};

		for (const userId of new Set(input.userIds)) {
			try {
				const userResult = await this.setBulkUserAccess(
					actingAdminId,
					userId,
					input.granted,
				);
				result.results.push(userResult);

				if (userResult.status === "skipped") {
					result.skipped += 1;
				} else if (userResult.status === "failed") {
					result.failed += 1;
				} else {
					result.updated += 1;
				}
			} catch (error) {
				this.logger.error(
					`admin_bulk_set_access_failed target=${userId}`,
					error instanceof Error ? error.stack : String(error),
				);
				result.failed += 1;
				result.results.push({ userId, status: "failed", reason: "error" });
			}
		}

		return result;
	}

	private setBulkUserAccess(
		actingAdminId: string,
		userId: string,
		granted: boolean,
	): Promise<AdminBulkSetAccessUserResult> {
		return this.adminRepository.withUserTransaction(userId, async (tx) => {
			const target = await this.adminRepository.findUserAccess(userId, tx);

			if (!target) {
				return { userId, status: "failed", reason: "not_found" };
			}

			if (isAdminRole(target.role)) {
				return { userId, status: "skipped", reason: "admin_role" };
			}

			if (target.earlyAccess === granted) {
				return {
					userId,
					status: "skipped",
					reason: granted ? "already_granted" : "already_revoked",
				};
			}

			await this.adminRepository.setUserEarlyAccess(userId, granted, tx);
			await this.adminRepository.insertBetaAccessEvent(
				{
					action: granted ? "granted" : "revoked",
					actorUserId: actingAdminId,
					reason: "manual_admin_access",
					userId,
				},
				tx,
			);

			return { userId, status: granted ? "granted" : "revoked" };
		});
	}

	private async requireUser(
		userId: string,
		transaction: Parameters<AdminRepository["findUserAccess"]>[1],
	): Promise<void> {
		const target = await this.adminRepository.findUserAccess(
			userId,
			transaction,
		);

		if (!target) {
			throw new NotFoundException();
		}
	}
}
