import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
	AFFILIATE_ATTRIBUTION_COOKIE_NAME,
	AFFILIATE_SIGNUP_TOKEN_FIELD,
} from "@wandit/contracts";
import {
	AFFILIATE_ATTRIBUTION_RETRY_JOB,
	AFFILIATE_MAINTENANCE_QUEUE,
	type AffiliateAttributionRetryJobData,
} from "@wandit/jobs";
import type { GenericEndpointContext, User } from "better-auth";
import type { Queue } from "bullmq";

import { normalizeAffiliateEmail } from "../../domain/affiliate-email";
import type { AffiliateFraudFlag } from "../../domain/affiliate-fraud";
import type { AffiliateAttributionTokenPayload } from "../../domain/affiliate-token";
import {
	type AffiliateAttributionRow,
	type AffiliateLinkTerms,
	AffiliatesRepository,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateCommissionService } from "./affiliate-commission.service";
import { AffiliateTokenService } from "./affiliate-token.service";

const DAY_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class AffiliateAttributionService {
	private readonly logger = new Logger(AffiliateAttributionService.name);

	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
		@Inject(AffiliateTokenService)
		private readonly tokenService: AffiliateTokenService,
		@Inject(AffiliateCommissionService)
		private readonly commissionService: AffiliateCommissionService,
		@Optional()
		@InjectQueue(AFFILIATE_MAINTENANCE_QUEUE)
		private readonly maintenanceQueue?: Queue<
			AffiliateAttributionRetryJobData,
			unknown,
			string
		>,
	) {}

	async lockForCreatedUser(
		newUser: Pick<User, "email" | "id">,
		ctx: GenericEndpointContext | null,
		nowOverride?: Date,
	): Promise<AffiliateAttributionRow | null> {
		const cookieToken = ctx?.getCookie(AFFILIATE_ATTRIBUTION_COOKIE_NAME);
		const bodyToken = this.signupBodyToken(ctx?.body);
		const cookiePayload = cookieToken
			? this.tokenService.verify(cookieToken)
			: null;
		const bodyPayload = bodyToken ? this.tokenService.verify(bodyToken) : null;
		const payload = cookiePayload ?? bodyPayload;
		const source = cookiePayload ? "signup_cookie" : "signup_body";
		const token = cookiePayload ? cookieToken : bodyToken;

		if (!payload || !token) {
			return null;
		}

		let enqueueError: unknown;
		let retryQueued = false;

		try {
			retryQueued = await this.enqueueRetry({
				source,
				token,
				userId: newUser.id,
			});
		} catch (error) {
			enqueueError = error;
			this.logger.error(
				`Affiliate attribution retry enqueue failed for user ${newUser.id}`,
				error instanceof Error ? error.stack : String(error),
			);
		}

		try {
			return await this.lockVerifiedPayload(
				newUser,
				payload,
				source,
				nowOverride,
			);
		} catch (lockError) {
			if (enqueueError) {
				throw new AggregateError(
					[enqueueError, lockError],
					`Affiliate attribution lock and durable retry both failed for user ${newUser.id}`,
				);
			}

			this.logger.error(
				retryQueued
					? `Inline affiliate attribution failed for user ${newUser.id}; durable retry is queued`
					: `Inline affiliate attribution failed for user ${newUser.id}; no durable retry queue is available`,
				lockError instanceof Error ? lockError.stack : String(lockError),
			);
			return null;
		}
	}

	async retryLockFromJob(
		input: AffiliateAttributionRetryJobData,
		nowOverride?: Date,
	): Promise<AffiliateAttributionRow | null> {
		const newUser = await this.affiliatesRepository.findUserIdentity(
			input.userId,
		);

		if (!newUser) {
			throw new Error(
				`Affiliate attribution retry user ${input.userId} does not exist yet`,
			);
		}

		const payload = this.tokenService.verify(input.token);

		if (!payload) {
			return null;
		}

		return this.lockVerifiedPayload(
			newUser,
			payload,
			input.source,
			nowOverride,
		);
	}

	private async lockVerifiedPayload(
		newUser: Pick<User, "email" | "id">,
		payload: AffiliateAttributionTokenPayload,
		source: "signup_body" | "signup_cookie",
		nowOverride?: Date,
	): Promise<AffiliateAttributionRow | null> {
		const clickedAt = new Date(payload.issuedAt * 1_000);
		const attribution = await this.affiliatesRepository.withAttributionLock(
			newUser.id,
			async (tx) => {
				const existing =
					await this.affiliatesRepository.lockAttributionByUserId(
						newUser.id,
						tx,
					);

				if (existing) {
					return existing;
				}

				const initialLink = await this.affiliatesRepository.findLinkTerms(
					payload.linkCode,
					tx,
				);

				if (!initialLink) {
					return null;
				}

				// Serialize the snapshot/self-check with admin identity edits. Re-read
				// after the affiliate lock so both sides observe one another's commit.
				await this.affiliatesRepository.lockAffiliate(
					initialLink.affiliateId,
					tx,
				);
				const link = await this.affiliatesRepository.findLinkTerms(
					payload.linkCode,
					tx,
					true,
				);
				// Production samples the timestamp only after both serialization locks
				// and the fresh terms read. Tests may provide a deterministic override.
				const lockedAt = nowOverride ?? new Date();

				if (
					!link ||
					link.affiliateId !== initialLink.affiliateId ||
					!this.isValidAtLock(link, clickedAt, lockedAt)
				) {
					return null;
				}

				const fraudFlags = this.selfReferralFlags(link, newUser, lockedAt);

				const inserted =
					await this.affiliatesRepository.insertAttributionFirstWins(
						{
							affiliateId: link.affiliateId,
							clickedAt,
							commissionDurationMonths: link.durationMonths,
							commissionRateBps: link.rateBps,
							fixedAmountCents: link.fixedAmountCents,
							fixedCurrency: link.fixedCurrency?.toLowerCase() ?? null,
							fraudFlags,
							linkId: link.id,
							lockedAt,
							programId: link.programId,
							programKind: link.programKind,
							source,
							userId: newUser.id,
						},
						tx,
					);

				return (
					inserted ??
					this.affiliatesRepository.findAttributionByUserId(newUser.id, tx)
				);
			},
		);

		if (attribution) {
			await this.commissionService.reconcileCandidatesForUser(newUser.id);
		}

		return attribution;
	}

	private async enqueueRetry(
		data: AffiliateAttributionRetryJobData,
	): Promise<boolean> {
		if (!this.maintenanceQueue) {
			this.logger.warn(
				`Affiliate attribution retry skipped for user ${data.userId}: queue is disabled`,
			);
			return false;
		}

		await this.maintenanceQueue.add(AFFILIATE_ATTRIBUTION_RETRY_JOB, data, {
			attempts: 12,
			backoff: { delay: 60_000, type: "exponential" },
			jobId: `affiliate-attribution-${encodeURIComponent(data.userId)}`,
			removeOnComplete: true,
			removeOnFail: 1_000,
		});

		return true;
	}

	private signupBodyToken(body: unknown): string | null {
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return null;
		}

		const value = (body as Record<string, unknown>)[
			AFFILIATE_SIGNUP_TOKEN_FIELD
		];

		return typeof value === "string" && value.length <= 4_096 ? value : null;
	}

	private isValidAtLock(
		link: AffiliateLinkTerms,
		clickedAt: Date,
		now: Date,
	): boolean {
		if (
			!link.active ||
			link.affiliateStatus !== "active" ||
			link.programStatus !== "active" ||
			clickedAt.getTime() > now.getTime() ||
			now.getTime() - clickedAt.getTime() >= link.cookieWindowDays * DAY_MS
		) {
			return false;
		}

		return link.expiresAt === null
			? true
			: clickedAt < link.expiresAt && now < link.expiresAt;
	}

	private selfReferralFlags(
		link: AffiliateLinkTerms,
		newUser: Pick<User, "email" | "id">,
		now: Date,
	): AffiliateFraudFlag[] {
		const flags: AffiliateFraudFlag[] = [];
		const add = (code: AffiliateFraudFlag["code"]) => {
			flags.push({
				code,
				detectedAt: now.toISOString(),
				resolvedAt: null,
				resolvedByUserId: null,
			});
		};

		if (link.affiliateUserId === newUser.id) {
			add("self_referral_user_id");
		}

		if (
			normalizeAffiliateEmail(link.affiliateEmail) ===
			normalizeAffiliateEmail(newUser.email)
		) {
			add("self_referral_email");
		}

		return flags;
	}
}
