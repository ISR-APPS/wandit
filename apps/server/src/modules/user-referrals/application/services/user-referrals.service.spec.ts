import {
	type ProductSettings,
	USER_REFERRAL_ACTIVATION_CAP,
	userReferralCodeSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import type { CreditLedgerRow } from "../../../credits/infrastructure/persistence/credits.repository";
import type { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import {
	generateUserReferralCode,
	type UserReferralReward,
} from "../../domain/user-referral-rules";
import type {
	UserReferralCursor,
	UserReferralFriendRow,
	UserReferralPageRow,
	UserReferralRow,
	UserReferralStats,
	UserReferralsTransaction,
} from "../../infrastructure/persistence/user-referrals.repository";
import {
	UserReferralsService,
	type UserReferralsStore,
} from "./user-referrals.service";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const MS_PER_DAY = 86_400_000;
const REFERRER = "user-referrer";
const FRIEND = "user-friend";
const REFERRER_CODE = "abcd2345";

function daysBefore(days: number): Date {
	return new Date(NOW.getTime() - days * MS_PER_DAY);
}

/** Settings as ProductSettingsService gives them: the three amounts are centi-credits. */
function productSettings(userReferralsEnabled: boolean): ProductSettings {
	return {
		dzdPerUsdRate: 27_000,
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: false,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: true,
		signupGrantCredits: 2000,
		signupGrantEnabled: true,
		topupsEnabled: false,
		updatedAt: "2026-11-01T10:00:00.000Z",
		updatedByUserId: null,
		userReferralActivationCredits: 1000,
		userReferralFriendCredits: 1000,
		userReferralPaidCredits: 10_000,
		userReferralsEnabled,
		v2BuilderEnabled: false,
		version: 1,
	};
}

/** A referral of FRIEND by REFERRER with the friend bonus already granted. */
function referralRow(
	overrides: Partial<UserReferralRow> = {},
): UserReferralRow {
	return {
		activatedAt: null,
		activationCredits: 1000,
		activationGrantedAt: null,
		createdAt: daysBefore(1),
		firstPaidAt: null,
		friendCredits: 1000,
		friendGrantedAt: daysBefore(1),
		id: "referral-1",
		paidCredits: 10_000,
		paidGrantedAt: null,
		referredUserId: FRIEND,
		referrerUserId: REFERRER,
		...overrides,
	};
}

/** A referral of REFERRER that activated at `activatedAt` with its reward granted. It uses one cap slot. */
function payingActivationRow(
	index: number,
	activatedAt: Date,
): UserReferralRow {
	return referralRow({
		activatedAt,
		activationGrantedAt: activatedAt,
		id: `referral-earlier-${index}`,
		referredUserId: `user-earlier-${index}`,
	});
}

// SAFETY: the in-memory store and the fake credits pass this value through and never read it.
const fakeTransaction = {} as UserReferralsTransaction;

/** The referral tables and the facts of other modules, in memory. */
class InMemoryUserReferralsStore implements UserReferralsStore {
	readonly referrals: UserReferralRow[] = [];
	/** User id to invite code. */
	readonly codes = new Map<string, string>();
	/** User id to signup time. */
	readonly userCreatedAt = new Map<string, Date>();
	readonly affiliateUserIds = new Set<string>();
	/** Users with a paid personal plan or top-up and no refund. */
	readonly livePaymentUserIds = new Set<string>();
	/** Users with a real payment that has no mark yet. */
	readonly paidUserIds = new Set<string>();

	transaction<T>(work: (tx: UserReferralsTransaction) => Promise<T>) {
		return work(fakeTransaction);
	}

	async findCodeByUserId(userId: string) {
		return this.codes.get(userId) ?? null;
	}

	async saveCodeIfFree(userId: string, code: string) {
		if (!this.codes.has(userId) && ![...this.codes.values()].includes(code)) {
			this.codes.set(userId, code);
		}

		return this.codes.get(userId) ?? null;
	}

	async findUserIdByCode(code: string) {
		for (const [userId, userCode] of this.codes) {
			if (userCode === code) {
				return userId;
			}
		}

		return null;
	}

	async findUserCreatedAt(userId: string) {
		return this.userCreatedAt.get(userId) ?? null;
	}

	async findReferralByReferredUserId(referredUserId: string) {
		const row = this.referrals.find(
			(item) => item.referredUserId === referredUserId,
		);

		// A copy, as a database read gives: a later write does not change it.
		return row ? { ...row } : null;
	}

	async hasAffiliateAttribution(userId: string) {
		return this.affiliateUserIds.has(userId);
	}

	async hasLivePersonalPayment(userId: string) {
		return this.livePaymentUserIds.has(userId);
	}

	async insertReferral(input: {
		referrerUserId: string;
		referredUserId: string;
		friendCredits: number;
		activationCredits: number;
		paidCredits: number;
	}) {
		if (
			this.referrals.some((row) => row.referredUserId === input.referredUserId)
		) {
			return null;
		}

		const row = referralRow({
			...input,
			createdAt: NOW,
			friendGrantedAt: null,
			id: `referral-${this.referrals.length + 1}`,
		});
		this.referrals.push(row);

		return { ...row };
	}

	async getReferrerStats(): Promise<UserReferralStats> {
		throw new Error("The cases of this spec do not read the stats");
	}

	async listFriends(): Promise<UserReferralFriendRow[]> {
		throw new Error("The cases of this spec do not read the friends list");
	}

	async markFirstPayments(now: Date) {
		for (const row of this.referrals) {
			if (
				row.firstPaidAt === null &&
				this.paidUserIds.has(row.referredUserId)
			) {
				row.firstPaidAt = now;
			}
		}
	}

	async listActivationCandidates(input: {
		joinedAfter: Date;
		after: UserReferralCursor | null;
		limit: number;
	}) {
		return this.firstPage(
			input.after,
			(row) => row.activatedAt === null && row.createdAt > input.joinedAfter,
		);
	}

	async listDueReferrals(input: {
		paidOnOrBefore: Date;
		after: UserReferralCursor | null;
		limit: number;
	}) {
		return this.firstPage(
			input.after,
			(row) =>
				row.friendGrantedAt === null ||
				(row.activatedAt !== null && row.activationGrantedAt === null) ||
				(row.firstPaidAt !== null &&
					row.firstPaidAt <= input.paidOnOrBefore &&
					row.paidGrantedAt === null),
		);
	}

	async lockReferrer() {}

	async countPayingActivations(referrerUserId: string, since: Date) {
		return this.referrals.filter(
			(row) =>
				row.referrerUserId === referrerUserId &&
				row.activatedAt !== null &&
				row.activatedAt > since &&
				row.activationCredits > 0,
		).length;
	}

	async markActivated(
		referralId: string,
		activationCredits: number,
		now: Date,
	) {
		const row = this.referrals.find((item) => item.id === referralId);

		if (row && row.activatedAt === null) {
			row.activatedAt = now;
			row.activationCredits = activationCredits;
		}
	}

	async lockReferral(referralId: string) {
		return this.referrals.find((row) => row.id === referralId) ?? null;
	}

	async stampRewardGranted(
		referralId: string,
		reward: UserReferralReward,
		credits: number,
		now: Date,
	) {
		const row = this.referrals.find((item) => item.id === referralId);

		if (!row) {
			return;
		}

		if (reward === "friend" && row.friendGrantedAt === null) {
			row.friendCredits = credits;
			row.friendGrantedAt = now;
		}

		if (reward === "activation" && row.activationGrantedAt === null) {
			row.activationCredits = credits;
			row.activationGrantedAt = now;
		}

		if (reward === "paid" && row.paidGrantedAt === null) {
			row.paidCredits = credits;
			row.paidGrantedAt = now;
		}
	}

	/** Each case has less than one page of rows, so a call with a cursor finds nothing. */
	private firstPage(
		after: UserReferralCursor | null,
		isMatch: (row: UserReferralRow) => boolean,
	): UserReferralPageRow[] {
		return after
			? []
			: this.referrals.filter(isMatch).map((referral) => ({
					cursorCreatedAt: referral.createdAt.toISOString(),
					referral: { ...referral },
				}));
	}
}

type GrantCall = {
	owner: Parameters<CreditsService["grant"]>[0];
	/** Centi-credits. */
	amount: number;
	options: Parameters<CreditsService["grant"]>[2];
};

function createHarness(input: { enabled?: boolean } = {}) {
	const store = new InMemoryUserReferralsStore();
	const grants: GrantCall[] = [];
	/** Idempotency keys for which the fake `grant` throws, as a ledger failure does. */
	const failingGrantKeys = new Set<string>();
	/** Settled net consumption in centi-credits. A user with an in-flight hold has no entry. */
	const consumedByUser = new Map<string, number>();
	const credits: Pick<
		CreditsService,
		"grant" | "settledNetConsumedCentiCreditsByUser"
	> = {
		grant: async (owner, amount, options) => {
			// The real service refuses an amount of 0, so a zero reward must never get here.
			if (amount <= 0) {
				throw new Error("Credit amount must be a positive integer");
			}

			if (
				options.idempotencyKey !== undefined &&
				failingGrantKeys.has(options.idempotencyKey)
			) {
				throw new Error(`The ledger refuses ${options.idempotencyKey}`);
			}

			grants.push({ amount, options, owner });

			return {
				bucket: options.bucket,
				createdAt: NOW,
				delta: amount,
				id: `ledger-${grants.length}`,
				idempotencyKey: options.idempotencyKey ?? null,
				kind: "grant",
				meta: {},
				organizationId: null,
				userId: owner.type === "user" ? owner.userId : null,
			} satisfies CreditLedgerRow;
		},
		settledNetConsumedCentiCreditsByUser: async (userIds) =>
			new Map(
				userIds.flatMap((userId) => {
					const consumed = consumedByUser.get(userId);

					return consumed === undefined ? [] : [[userId, consumed]];
				}),
			),
	};
	const settings: Pick<ProductSettingsService, "get"> = {
		get: async () => productSettings(input.enabled ?? true),
	};

	store.codes.set(REFERRER, REFERRER_CODE);
	store.userCreatedAt.set(REFERRER, daysBefore(100));
	store.userCreatedAt.set(FRIEND, new Date(NOW.getTime() - 60_000));

	return {
		consumedByUser,
		failingGrantKeys,
		grants,
		service: new UserReferralsService(store, credits, settings),
		store,
	};
}

describe("UserReferralsService.claim", () => {
	// Money rule: each of these callers gets no referral row and no bonus.
	it.each([
		{
			arrange: () => createHarness({ enabled: false }),
			code: REFERRER_CODE,
			reason: "disabled",
		},
		{
			arrange: () => createHarness(),
			code: "zzzz9999",
			reason: "code_not_found",
		},
		{
			arrange: () => {
				const harness = createHarness();
				harness.store.codes.set(FRIEND, "ffff2222");

				return harness;
			},
			code: "ffff2222",
			reason: "own_code",
		},
		{
			arrange: () => {
				const harness = createHarness();
				// One minute more than the 24-hour claim window.
				harness.store.userCreatedAt.set(
					FRIEND,
					new Date(NOW.getTime() - MS_PER_DAY - 60_000),
				);

				return harness;
			},
			code: REFERRER_CODE,
			reason: "not_new_account",
		},
		{
			arrange: () => {
				const harness = createHarness();
				harness.store.referrals.push(
					referralRow({ referrerUserId: "user-other-referrer" }),
				);

				return harness;
			},
			code: REFERRER_CODE,
			reason: "already_referred",
		},
		{
			arrange: () => {
				const harness = createHarness();
				harness.store.affiliateUserIds.add(FRIEND);

				return harness;
			},
			code: REFERRER_CODE,
			reason: "affiliate_attributed",
		},
	])("rejects a claim with the reason $reason", async ({
		arrange,
		code,
		reason,
	}) => {
		const { grants, service, store } = arrange();
		const rowsBefore = store.referrals.length;

		await expect(service.claim(FRIEND, code, NOW)).resolves.toEqual({
			outcome: "rejected",
			reason,
		});
		expect(store.referrals).toHaveLength(rowsBefore);
		expect(grants).toEqual([]);
	});

	it("answers claimed again for the same referrer, with one bonus in the ledger", async () => {
		const { grants, service, store } = createHarness();

		const first = await service.claim(FRIEND, REFERRER_CODE, NOW);
		// The repeat comes 2 days later: the account is then older than the claim window.
		const repeat = await service.claim(
			FRIEND,
			REFERRER_CODE,
			new Date(NOW.getTime() + 2 * MS_PER_DAY),
		);

		expect(first).toEqual({ friendCredits: 10, outcome: "claimed" });
		expect(repeat).toEqual(first);
		expect(store.referrals).toHaveLength(1);
		expect(store.referrals[0]?.friendGrantedAt).toEqual(NOW);
		expect(grants).toEqual([
			{
				amount: 1000,
				options: {
					bucket: "promo",
					idempotencyKey: "user-referral:referral-1:friend",
					meta: {
						reason: "user_referral_friend_bonus",
						referralId: "referral-1",
					},
				},
				owner: userOwner(FRIEND),
			},
		]);
	});
});

describe("UserReferralsService.runSweep", () => {
	it("pays nothing and marks nothing while the program is off", async () => {
		const { consumedByUser, grants, service, store } = createHarness({
			enabled: false,
		});
		store.referrals.push(
			referralRow({ activatedAt: daysBefore(1), friendGrantedAt: null }),
		);
		store.paidUserIds.add(FRIEND);
		consumedByUser.set(FRIEND, 5000);

		await expect(service.runSweep(NOW)).resolves.toEqual({
			activated: 0,
			delivered: 0,
		});
		expect(grants).toEqual([]);
		expect(store.referrals[0]).toEqual(
			referralRow({ activatedAt: daysBefore(1), friendGrantedAt: null }),
		);
	});

	// Money rule: only settled consumption of 8 credits (800 centi-credits) activates,
	// and only in the 30 days after the join.
	it.each([
		{ consumed: 799, isActivated: false, joinedDaysBefore: 1 },
		{ consumed: 800, isActivated: true, joinedDaysBefore: 1 },
		// No entry: the friend has an in-flight hold.
		{ consumed: undefined, isActivated: false, joinedDaysBefore: 1 },
		// The activation window of 30 days is over.
		{ consumed: 900, isActivated: false, joinedDaysBefore: 31 },
	])("activates at $consumed centi-credits, $joinedDaysBefore days after the join: $isActivated", async ({
		consumed,
		isActivated,
		joinedDaysBefore,
	}) => {
		const { consumedByUser, grants, service, store } = createHarness();
		store.referrals.push(
			referralRow({ createdAt: daysBefore(joinedDaysBefore) }),
		);

		if (consumed !== undefined) {
			consumedByUser.set(FRIEND, consumed);
		}

		await service.runSweep(NOW);

		expect(store.referrals[0]?.activatedAt).toEqual(isActivated ? NOW : null);
		expect(grants.map((grant) => grant.owner)).toEqual(
			isActivated ? [userOwner(REFERRER)] : [],
		);
	});

	// Money rule: the cap of paying activations per referrer in a rolling 30 days.
	// Over the cap, the reward becomes 0 and gets its stamp with no grant.
	it.each([
		{
			earlierActivations: USER_REFERRAL_ACTIVATION_CAP - 1,
			earlierOutsideWindow: 0,
			paidCredits: 1000,
		},
		{
			earlierActivations: USER_REFERRAL_ACTIVATION_CAP,
			earlierOutsideWindow: 0,
			paidCredits: 0,
		},
		// One earlier activation is 31 days old, so it is out of the rolling 30 days.
		{
			earlierActivations: USER_REFERRAL_ACTIVATION_CAP,
			earlierOutsideWindow: 1,
			paidCredits: 1000,
		},
	])("pays $paidCredits centi-credits after $earlierActivations paying activations, $earlierOutsideWindow older than 30 days", async ({
		earlierActivations,
		earlierOutsideWindow,
		paidCredits,
	}) => {
		const { consumedByUser, grants, service, store } = createHarness();

		for (let index = 0; index < earlierActivations; index += 1) {
			store.referrals.push(
				payingActivationRow(
					index,
					daysBefore(index < earlierOutsideWindow ? 31 : 3),
				),
			);
		}

		store.referrals.push(referralRow({ id: "referral-new" }));
		consumedByUser.set(FRIEND, 900);

		await service.runSweep(NOW);

		expect(store.referrals.at(-1)).toMatchObject({
			activatedAt: NOW,
			activationCredits: paidCredits,
			activationGrantedAt: NOW,
		});
		expect(grants.map((grant) => grant.amount)).toEqual(
			paidCredits > 0 ? [paidCredits] : [],
		);
	});

	// Bug fix: the affiliate friend took the last cap slot, and then its reward became 0.
	it("keeps the last cap slot for the next friend when an older friend has an affiliate attribution", async () => {
		const { consumedByUser, grants, service, store } = createHarness();

		for (let index = 0; index < USER_REFERRAL_ACTIVATION_CAP - 1; index += 1) {
			store.referrals.push(payingActivationRow(index, daysBefore(3)));
		}

		store.referrals.push(
			referralRow({
				createdAt: daysBefore(2),
				id: "referral-affiliate",
				referredUserId: "user-affiliate-friend",
			}),
			referralRow({ id: "referral-new" }),
		);
		store.affiliateUserIds.add("user-affiliate-friend");
		consumedByUser.set("user-affiliate-friend", 900);
		consumedByUser.set(FRIEND, 900);

		await service.runSweep(NOW);

		expect(store.referrals.at(-1)).toMatchObject({
			activationCredits: 1000,
			activationGrantedAt: NOW,
		});
		expect(grants.map((grant) => grant.amount)).toEqual([1000]);
	});

	it("grants each reward one time when the sweep runs twice", async () => {
		const { consumedByUser, grants, service, store } = createHarness();
		store.referrals.push(
			referralRow({ firstPaidAt: daysBefore(7), friendGrantedAt: null }),
		);
		store.livePaymentUserIds.add(FRIEND);
		consumedByUser.set(FRIEND, 900);

		await service.runSweep(NOW);
		await service.runSweep(NOW);

		expect(grants.map((grant) => grant.options.idempotencyKey)).toEqual([
			"user-referral:referral-1:friend",
			"user-referral:referral-1:activation",
			"user-referral:referral-1:paid",
		]);
	});

	// Money rule: the paid reward waits 7 days after the first payment mark,
	// and it needs a personal payment with no refund at that time.
	it.each([
		{
			daysSinceMark: 6,
			hasLivePayment: true,
			paidCredits: 10_000,
			isStamped: false,
		},
		{
			daysSinceMark: 7,
			hasLivePayment: true,
			paidCredits: 10_000,
			isStamped: true,
		},
		{
			daysSinceMark: 7,
			hasLivePayment: false,
			paidCredits: 0,
			isStamped: true,
		},
	])("paid reward after $daysSinceMark days, live payment $hasLivePayment: $paidCredits centi-credits", async ({
		daysSinceMark,
		hasLivePayment,
		isStamped,
		paidCredits,
	}) => {
		const { grants, service, store } = createHarness();
		store.referrals.push(
			referralRow({ firstPaidAt: daysBefore(daysSinceMark) }),
		);

		if (hasLivePayment) {
			store.livePaymentUserIds.add(FRIEND);
		}

		await service.runSweep(NOW);

		expect(store.referrals[0]).toMatchObject({
			paidCredits,
			paidGrantedAt: isStamped ? NOW : null,
		});
		expect(grants).toEqual(
			isStamped && paidCredits > 0
				? [
						expect.objectContaining({
							amount: 10_000,
							owner: userOwner(REFERRER),
						}),
					]
				: [],
		);
	});

	it("pays the referrer nothing when the friend gets an affiliate attribution after the claim", async () => {
		const { consumedByUser, grants, service, store } = createHarness();
		store.referrals.push(referralRow({ firstPaidAt: daysBefore(8) }));
		store.livePaymentUserIds.add(FRIEND);
		store.affiliateUserIds.add(FRIEND);
		consumedByUser.set(FRIEND, 900);

		await service.runSweep(NOW);

		expect(store.referrals[0]).toMatchObject({
			activationCredits: 0,
			activationGrantedAt: NOW,
			paidCredits: 0,
			paidGrantedAt: NOW,
		});
		expect(grants).toEqual([]);
	});

	it("rejects at the end, leaves the failed reward open, and delivers the next one", async () => {
		const { failingGrantKeys, grants, service, store } = createHarness();
		store.referrals.push(
			referralRow({
				activatedAt: daysBefore(1),
				id: "referral-failing",
				referredUserId: "user-friend-failing",
			}),
			referralRow({ activatedAt: daysBefore(1), id: "referral-next" }),
		);
		failingGrantKeys.add("user-referral:referral-failing:activation");

		await expect(service.runSweep(NOW)).rejects.toThrow(
			"1 referral step(s) pending",
		);
		expect(store.referrals.map((row) => row.activationGrantedAt)).toEqual([
			null,
			NOW,
		]);
		expect(grants).toHaveLength(1);
	});
});

describe("generateUserReferralCode", () => {
	it("makes only codes that the contract schema accepts", () => {
		// 500 codes of 8 symbols use each of the 32 symbols with near certainty.
		const codes = Array.from({ length: 500 }, () => generateUserReferralCode());

		expect(
			codes.filter((code) => !userReferralCodeSchema.safeParse(code).success),
		).toEqual([]);
	});

	it("makes a new code when the web router reads the first one as a number", () => {
		// Each byte is the alphabet index of one symbol: "1e234567", then "abcdefgh".
		const draws = [
			Uint8Array.from([1, 14, 2, 3, 4, 5, 6, 7]),
			Uint8Array.from([10, 11, 12, 13, 14, 15, 16, 17]),
		];
		let drawCount = 0;

		const code = generateUserReferralCode(() => {
			const bytes = draws[drawCount] ?? Uint8Array.from([]);
			drawCount += 1;
			return bytes;
		});

		expect(code).toBe("abcdefgh");
	});
});
