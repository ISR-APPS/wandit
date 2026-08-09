import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { BuildAffiliatePayoutInput } from "@wandit/contracts";

import {
	AffiliatePayoutConflictError,
	AffiliatePayoutIneligibleError,
	type AffiliatePayoutRow,
	AffiliatesRepository,
} from "../../infrastructure/persistence/affiliates.repository";

@Injectable()
export class AffiliatePayoutService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
	) {}

	async build(
		input: BuildAffiliatePayoutInput,
		createdByUserId: string,
	): Promise<AffiliatePayoutRow> {
		try {
			return await this.affiliatesRepository.withPayoutLock(
				input.affiliateId,
				input.currency,
				async (tx) => {
					const replay = await this.affiliatesRepository.findPayoutByRequestId(
						input.requestId,
						tx,
					);

					if (replay) {
						if (
							replay.affiliateId !== input.affiliateId ||
							replay.currency !== input.currency
						) {
							throw new ConflictException(
								"Affiliate payout requestId replay payload mismatch",
							);
						}

						return replay;
					}

					const entries =
						await this.affiliatesRepository.lockEligiblePayoutEntries(
							input.affiliateId,
							input.currency,
							tx,
						);
					const method = await this.affiliatesRepository.affiliatePayoutMethod(
						input.affiliateId,
						tx,
					);

					if (!method) {
						throw new NotFoundException("Affiliate not found");
					}

					const totalCents = entries.reduce(
						(sum, entry) => sum + entry.amountCents,
						0,
					);

					if (totalCents <= 0) {
						throw new ForbiddenException(
							"Affiliate payout balance must be greater than zero",
						);
					}

					const createdTimes = entries.map((entry) =>
						entry.createdAt.getTime(),
					);
					const payout = await this.affiliatesRepository.createPayout(
						{
							affiliateId: input.affiliateId,
							createdByUserId,
							currency: input.currency,
							method,
							periodEnd: new Date(Math.max(...createdTimes)),
							periodStart: new Date(Math.min(...createdTimes)),
							requestId: input.requestId,
							totalCents,
						},
						tx,
					);
					const claimed = await this.affiliatesRepository.claimPayoutEntries(
						entries.map((entry) => entry.id),
						input.affiliateId,
						input.currency,
						payout.id,
						tx,
					);

					if (claimed.length !== entries.length) {
						throw new ConflictException(
							"Affiliate payout entries changed while being claimed",
						);
					}

					return payout;
				},
			);
		} catch (error) {
			if (!this.isUniqueViolation(error)) {
				throw error;
			}

			const replay = await this.affiliatesRepository.findPayoutByRequestId(
				input.requestId,
			);

			if (
				replay?.affiliateId === input.affiliateId &&
				replay.currency === input.currency
			) {
				return replay;
			}

			throw new ConflictException(
				"Affiliate payout requestId replay payload mismatch",
			);
		}
	}

	async markPaid(
		payoutId: string,
		externalRef: string,
	): Promise<AffiliatePayoutRow> {
		const payout = await this.affiliatesRepository.getPayout(payoutId);

		if (!payout) {
			throw new NotFoundException("Affiliate payout not found");
		}

		let updated: AffiliatePayoutRow | null;

		try {
			updated = await this.affiliatesRepository.markPayoutPaid({
				externalRef,
				method: payout.method,
				paidAt: new Date(),
				payoutId,
			});
		} catch (error) {
			if (error instanceof AffiliatePayoutIneligibleError) {
				throw new ConflictException(
					"Affiliate payout entries are no longer eligible",
				);
			}

			if (error instanceof AffiliatePayoutConflictError) {
				throw new ConflictException(error.message);
			}

			if (this.isUniqueViolation(error)) {
				throw new ConflictException(
					"Affiliate payout external reference is already in use",
				);
			}

			throw error;
		}

		if (!updated) {
			throw new NotFoundException("Affiliate payout not found");
		}

		return updated;
	}

	async markFailed(
		payoutId: string,
		_reason?: string,
	): Promise<AffiliatePayoutRow> {
		let payout: AffiliatePayoutRow | null;

		try {
			payout = await this.affiliatesRepository.failAndReleasePayout(payoutId);
		} catch (error) {
			if (error instanceof AffiliatePayoutConflictError) {
				throw new ConflictException(error.message);
			}

			throw error;
		}

		if (!payout) {
			throw new NotFoundException("Affiliate payout not found");
		}

		return payout;
	}

	private isUniqueViolation(error: unknown): boolean {
		return (
			error !== null &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: unknown }).code === "23505"
		);
	}
}
