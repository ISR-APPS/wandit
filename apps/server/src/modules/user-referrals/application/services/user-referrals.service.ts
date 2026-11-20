/**
 * The user referral program: a user invites friends, and both get promo credits.
 * UserReferralsController calls `getSummary` and `claim`. The Trigger task `user-referral-sweep` calls `runSweep`.
 * It reads and writes through UserReferralsRepository, grants through CreditsService,
 * and reads the switch and the amounts from ProductSettingsService.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type ClaimUserReferralResponse,
	centiCreditsToCredits,
	USER_REFERRAL_ACTIVATION_CAP,
	type UserReferralSummary,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { UserReferralsDisabledError } from "../../domain/errors/user-referrals-disabled.error";
import {
	claimRejectionReason,
	friendDisplayName,
	generateUserReferralCode,
	isRewardDue,
	referrerRewardCentiCredits,
	USER_REFERRAL_ACTIVATION_MIN_CENTI_CREDITS,
	USER_REFERRAL_ACTIVATION_WINDOW_MS,
	USER_REFERRAL_PAID_HOLD_MS,
	type UserReferralReward,
	userReferralStatus,
} from "../../domain/user-referral-rules";
import {
	type UserReferralCursor,
	type UserReferralPageRow,
	type UserReferralRow,
	UserReferralsRepository,
	type UserReferralsTransaction,
} from "../../infrastructure/persistence/user-referrals.repository";

// LIMIT: the list shows the newest 50 friends, with no pagination. Upgrade: a cursor on (created_at, id).
const FRIENDS_LIST_LIMIT = 50;

/** Rows per keyset page of the sweep. Keeps each query and each page in memory small. */
const SWEEP_PAGE_SIZE = 500;

// 32^8 codes exist, so a taken code is rare. Five new codes in a row never all conflict in practice.
const CODE_ATTEMPTS = 5;

const REWARDS = [
	"friend",
	"activation",
	"paid",
] as const satisfies readonly UserReferralReward[];

/** The repository methods. The spec passes an in-memory fake with the same methods. */
export type UserReferralsStore = Pick<
	UserReferralsRepository,
	keyof UserReferralsRepository
>;

/** What one sweep did. The Trigger task writes it to its log. */
export type UserReferralSweepResult = {
	/** Referrals that got the activation mark in this run. */
	activated: number;
	/** Rewards that this run closed, with a grant or with a zero amount. */
	delivered: number;
};

/** The counters of a sweep in progress. `failed` counts the steps that threw. */
type SweepProgress = UserReferralSweepResult & { failed: number };

@Injectable()
export class UserReferralsService {
	private readonly logger = new Logger(UserReferralsService.name);

	constructor(
		@Inject(UserReferralsRepository)
		private readonly repository: UserReferralsStore,
		@Inject(CreditsService)
		private readonly credits: Pick<
			CreditsService,
			"grant" | "settledNetConsumedCentiCreditsByUser"
		>,
		@Inject(ProductSettingsService)
		private readonly settings: Pick<ProductSettingsService, "get">,
	) {}

	/**
	 * The invite code, the totals, and the newest friends of the user.
	 * The first call creates the code. Throws a 403 while the program is off.
	 */
	async getSummary(userId: string): Promise<UserReferralSummary> {
		const settings = await this.settings.get();

		// Kill switch: an admin turns the program off in the product settings.
		if (!settings.userReferralsEnabled) {
			throw new UserReferralsDisabledError();
		}

		const code = await this.ensureCode(userId);
		const [stats, friends] = await Promise.all([
			this.repository.getReferrerStats(userId),
			this.repository.listFriends(userId, FRIENDS_LIST_LIMIT),
		]);

		// Centi-credits to decimal credits: the API carries decimal credits.
		return {
			code,
			friends: friends.map(({ email, name, referral }) => {
				const rewards = referrerRewardCentiCredits(referral);

				return {
					displayName: friendDisplayName(name, email),
					earnedCredits: centiCreditsToCredits(rewards.earned),
					id: referral.id,
					joinedAt: referral.createdAt.toISOString(),
					pendingCredits: centiCreditsToCredits(rewards.pending),
					status: userReferralStatus(referral),
				};
			}),
			stats: {
				activatedCount: stats.activatedCount,
				earnedCredits: centiCreditsToCredits(stats.earnedCentiCredits),
				joinedCount: stats.joinedCount,
				pendingCredits: centiCreditsToCredits(stats.pendingCentiCredits),
				subscribedCount: stats.subscribedCount,
			},
		};
	}

	/**
	 * Links the caller to the owner of `code` and gives the caller the friend bonus.
	 * Each answer is a 200: `claimed` with the bonus, or `rejected` with the reason.
	 * A repeat claim for the same referrer answers `claimed` again and grants nothing new.
	 */
	async claim(
		userId: string,
		code: string,
		now: Date,
	): Promise<ClaimUserReferralResponse> {
		const settings = await this.settings.get();

		// Kill switch: no new referral while the program is off.
		if (!settings.userReferralsEnabled) {
			return { outcome: "rejected", reason: "disabled" };
		}

		// LIMIT: no same-IP rule and no device fingerprint. Carrier NAT in the target market gives
		// false positives. A person with several Google accounts can farm small rewards up to the cap.
		// Upgrade: a device signal at signup.
		const [referrerUserId, callerCreatedAt, existing, hasAffiliateAttribution] =
			await Promise.all([
				this.repository.findUserIdByCode(code),
				this.repository.findUserCreatedAt(userId),
				this.repository.findReferralByReferredUserId(userId),
				this.repository.hasAffiliateAttribution(userId),
			]);

		if (callerCreatedAt === null) {
			throw new Error(`User ${userId} has a session but no user row`);
		}

		if (referrerUserId === null) {
			return { outcome: "rejected", reason: "code_not_found" };
		}

		const reason = claimRejectionReason({
			callerCreatedAt,
			callerUserId: userId,
			existingReferrerUserId: existing?.referrerUserId ?? null,
			hasAffiliateAttribution,
			now,
			referrerUserId,
		});

		if (reason !== null) {
			return { outcome: "rejected", reason };
		}

		const referral =
			existing ??
			(await this.insertFirstWins({
				// The amounts are a snapshot: a later change of the settings does not change this referral.
				activationCredits: settings.userReferralActivationCredits,
				friendCredits: settings.userReferralFriendCredits,
				paidCredits: settings.userReferralPaidCredits,
				referredUserId: userId,
				referrerUserId,
			}));

		// A claim with a different code at the same time won the insert.
		if (referral.referrerUserId !== referrerUserId) {
			return { outcome: "rejected", reason: "already_referred" };
		}

		if (referral.friendGrantedAt === null) {
			try {
				await this.deliverReward(referral.id, "friend", now);
			} catch (error) {
				// The referral row is durable. The sweep delivers the bonus in at most 5 minutes.
				this.logger.error(
					`USER_REFERRAL_FRIEND_BONUS_FAILED referralId=${referral.id} userId=${userId}`,
					error instanceof Error ? error.stack : String(error),
				);
			}
		}

		// Centi-credits to decimal credits: the API carries decimal credits.
		return {
			friendCredits: centiCreditsToCredits(referral.friendCredits),
			outcome: "claimed",
		};
	}

	/**
	 * One run of the Trigger task `user-referral-sweep`, each 5 minutes.
	 * It marks first payments and activations, then delivers each due reward.
	 * Throws at the end when a step failed, so the Trigger run shows red and the next run tries again.
	 */
	async runSweep(now: Date): Promise<UserReferralSweepResult> {
		const progress: SweepProgress = { activated: 0, delivered: 0, failed: 0 };
		const settings = await this.settings.get();

		// Kill switch: while the program is off, the sweep marks nothing and pays nothing.
		if (!settings.userReferralsEnabled) {
			return { activated: 0, delivered: 0 };
		}

		// LIMIT: a chargeback after the 7-day hold leaves the paid reward with the referrer.
		// Upgrade: a revoke from the billing refund hook.
		await this.repository.markFirstPayments(now);

		// LIMIT: full candidate walk each 5 min. Upgrade: mark at settle.
		await this.forEachPage(
			(after) =>
				this.repository.listActivationCandidates({
					after,
					joinedAfter: new Date(
						now.getTime() - USER_REFERRAL_ACTIVATION_WINDOW_MS,
					),
					limit: SWEEP_PAGE_SIZE,
				}),
			(page) => this.markActivations(page, now, progress),
		);

		// This walk comes after the two marks. A reward that a mark made due then goes out in the same run.
		await this.forEachPage(
			(after) =>
				this.repository.listDueReferrals({
					after,
					limit: SWEEP_PAGE_SIZE,
					paidOnOrBefore: new Date(now.getTime() - USER_REFERRAL_PAID_HOLD_MS),
				}),
			(page) => this.deliverDueRewards(page, now, progress),
		);

		if (progress.failed > 0) {
			throw new Error(
				`User referral sweep left ${progress.failed} referral step(s) pending`,
			);
		}

		return { activated: progress.activated, delivered: progress.delivered };
	}

	/** Returns the code of the user. Creates it on the first call. */
	private async ensureCode(userId: string): Promise<string> {
		const existing = await this.repository.findCodeByUserId(userId);

		if (existing !== null) {
			return existing;
		}

		for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
			const code = await this.repository.saveCodeIfFree(
				userId,
				generateUserReferralCode(),
			);

			if (code !== null) {
				return code;
			}
		}

		throw new Error(
			`No free user referral code for user ${userId} after ${CODE_ATTEMPTS} attempts`,
		);
	}

	/** Inserts the referral row. When a claim of the same friend at the same time wins, returns that row. */
	private async insertFirstWins(
		input: Parameters<UserReferralsStore["insertReferral"]>[0],
	): Promise<UserReferralRow> {
		const inserted = await this.repository.insertReferral(input);

		if (inserted !== null) {
			return inserted;
		}

		const winner = await this.repository.findReferralByReferredUserId(
			input.referredUserId,
		);

		if (winner === null) {
			throw new Error(
				`User referral row of ${input.referredUserId} is not there after a conflict`,
			);
		}

		return winner;
	}

	/** Reads keyset pages until a page is not full, and calls `handle` for each page. */
	private async forEachPage(
		readPage: (
			after: UserReferralCursor | null,
		) => Promise<UserReferralPageRow[]>,
		handle: (page: UserReferralPageRow[]) => Promise<void>,
	): Promise<void> {
		let after: UserReferralCursor | null = null;

		// The loop stops at the first page that is not full: no row comes after it.
		for (;;) {
			const page: UserReferralPageRow[] = await readPage(after);
			const last = page.at(-1);

			if (last === undefined) {
				return;
			}

			await handle(page);

			if (page.length < SWEEP_PAGE_SIZE) {
				return;
			}

			// The cursor moves past each row, also a failed one. Without it, a bad row stops all later pages.
			after = { createdAt: last.cursorCreatedAt, id: last.referral.id };
		}
	}

	/** Gives the activation mark to each friend of the page that has enough settled consumption. */
	private async markActivations(
		page: UserReferralPageRow[],
		now: Date,
		progress: SweepProgress,
	): Promise<void> {
		// LIMIT: only consumption of the friend's personal pool activates. Upgrade: count the use of a member in a team pool.
		const consumedByUser =
			await this.credits.settledNetConsumedCentiCreditsByUser(
				page.map(({ referral }) => referral.referredUserId),
			);

		for (const { referral } of page) {
			// A friend with an in-flight hold is absent from the map. The next sweep reads that friend again.
			const consumed = consumedByUser.get(referral.referredUserId);

			if (
				consumed === undefined ||
				consumed < USER_REFERRAL_ACTIVATION_MIN_CENTI_CREDITS
			) {
				continue;
			}

			try {
				await this.markActivated(referral, now);
				progress.activated += 1;
			} catch (error) {
				this.logSweepFailure("activation mark", referral.id, error, progress);
			}
		}
	}

	/**
	 * Writes the activation mark of one referral.
	 * The reward is 0 when the friend has an affiliate attribution or the referrer is at the cap.
	 */
	private markActivated(referral: UserReferralRow, now: Date): Promise<void> {
		return this.repository.transaction(async (tx) => {
			// Lock: two sweeps must not count the cap of one referrer at the same time.
			await this.repository.lockReferrer(referral.referrerUserId, tx);

			// Product rule: the affiliate program wins, so this friend gets no reward.
			// The 0 goes in the mark, so that this friend does not use a cap slot.
			const hasAffiliateAttribution =
				await this.repository.hasAffiliateAttribution(
					referral.referredUserId,
					tx,
				);
			const payingActivations = await this.repository.countPayingActivations(
				referral.referrerUserId,
				new Date(now.getTime() - USER_REFERRAL_ACTIVATION_WINDOW_MS),
				tx,
			);

			// Product rule: at most 10 paying activations per referrer in a rolling 30 days.
			// Over the cap, the friend still shows as activated, and the reward is 0.
			await this.repository.markActivated(
				referral.id,
				hasAffiliateAttribution ||
					payingActivations >= USER_REFERRAL_ACTIVATION_CAP
					? 0
					: referral.activationCredits,
				now,
				tx,
			);
		});
	}

	/** Delivers each due reward of each referral of the page. One failure does not stop the others. */
	private async deliverDueRewards(
		page: UserReferralPageRow[],
		now: Date,
		progress: SweepProgress,
	): Promise<void> {
		for (const { referral } of page) {
			for (const reward of REWARDS) {
				if (!isRewardDue(referral, reward, now)) {
					continue;
				}

				try {
					if (await this.deliverReward(referral.id, reward, now)) {
						progress.delivered += 1;
					}
				} catch (error) {
					this.logSweepFailure(
						`${reward} reward`,
						referral.id,
						error,
						progress,
					);
				}
			}
		}
	}

	/** Counts and logs one failed step of the sweep. The row stays due, and the next run tries it again. */
	private logSweepFailure(
		step: string,
		referralId: string,
		error: unknown,
		progress: SweepProgress,
	): void {
		progress.failed += 1;
		this.logger.error(
			`USER_REFERRAL_SWEEP_STEP_FAILED step="${step}" referralId=${referralId}`,
			error instanceof Error ? error.stack : String(error),
		);
	}

	/**
	 * Closes one reward of one referral: the ledger grant and the `*_granted_at` stamp, in one transaction.
	 * A zero amount gets the stamp and no grant, because `CreditsService.grant` refuses 0.
	 * Returns false when the reward is not due, for example after a delivery at the same time.
	 */
	private deliverReward(
		referralId: string,
		reward: UserReferralReward,
		now: Date,
	): Promise<boolean> {
		return this.repository.transaction(async (tx) => {
			// The row lock makes two deliveries of one reward run one after the other.
			const referral = await this.repository.lockReferral(referralId, tx);

			if (referral === null || !isRewardDue(referral, reward, now)) {
				return false;
			}

			const credits = await this.payableCentiCredits(referral, reward, tx);

			if (credits > 0) {
				// One credit owner per transaction: `grant` takes the lock of this one pool.
				// The idempotency key makes a repeated grant a no-op.
				await this.credits.grant(
					userOwner(
						reward === "friend"
							? referral.referredUserId
							: referral.referrerUserId,
					),
					credits,
					{
						bucket: "promo",
						idempotencyKey: `user-referral:${referral.id}:${reward}`,
						meta: {
							reason:
								reward === "friend"
									? "user_referral_friend_bonus"
									: "user_referral_reward",
							referralId: referral.id,
						},
					},
					tx,
				);
			}

			await this.repository.stampRewardGranted(
				referral.id,
				reward,
				credits,
				now,
				tx,
			);

			return true;
		});
	}

	/** The final amount of one reward, in centi-credits. 0 when a product rule removes the reward. */
	private async payableCentiCredits(
		referral: UserReferralRow,
		reward: UserReferralReward,
		tx: UserReferralsTransaction,
	): Promise<number> {
		if (reward === "friend") {
			return referral.friendCredits;
		}

		const snapshot =
			reward === "activation"
				? referral.activationCredits
				: referral.paidCredits;

		if (snapshot === 0) {
			return 0;
		}

		// Product rule: the paid reward needs a personal top-up or plan payment with no refund after the hold.
		if (
			reward === "paid" &&
			!(await this.repository.hasLivePersonalPayment(
				referral.referredUserId,
				tx,
			))
		) {
			return 0;
		}

		// Product rule: the affiliate program wins. Its lock can land after the claim,
		// so each referrer reward checks it again.
		if (
			await this.repository.hasAffiliateAttribution(referral.referredUserId, tx)
		) {
			return 0;
		}

		return snapshot;
	}
}
