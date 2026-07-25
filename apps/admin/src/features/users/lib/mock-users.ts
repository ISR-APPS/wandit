import type {
	Currency,
	PaymentProvider,
	SubscriptionStatus,
	UserActivity,
	UserAsset,
	UserAssetType,
	UserDetail,
	UserPlan,
	UserRole,
	UserSummary,
	UserWebsite,
} from "../api/users.dto";

const STORAGE_KEY = "wandit-admin-mock-users-v1";
const STORAGE_VERSION = 1;

type SeedUser = {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	plan: UserPlan;
	paymentProvider: PaymentProvider | null;
	subscriptionStatus: SubscriptionStatus | null;
	creditsBalance: number;
	isBanned?: boolean;
	signupDate: string;
	lastActiveAt: string;
	tokensUsed: number;
	websitesGenerated: number;
	assetsGenerated: number;
	country: string;
	locale: string;
};

type PersistedUsersStateV1 = {
	version: 1;
	users: UserDetail[];
};

const SEED_USERS: readonly SeedUser[] = [
	{
		id: "usr_1001",
		name: "Zack Benali",
		email: "zack@wandit.test",
		role: "owner",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 12_840,
		signupDate: "2023-11-08T09:24:00.000Z",
		lastActiveAt: "2026-07-23T08:42:00.000Z",
		tokensUsed: 18_482_030,
		websitesGenerated: 96,
		assetsGenerated: 1_248,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1002",
		name: "Sara Mansouri",
		email: "sara.mansouri@wandit.test",
		role: "admin",
		plan: "pro",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 8_420,
		signupDate: "2024-01-19T14:16:00.000Z",
		lastActiveAt: "2026-07-23T08:17:00.000Z",
		tokensUsed: 12_941_800,
		websitesGenerated: 68,
		assetsGenerated: 804,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1003",
		name: "Amine Bousbia",
		email: "amine.bousbia@wandit.test",
		role: "admin",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 2_760,
		signupDate: "2024-04-03T10:11:00.000Z",
		lastActiveAt: "2026-07-22T21:35:00.000Z",
		tokensUsed: 4_681_240,
		websitesGenerated: 31,
		assetsGenerated: 342,
		country: "Algeria",
		locale: "en",
	},
	{
		id: "usr_1004",
		name: "Lina Haddad",
		email: "lina.haddad@wandit.test",
		role: "affiliate",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 5_680,
		signupDate: "2024-05-27T08:43:00.000Z",
		lastActiveAt: "2026-07-23T07:51:00.000Z",
		tokensUsed: 8_724_000,
		websitesGenerated: 54,
		assetsGenerated: 619,
		country: "France",
		locale: "fr-DZ",
	},
	{
		id: "usr_1005",
		name: "Yacine Cherif",
		email: "yacine.cherif@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 4_930,
		signupDate: "2024-08-11T17:20:00.000Z",
		lastActiveAt: "2026-07-23T06:39:00.000Z",
		tokensUsed: 7_918_450,
		websitesGenerated: 47,
		assetsGenerated: 577,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1006",
		name: "Ikram Belkacem",
		email: "ikram.belkacem@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "chargily",
		subscriptionStatus: "past-due",
		creditsBalance: 340,
		signupDate: "2024-10-02T11:46:00.000Z",
		lastActiveAt: "2026-07-21T16:24:00.000Z",
		tokensUsed: 2_742_600,
		websitesGenerated: 18,
		assetsGenerated: 186,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1007",
		name: "Mehdi Saidi",
		email: "mehdi.saidi@wandit.test",
		role: "user",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 74,
		signupDate: "2024-11-15T09:07:00.000Z",
		lastActiveAt: "2026-07-20T13:09:00.000Z",
		tokensUsed: 842_300,
		websitesGenerated: 6,
		assetsGenerated: 49,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1008",
		name: "Rania Aouar",
		email: "rania.aouar@wandit.test",
		role: "affiliate",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 1_940,
		signupDate: "2024-12-07T18:31:00.000Z",
		lastActiveAt: "2026-07-22T19:45:00.000Z",
		tokensUsed: 3_107_260,
		websitesGenerated: 22,
		assetsGenerated: 218,
		country: "Canada",
		locale: "fr-DZ",
	},
	{
		id: "usr_1009",
		name: "Sofiane Bendjema",
		email: "sofiane.bendjema@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "canceled",
		creditsBalance: 610,
		isBanned: true,
		signupDate: "2025-01-14T12:18:00.000Z",
		lastActiveAt: "2026-06-29T10:04:00.000Z",
		tokensUsed: 5_661_910,
		websitesGenerated: 36,
		assetsGenerated: 403,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1010",
		name: "Meriem Hamidi",
		email: "meriem.hamidi@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 2_210,
		signupDate: "2025-02-06T08:54:00.000Z",
		lastActiveAt: "2026-07-23T07:03:00.000Z",
		tokensUsed: 3_884_150,
		websitesGenerated: 29,
		assetsGenerated: 301,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1011",
		name: "Walid Zerhouni",
		email: "walid.zerhouni@wandit.test",
		role: "user",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 31,
		signupDate: "2025-03-18T15:39:00.000Z",
		lastActiveAt: "2026-07-18T09:27:00.000Z",
		tokensUsed: 514_800,
		websitesGenerated: 4,
		assetsGenerated: 37,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1012",
		name: "Aya Benali",
		email: "aya.benali@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 6_120,
		signupDate: "2025-04-22T13:47:00.000Z",
		lastActiveAt: "2026-07-22T23:18:00.000Z",
		tokensUsed: 9_204_380,
		websitesGenerated: 61,
		assetsGenerated: 725,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1013",
		name: "Nassim Guerroudj",
		email: "nassim.guerroudj@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "past-due",
		creditsBalance: 195,
		signupDate: "2025-05-30T20:12:00.000Z",
		lastActiveAt: "2026-07-17T14:52:00.000Z",
		tokensUsed: 1_987_450,
		websitesGenerated: 13,
		assetsGenerated: 142,
		country: "United Kingdom",
		locale: "en",
	},
	{
		id: "usr_1014",
		name: "Imene Boudjellal",
		email: "imene.boudjellal@wandit.test",
		role: "affiliate",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 120,
		isBanned: true,
		signupDate: "2025-06-09T07:25:00.000Z",
		lastActiveAt: "2026-07-02T12:01:00.000Z",
		tokensUsed: 734_210,
		websitesGenerated: 5,
		assetsGenerated: 64,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1015",
		name: "Khaled Meziane",
		email: "khaled.meziane@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 4_480,
		signupDate: "2025-07-21T09:43:00.000Z",
		lastActiveAt: "2026-07-23T05:56:00.000Z",
		tokensUsed: 6_218_970,
		websitesGenerated: 42,
		assetsGenerated: 511,
		country: "Germany",
		locale: "en",
	},
	{
		id: "usr_1016",
		name: "Noor Eddine Rahmani",
		email: "noor.rahmani@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "chargily",
		subscriptionStatus: "canceled",
		creditsBalance: 420,
		signupDate: "2025-08-13T16:08:00.000Z",
		lastActiveAt: "2026-07-11T18:33:00.000Z",
		tokensUsed: 2_314_700,
		websitesGenerated: 16,
		assetsGenerated: 175,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1017",
		name: "Fatima Zahra Merabet",
		email: "fatima.merabet@wandit.test",
		role: "user",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 92,
		signupDate: "2025-09-04T10:50:00.000Z",
		lastActiveAt: "2026-07-22T11:44:00.000Z",
		tokensUsed: 691_820,
		websitesGenerated: 7,
		assetsGenerated: 58,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1018",
		name: "Youcef Kadri",
		email: "youcef.kadri@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 1_685,
		signupDate: "2025-10-16T12:42:00.000Z",
		lastActiveAt: "2026-07-21T20:29:00.000Z",
		tokensUsed: 2_804_330,
		websitesGenerated: 20,
		assetsGenerated: 211,
		country: "Spain",
		locale: "fr-DZ",
	},
	{
		id: "usr_1019",
		name: "Camila Santos",
		email: "camila.santos@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 7_350,
		signupDate: "2025-11-28T19:03:00.000Z",
		lastActiveAt: "2026-07-23T03:22:00.000Z",
		tokensUsed: 10_632_740,
		websitesGenerated: 73,
		assetsGenerated: 891,
		country: "Brazil",
		locale: "en",
	},
	{
		id: "usr_1020",
		name: "Lucas Martin",
		email: "lucas.martin@wandit.test",
		role: "affiliate",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 2_040,
		signupDate: "2025-12-12T08:38:00.000Z",
		lastActiveAt: "2026-07-22T17:10:00.000Z",
		tokensUsed: 3_420_190,
		websitesGenerated: 24,
		assetsGenerated: 276,
		country: "France",
		locale: "fr-DZ",
	},
	{
		id: "usr_1021",
		name: "Emma Wilson",
		email: "emma.wilson@wandit.test",
		role: "user",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 48,
		signupDate: "2026-01-25T14:09:00.000Z",
		lastActiveAt: "2026-07-19T08:47:00.000Z",
		tokensUsed: 407_650,
		websitesGenerated: 3,
		assetsGenerated: 26,
		country: "United States",
		locale: "en",
	},
	{
		id: "usr_1022",
		name: "Omar Al Farsi",
		email: "omar.alfarsi@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "stripe",
		subscriptionStatus: "past-due",
		creditsBalance: 880,
		signupDate: "2026-02-17T06:51:00.000Z",
		lastActiveAt: "2026-07-20T21:12:00.000Z",
		tokensUsed: 4_998_320,
		websitesGenerated: 33,
		assetsGenerated: 382,
		country: "United Arab Emirates",
		locale: "en",
	},
	{
		id: "usr_1023",
		name: "Chloé Bernard",
		email: "chloe.bernard@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "active",
		creditsBalance: 1_320,
		signupDate: "2026-03-08T11:17:00.000Z",
		lastActiveAt: "2026-07-22T15:05:00.000Z",
		tokensUsed: 2_109_480,
		websitesGenerated: 15,
		assetsGenerated: 168,
		country: "France",
		locale: "fr-DZ",
	},
	{
		id: "usr_1024",
		name: "Samir Boualem",
		email: "samir.boualem@wandit.test",
		role: "admin",
		plan: "pro",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 9_160,
		signupDate: "2026-03-29T09:33:00.000Z",
		lastActiveAt: "2026-07-23T08:31:00.000Z",
		tokensUsed: 11_284_930,
		websitesGenerated: 78,
		assetsGenerated: 936,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1025",
		name: "Nour El Houda",
		email: "nour.elhouda@wandit.test",
		role: "user",
		plan: "free",
		paymentProvider: null,
		subscriptionStatus: null,
		creditsBalance: 0,
		isBanned: true,
		signupDate: "2026-04-18T20:45:00.000Z",
		lastActiveAt: "2026-06-08T12:19:00.000Z",
		tokensUsed: 183_920,
		websitesGenerated: 2,
		assetsGenerated: 14,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1026",
		name: "Abdelrahman Ben Nacer",
		email: "abdelrahman.bennacer@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 1_760,
		signupDate: "2026-05-09T07:58:00.000Z",
		lastActiveAt: "2026-07-22T22:07:00.000Z",
		tokensUsed: 2_621_340,
		websitesGenerated: 19,
		assetsGenerated: 204,
		country: "Algeria",
		locale: "ar-DZ",
	},
	{
		id: "usr_1027",
		name: "Leila Kaci",
		email: "leila.kaci@wandit.test",
		role: "user",
		plan: "pro",
		paymentProvider: "chargily",
		subscriptionStatus: "active",
		creditsBalance: 5_240,
		signupDate: "2026-06-14T13:28:00.000Z",
		lastActiveAt: "2026-07-23T07:34:00.000Z",
		tokensUsed: 6_904_120,
		websitesGenerated: 44,
		assetsGenerated: 528,
		country: "Algeria",
		locale: "fr-DZ",
	},
	{
		id: "usr_1028",
		name: "Thomas Reed",
		email: "thomas.reed@wandit.test",
		role: "user",
		plan: "starter",
		paymentProvider: "stripe",
		subscriptionStatus: "canceled",
		creditsBalance: 275,
		signupDate: "2026-07-20T16:36:00.000Z",
		lastActiveAt: "2026-07-22T09:14:00.000Z",
		tokensUsed: 176_770,
		websitesGenerated: 1,
		assetsGenerated: 12,
		country: "United Kingdom",
		locale: "en",
	},
];

const WEBSITE_NAMES = [
	"Atlas Coffee",
	"Maison Saha",
	"Noura Skincare",
	"Oran Studio",
	"Nomad Watches",
	"Casbah Living",
	"Sahara Fitness",
	"North Star Consulting",
] as const;

const ASSET_NAMES = [
	"Hero campaign",
	"Product close-up",
	"Brand mark",
	"Founder portrait",
	"Feature illustration",
	"Social proof banner",
] as const;

const ASSET_TYPES: readonly UserAssetType[] = [
	"image",
	"image",
	"audio",
	"image",
	"document",
	"video",
];

const ACTIVE_RENEWAL_DATES = [
	"2026-08-02T00:00:00.000Z",
	"2026-08-07T00:00:00.000Z",
	"2026-08-11T00:00:00.000Z",
	"2026-08-16T00:00:00.000Z",
	"2026-08-21T00:00:00.000Z",
	"2026-08-27T00:00:00.000Z",
] as const;

const PAST_DUE_RENEWAL_DATES = [
	"2026-07-14T00:00:00.000Z",
	"2026-07-17T00:00:00.000Z",
	"2026-07-20T00:00:00.000Z",
] as const;

let usersMemory: UserDetail[] | null = null;
let mutationSequence = 0;

export function listMockUsers(): UserSummary[] {
	return getUsers().map(toSummary);
}

export function getMockUser(userId: string): UserDetail {
	return cloneUser(requireUser(userId));
}

export function grantMockUserCredits(
	userId: string,
	amount: number,
	reason?: string,
): UserDetail {
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new Error("Credit grant must be a positive whole number.");
	}

	const user = requireUser(userId);
	const occurredAt = new Date().toISOString();
	const entryId = nextMutationId("credit");

	user.creditsBalance += amount;
	user.creditLedger.unshift({
		id: entryId,
		type: "grant",
		amount,
		balanceAfter: user.creditsBalance,
		note: reason?.trim() || "Manual admin credit grant",
		createdAt: occurredAt,
		actor: "Admin",
	});
	user.activity.unshift({
		id: nextMutationId("activity"),
		type: "credit",
		title: `${amount.toLocaleString()} credits granted`,
		description: reason?.trim() || "Manual balance adjustment",
		createdAt: occurredAt,
	});

	persistUsers();
	return cloneUser(user);
}

export function changeMockUserRole(userId: string, role: UserRole): UserDetail {
	const user = requireUser(userId);

	if (user.role === role) {
		return cloneUser(user);
	}

	const previousRole = user.role;
	const occurredAt = new Date().toISOString();
	user.role = role;
	user.activity.unshift({
		id: nextMutationId("activity"),
		type: "admin",
		title: "Account role changed",
		description: `${previousRole} → ${role}`,
		createdAt: occurredAt,
	});

	persistUsers();
	return cloneUser(user);
}

export function setMockUserBanned(
	userId: string,
	banned: boolean,
	reason?: string,
): UserDetail {
	const user = requireUser(userId);

	if (user.isBanned === banned) {
		return cloneUser(user);
	}

	const occurredAt = new Date().toISOString();
	user.isBanned = banned;
	user.banReason = banned
		? reason?.trim() || "Account suspended during a manual review"
		: null;
	user.bannedAt = banned ? occurredAt : null;
	user.activity.unshift({
		id: nextMutationId("activity"),
		type: "admin",
		title: banned ? "User access suspended" : "User access restored",
		description:
			reason?.trim() ||
			(banned
				? "Account was suspended by an administrator"
				: "Account suspension was removed"),
		createdAt: occurredAt,
	});

	persistUsers();
	return cloneUser(user);
}

function getUsers() {
	if (usersMemory) {
		return usersMemory;
	}

	usersMemory = readPersistedUsers() ?? createSeedUsers();
	return usersMemory;
}

function requireUser(userId: string) {
	const user = getUsers().find((candidate) => candidate.id === userId);

	if (!user) {
		throw new Error(`Admin user "${userId}" was not found.`);
	}

	return user;
}

function readPersistedUsers() {
	const storage = getStorage();
	if (!storage) {
		return null;
	}

	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const value: unknown = JSON.parse(raw);
		if (!isPersistedUsersState(value)) {
			return null;
		}

		return value.users.map(cloneUser);
	} catch {
		return null;
	}
}

function persistUsers() {
	const storage = getStorage();
	if (!storage || !usersMemory) {
		return;
	}

	const state: PersistedUsersStateV1 = {
		version: STORAGE_VERSION,
		users: usersMemory,
	};

	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// The mock remains usable in memory when storage is blocked or full.
	}
}

function getStorage() {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function isPersistedUsersState(value: unknown): value is PersistedUsersStateV1 {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<PersistedUsersStateV1>;
	return (
		candidate.version === STORAGE_VERSION &&
		Array.isArray(candidate.users) &&
		candidate.users.every(
			(user) =>
				user &&
				typeof user === "object" &&
				typeof user.id === "string" &&
				typeof user.name === "string" &&
				typeof user.signedUpAt === "string" &&
				typeof user.tokensLifetime === "number" &&
				Array.isArray(user.websites) &&
				Array.isArray(user.assets) &&
				Array.isArray(user.creditLedger) &&
				Array.isArray(user.activity),
		)
	);
}

function createSeedUsers(): UserDetail[] {
	return SEED_USERS.map((seed, index) => {
		const billing = getBilling(seed.plan, seed.paymentProvider);
		const summary: UserSummary = {
			id: seed.id,
			name: seed.name,
			email: seed.email,
			avatarUrl: `/images/avatars/${String((index % 12) + 1).padStart(2, "0")}.png`,
			role: seed.role,
			plan: seed.plan,
			paymentProvider: seed.paymentProvider,
			subscriptionStatus: seed.subscriptionStatus,
			monthlyAmountMinor: billing.amountMinor,
			currency: billing.currency,
			renewalAt: getRenewalDate(seed.subscriptionStatus, index),
			creditsBalance: seed.creditsBalance,
			isBanned: seed.isBanned ?? false,
			banReason: seed.isBanned
				? "Account suspended during a manual review"
				: null,
			bannedAt: seed.isBanned ? offsetIso(seed.lastActiveAt, 1, 0) : null,
			signedUpAt: seed.signupDate,
			lastSeenAt: seed.lastActiveAt,
			country: seed.country,
			locale: seed.locale,
			tokensThisPeriod: Math.max(
				12_000,
				Math.round(seed.tokensUsed * (0.12 + (index % 5) * 0.035)),
			),
			tokensLifetime: seed.tokensUsed,
			tokenCostUsdMinor: Math.max(
				4,
				Math.round(seed.tokensUsed / (4_200 - (index % 4) * 350)),
			),
			websitesGenerated: seed.websitesGenerated,
			assetsGenerated: seed.assetsGenerated,
		};

		const websites = createWebsites(summary, index);
		const assets = createAssets(summary, index);

		return {
			...summary,
			lastSignInAt: seed.lastActiveAt,
			billingCustomerId: seed.paymentProvider
				? `${seed.paymentProvider === "stripe" ? "cus" : "chg"}_mock_${seed.id.slice(4)}`
				: null,
			websites,
			assets,
			creditLedger: createCreditLedger(summary, index),
			activity: createActivity(summary, websites, assets),
		};
	});
}

function getBilling(
	plan: UserPlan,
	provider: PaymentProvider | null,
): { amountMinor: number; currency: Currency | null } {
	if (plan === "free" || !provider) {
		return { amountMinor: 0, currency: null };
	}

	if (provider === "stripe") {
		return {
			amountMinor: plan === "starter" ? 1_900 : 4_900,
			currency: "USD",
		};
	}

	return {
		amountMinor: plan === "starter" ? 250_000 : 650_000,
		currency: "DZD",
	};
}

function getRenewalDate(status: SubscriptionStatus | null, index: number) {
	if (status === "active") {
		return ACTIVE_RENEWAL_DATES[index % ACTIVE_RENEWAL_DATES.length];
	}

	if (status === "past-due") {
		return PAST_DUE_RENEWAL_DATES[index % PAST_DUE_RENEWAL_DATES.length];
	}

	return null;
}

function createWebsites(user: UserSummary, seed: number) {
	const count = Math.min(user.websitesGenerated, 5);

	return Array.from({ length: count }, (_, index): UserWebsite => {
		const name = WEBSITE_NAMES[(seed + index) % WEBSITE_NAMES.length];
		const status =
			index === 1 && seed % 7 === 0
				? "failed"
				: (seed + index) % 3 === 0
					? "draft"
					: "published";
		const slug = `${slugify(name)}-${user.id.slice(-4)}`;
		const createdAt = offsetIso(user.lastSeenAt, index + 2, index + 1);

		return {
			id: `site_${user.id.slice(4)}_${index + 1}`,
			name,
			url: status === "published" ? `https://${slug}.wandit.site` : null,
			status,
			generationCount: 1 + ((seed + index * 2) % 9),
			createdAt,
			lastGeneratedAt: offsetIso(user.lastSeenAt, index, index * 2),
		};
	});
}

function createAssets(user: UserSummary, seed: number) {
	const count = Math.min(user.assetsGenerated, 6);

	return Array.from({ length: count }, (_, index): UserAsset => {
		const type = ASSET_TYPES[(seed + index) % ASSET_TYPES.length];
		const extension = getAssetExtension(type);
		const source = index % 5 === 4 ? "Upload" : "AI generation";
		const sizeBytes =
			184_000 + (((seed + 3) * (index + 7) * 31_337) % 4_800_000);

		return {
			id: `asset_${user.id.slice(4)}_${index + 1}`,
			name: `${ASSET_NAMES[(seed + index) % ASSET_NAMES.length]}.${extension}`,
			type,
			source,
			model: source === "Upload" ? null : getAssetModel(type, seed + index),
			sizeLabel: formatFileSize(sizeBytes),
			createdAt: offsetIso(user.lastSeenAt, index + 1, index * 3),
		};
	});
}

function createCreditLedger(user: UserSummary, seed: number) {
	const latestGrant = 250 + (seed % 4) * 250;
	const usage = 40 + (seed % 6) * 15;
	const balanceBeforeGrant = Math.max(0, user.creditsBalance - latestGrant);

	return [
		{
			id: `credit_${user.id.slice(4)}_3`,
			type: "grant" as const,
			amount: latestGrant,
			balanceAfter: user.creditsBalance,
			note: seed % 3 === 0 ? "Retention credit grant" : "Monthly credit grant",
			createdAt: offsetIso(user.lastSeenAt, 1, 2),
			actor: seed % 3 === 0 ? "Sara Mansouri" : "System",
		},
		{
			id: `credit_${user.id.slice(4)}_2`,
			type: "generation" as const,
			amount: -usage,
			balanceAfter: balanceBeforeGrant,
			note: "Website generation",
			createdAt: offsetIso(user.lastSeenAt, 3, 4),
			actor: "System",
		},
		{
			id: `credit_${user.id.slice(4)}_1`,
			type: user.plan === "free" ? ("grant" as const) : ("purchase" as const),
			amount: user.plan === "free" ? 100 : 1_000,
			balanceAfter: balanceBeforeGrant + usage,
			note:
				user.plan === "free" ? "Welcome credits" : "Subscription allocation",
			createdAt: offsetIso(user.lastSeenAt, 30, 0),
			actor: "System",
		},
	];
}

function createActivity(
	user: UserSummary,
	websites: UserWebsite[],
	assets: UserAsset[],
): UserActivity[] {
	const activity: UserActivity[] = [];
	const latestWebsite = websites[0];
	const latestAsset = assets[0];

	if (latestWebsite) {
		activity.push({
			id: `activity_${user.id.slice(4)}_website`,
			type: latestWebsite.status === "published" ? "publish" : "generation",
			title: "Website generation completed",
			description: latestWebsite.name,
			createdAt: latestWebsite.lastGeneratedAt,
		});
	}

	if (latestAsset) {
		activity.push({
			id: `activity_${user.id.slice(4)}_asset`,
			type: "generation",
			title: "Asset added",
			description: latestAsset.name,
			createdAt: latestAsset.createdAt,
		});
	}

	if (user.isBanned) {
		activity.push({
			id: `activity_${user.id.slice(4)}_banned`,
			type: "admin",
			title: "User access suspended",
			description: "Account flagged during a manual review",
			createdAt: user.bannedAt ?? offsetIso(user.lastSeenAt, 1, 0),
		});
	}

	activity.push({
		id: `activity_${user.id.slice(4)}_signup`,
		type: "signup",
		title: "Account created",
		description: `Joined Wandit on the ${user.plan} plan`,
		createdAt: user.signedUpAt,
	});

	return activity.sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
	);
}

function toSummary(user: UserDetail): UserSummary {
	const {
		lastSignInAt: _lastSignInAt,
		billingCustomerId: _billingCustomerId,
		websites: _websites,
		assets: _assets,
		creditLedger: _creditLedger,
		activity: _activity,
		...summary
	} = user;

	return { ...summary };
}

function cloneUser(user: UserDetail): UserDetail {
	return {
		...user,
		websites: user.websites.map((website) => ({ ...website })),
		assets: user.assets.map((asset) => ({ ...asset })),
		creditLedger: user.creditLedger.map((entry) => ({ ...entry })),
		activity: user.activity.map((item) => ({ ...item })),
	};
}

function offsetIso(value: string, days: number, hours: number) {
	return new Date(
		Date.parse(value) - days * 86_400_000 - hours * 3_600_000,
	).toISOString();
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function getAssetExtension(type: UserAssetType) {
	switch (type) {
		case "document":
			return "pdf";
		case "video":
			return "mp4";
		case "audio":
			return "mp3";
		default:
			return "webp";
	}
}

function getAssetModel(type: UserAssetType, seed: number) {
	if (type === "document") {
		return "Wandit Copy";
	}

	if (type === "video") {
		return "Kling 2.1";
	}

	if (type === "audio") {
		return "Eleven v3";
	}

	return seed % 2 === 0 ? "Flux 1.1 Pro" : "GPT Image 1";
}

function formatFileSize(bytes: number) {
	if (bytes >= 1_000_000) {
		return `${(bytes / 1_000_000).toFixed(1)} MB`;
	}

	return `${Math.round(bytes / 1_000)} KB`;
}

function nextMutationId(prefix: string) {
	mutationSequence += 1;
	return `${prefix}_${Date.now().toString(36)}_${mutationSequence.toString(36)}`;
}
