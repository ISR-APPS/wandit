import { Inject, Injectable } from "@nestjs/common";

import { normalizeAffiliateEmail } from "../../domain/affiliate-email";
import {
	AffiliatesRepository,
	type AffiliateTransaction,
} from "../../infrastructure/persistence/affiliates.repository";

@Injectable()
export class AffiliateSelfReferralService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
	) {}

	recheckAffiliate(affiliateId: string): Promise<{ flagged: number }> {
		return this.affiliatesRepository.withAffiliateLock(affiliateId, (tx) =>
			this.recheckInTransaction(affiliateId, tx),
		);
	}

	/** Runs an affiliate identity mutation and its fraud recheck atomically. */
	mutateAndRecheckAffiliate<T>(
		affiliateId: string,
		operation: (tx: AffiliateTransaction) => Promise<T | null>,
	): Promise<T | null> {
		return this.affiliatesRepository.withAffiliateLock(
			affiliateId,
			async (tx) => {
				const result = await operation(tx);

				if (result !== null) {
					await this.recheckInTransaction(affiliateId, tx);
				}

				return result;
			},
		);
	}

	private async recheckInTransaction(
		affiliateId: string,
		tx: AffiliateTransaction,
	): Promise<{ flagged: number }> {
		const affiliate =
			await this.affiliatesRepository.affiliateIdentityForSelfCheck(
				affiliateId,
				tx,
			);

		if (!affiliate) {
			return { flagged: 0 };
		}

		const attributions =
			await this.affiliatesRepository.attributedUsersForSelfCheck(
				affiliateId,
				tx,
			);
		let flagged = 0;

		for (const attribution of attributions) {
			if (affiliate.userId === attribution.userId) {
				await this.affiliatesRepository.appendFraudFlag(
					attribution.attributionId,
					"self_referral_user_id",
					tx,
				);
				flagged += 1;
			}

			if (
				normalizeAffiliateEmail(affiliate.email) ===
				normalizeAffiliateEmail(attribution.email)
			) {
				await this.affiliatesRepository.appendFraudFlag(
					attribution.attributionId,
					"self_referral_email",
					tx,
				);
				flagged += 1;
			}
		}

		return { flagged };
	}
}
