import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminBetaEnrollInput } from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";

@Injectable()
export class BetaAccessService {
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
				userId,
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
