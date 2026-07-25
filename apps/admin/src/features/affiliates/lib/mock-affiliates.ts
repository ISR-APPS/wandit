import type {
	Affiliate,
	AffiliateCode,
	AffiliateCodeDraft,
	AffiliateCodeStatus,
	AffiliatePerformance,
	CreateAffiliateInput,
	SetAffiliateCodeStatusInput,
	SetAffiliateStatusInput,
} from "../api/affiliates.dto";

const STORAGE_KEY = "wandit-admin-mock-affiliates-v1";
const STORAGE_VERSION = 1;
const EMPTY_PERFORMANCE: AffiliatePerformance = {
	clicks: 0,
	uniqueVisitors: 0,
	signups: 0,
	paidConversions: 0,
	conversionRatePercent: 0,
	revenueUsdMinor: 0,
	commissionUsdMinor: 0,
	paidCommissionUsdMinor: 0,
	pendingCommissionUsdMinor: 0,
};

type PersistedAffiliatesStateV1 = {
	version: 1;
	affiliates: Affiliate[];
};

type SeedCode = {
	code: string;
	label: string;
	status?: AffiliateCodeStatus;
	landingPath: string;
	commissionRatePercent?: number;
	attributionWindowDays?: number;
	clicks: number;
	visitorRatePercent: number;
	signupRatePercent: number;
	paidRatePercent: number;
	averageOrderUsdMinor: number;
	pendingRatePercent: number;
	createdAt: string;
	expiresAt?: string | null;
	lastConversionAt?: string | null;
};

type SeedAffiliate = Omit<
	Affiliate,
	"id" | "avatarUrl" | "codes" | "performance"
> & {
	codes: readonly SeedCode[];
};

const SEED_AFFILIATES: readonly SeedAffiliate[] = [
	{
		userId: "usr_1004",
		name: "Lina Haddad",
		email: "lina.haddad@wandit.test",
		company: "Studio Haddad",
		channel: "creator",
		status: "active",
		country: "France",
		joinedAt: "2024-05-27T08:43:00.000Z",
		lastActiveAt: "2026-07-23T07:51:00.000Z",
		defaultCommissionRatePercent: 20,
		payoutMethod: "wise",
		payoutEmail: "payments@studiohaddad.fr",
		notes: "Design creator covering Francophone founders.",
		codes: [
			{
				code: "LINA20",
				label: "Main creator code",
				landingPath: "/start",
				clicks: 6_842,
				visitorRatePercent: 78.4,
				signupRatePercent: 19.7,
				paidRatePercent: 42.8,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 21.4,
				createdAt: "2024-05-27T10:00:00.000Z",
				lastConversionAt: "2026-07-23T06:18:00.000Z",
			},
			{
				code: "LINA-STUDIO",
				label: "Studio newsletter",
				landingPath: "/templates/portfolio",
				commissionRatePercent: 18,
				clicks: 2_317,
				visitorRatePercent: 81.2,
				signupRatePercent: 16.4,
				paidRatePercent: 37.6,
				averageOrderUsdMinor: 3_780,
				pendingRatePercent: 28.7,
				createdAt: "2025-02-14T09:30:00.000Z",
				lastConversionAt: "2026-07-21T17:42:00.000Z",
			},
			{
				code: "LINA-SUMMER",
				label: "Summer workshop",
				status: "expired",
				landingPath: "/workshops/launch",
				clicks: 1_184,
				visitorRatePercent: 75.6,
				signupRatePercent: 22.1,
				paidRatePercent: 34.3,
				averageOrderUsdMinor: 2_900,
				pendingRatePercent: 0,
				createdAt: "2025-06-01T08:00:00.000Z",
				expiresAt: "2025-09-01T00:00:00.000Z",
				lastConversionAt: "2025-08-29T13:14:00.000Z",
			},
		],
	},
	{
		userId: "usr_1008",
		name: "Rania Aouar",
		email: "rania.aouar@wandit.test",
		company: "Northbound Notes",
		channel: "creator",
		status: "active",
		country: "Canada",
		joinedAt: "2024-12-07T18:31:00.000Z",
		lastActiveAt: "2026-07-22T19:45:00.000Z",
		defaultCommissionRatePercent: 17.5,
		payoutMethod: "paypal",
		payoutEmail: "hello@northboundnotes.ca",
		notes: "Strong conversion from bilingual product tutorials.",
		codes: [
			{
				code: "RANIA",
				label: "YouTube descriptions",
				landingPath: "/ai-website-builder",
				clicks: 5_093,
				visitorRatePercent: 73.9,
				signupRatePercent: 17.8,
				paidRatePercent: 39.2,
				averageOrderUsdMinor: 4_260,
				pendingRatePercent: 24.5,
				createdAt: "2024-12-09T12:00:00.000Z",
				lastConversionAt: "2026-07-22T15:06:00.000Z",
			},
			{
				code: "NORTHBOUND15",
				label: "Newsletter readers",
				landingPath: "/templates",
				commissionRatePercent: 15,
				clicks: 1_946,
				visitorRatePercent: 84.1,
				signupRatePercent: 14.9,
				paidRatePercent: 45.7,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 31.8,
				createdAt: "2025-04-20T14:20:00.000Z",
				lastConversionAt: "2026-07-20T18:25:00.000Z",
			},
		],
	},
	{
		userId: "usr_1014",
		name: "Imene Boudjellal",
		email: "imene.boudjellal@wandit.test",
		company: "Founders DZ",
		channel: "community",
		status: "paused",
		country: "Algeria",
		joinedAt: "2025-06-09T07:25:00.000Z",
		lastActiveAt: "2026-07-02T12:01:00.000Z",
		defaultCommissionRatePercent: 16,
		payoutMethod: "bank-transfer",
		payoutEmail: "finance@foundersdz.com",
		notes: "Program paused while the linked account is reviewed.",
		codes: [
			{
				code: "FOUNDERSDZ",
				label: "Community members",
				status: "paused",
				landingPath: "/start",
				clicks: 3_721,
				visitorRatePercent: 69.8,
				signupRatePercent: 13.6,
				paidRatePercent: 29.4,
				averageOrderUsdMinor: 3_440,
				pendingRatePercent: 52.6,
				createdAt: "2025-06-11T11:00:00.000Z",
				lastConversionAt: "2026-06-28T09:44:00.000Z",
			},
			{
				code: "IMENE-LIVE",
				label: "Live workshop",
				status: "paused",
				landingPath: "/events/founder-sprint",
				commissionRatePercent: 20,
				clicks: 874,
				visitorRatePercent: 82.7,
				signupRatePercent: 24.8,
				paidRatePercent: 36.1,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 64.2,
				createdAt: "2026-02-03T16:15:00.000Z",
				lastConversionAt: "2026-06-25T19:08:00.000Z",
			},
		],
	},
	{
		userId: "usr_1020",
		name: "Lucas Martin",
		email: "lucas.martin@wandit.test",
		company: "Atelier Launch",
		channel: "agency",
		status: "active",
		country: "France",
		joinedAt: "2025-12-12T08:38:00.000Z",
		lastActiveAt: "2026-07-22T17:10:00.000Z",
		defaultCommissionRatePercent: 22,
		payoutMethod: "wise",
		payoutEmail: "ops@atelierlaunch.fr",
		notes: "Agency referrals from client handoffs and cohort programs.",
		codes: [
			{
				code: "ATELIER22",
				label: "Client handoff",
				landingPath: "/agencies",
				clicks: 4_412,
				visitorRatePercent: 86.3,
				signupRatePercent: 21.5,
				paidRatePercent: 53.8,
				averageOrderUsdMinor: 5_380,
				pendingRatePercent: 18.4,
				createdAt: "2025-12-15T09:40:00.000Z",
				lastConversionAt: "2026-07-22T12:33:00.000Z",
			},
			{
				code: "LAUNCH-CAMP",
				label: "Launch cohort",
				landingPath: "/cohorts/launch",
				commissionRatePercent: 25,
				clicks: 1_538,
				visitorRatePercent: 79.6,
				signupRatePercent: 26.2,
				paidRatePercent: 58.1,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 35.7,
				createdAt: "2026-03-02T10:00:00.000Z",
				lastConversionAt: "2026-07-19T14:56:00.000Z",
			},
			{
				code: "ATELIER-OLD",
				label: "Legacy offer",
				status: "expired",
				landingPath: "/start",
				commissionRatePercent: 18,
				clicks: 692,
				visitorRatePercent: 72.4,
				signupRatePercent: 11.8,
				paidRatePercent: 31.5,
				averageOrderUsdMinor: 2_900,
				pendingRatePercent: 0,
				createdAt: "2025-12-12T10:00:00.000Z",
				expiresAt: "2026-03-01T00:00:00.000Z",
				lastConversionAt: "2026-02-24T08:11:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Maya El Amrani",
		email: "maya@makersatlas.ma",
		company: "Makers Atlas",
		channel: "community",
		status: "active",
		country: "Morocco",
		joinedAt: "2025-09-18T13:12:00.000Z",
		lastActiveAt: "2026-07-23T06:34:00.000Z",
		defaultCommissionRatePercent: 18,
		payoutMethod: "wise",
		payoutEmail: "maya@makersatlas.ma",
		notes: "Regional no-code community and monthly office hours.",
		codes: [
			{
				code: "MAKERSATLAS",
				label: "Community hub",
				landingPath: "/start",
				clicks: 7_294,
				visitorRatePercent: 76.8,
				signupRatePercent: 18.3,
				paidRatePercent: 41.9,
				averageOrderUsdMinor: 4_640,
				pendingRatePercent: 26.9,
				createdAt: "2025-09-20T11:30:00.000Z",
				lastConversionAt: "2026-07-23T05:52:00.000Z",
			},
			{
				code: "ATLAS-OFFICE",
				label: "Office hours",
				landingPath: "/community",
				commissionRatePercent: 20,
				clicks: 1_127,
				visitorRatePercent: 88.2,
				signupRatePercent: 23.6,
				paidRatePercent: 47.4,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 42.3,
				createdAt: "2026-04-10T15:00:00.000Z",
				lastConversionAt: "2026-07-18T20:16:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Théo Bernard",
		email: "theo@saasfragments.com",
		company: "SaaS Fragments",
		channel: "creator",
		status: "active",
		country: "Belgium",
		joinedAt: "2026-01-22T09:50:00.000Z",
		lastActiveAt: "2026-07-21T16:42:00.000Z",
		defaultCommissionRatePercent: 15,
		payoutMethod: "paypal",
		payoutEmail: "payouts@saasfragments.com",
		notes: "Product breakdowns and implementation tutorials.",
		codes: [
			{
				code: "FRAGMENTS15",
				label: "Main audience",
				landingPath: "/templates/saas",
				clicks: 3_386,
				visitorRatePercent: 82.5,
				signupRatePercent: 15.7,
				paidRatePercent: 44.2,
				averageOrderUsdMinor: 4_180,
				pendingRatePercent: 19.8,
				createdAt: "2026-01-24T12:00:00.000Z",
				lastConversionAt: "2026-07-21T13:27:00.000Z",
			},
			{
				code: "BUILD-WITH-THEO",
				label: "Tutorial series",
				landingPath: "/learn",
				commissionRatePercent: 17.5,
				clicks: 1_709,
				visitorRatePercent: 71.3,
				signupRatePercent: 20.4,
				paidRatePercent: 38.7,
				averageOrderUsdMinor: 3_940,
				pendingRatePercent: 33.1,
				createdAt: "2026-04-06T08:15:00.000Z",
				lastConversionAt: "2026-07-17T22:02:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Nour Bensaïd",
		email: "nour@buildcircle.dz",
		company: "Build Circle",
		channel: "community",
		status: "pending",
		country: "Algeria",
		joinedAt: "2026-07-19T14:05:00.000Z",
		lastActiveAt: "2026-07-22T11:38:00.000Z",
		defaultCommissionRatePercent: 18,
		payoutMethod: null,
		payoutEmail: null,
		notes: "Awaiting payout details before the first campaign.",
		codes: [
			{
				code: "BUILDCIRCLE",
				label: "Launch code",
				status: "paused",
				landingPath: "/start",
				clicks: 0,
				visitorRatePercent: 0,
				signupRatePercent: 0,
				paidRatePercent: 0,
				averageOrderUsdMinor: 0,
				pendingRatePercent: 0,
				createdAt: "2026-07-19T14:18:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Sofia Rami",
		email: "partnerships@ramiandco.ae",
		company: "Rami & Co.",
		channel: "agency",
		status: "active",
		country: "United Arab Emirates",
		joinedAt: "2025-11-03T06:45:00.000Z",
		lastActiveAt: "2026-07-23T08:09:00.000Z",
		defaultCommissionRatePercent: 24,
		payoutMethod: "bank-transfer",
		payoutEmail: "finance@ramiandco.ae",
		notes: "Highest-value agency channel; quarterly payout review.",
		codes: [
			{
				code: "RAMI24",
				label: "Agency clients",
				landingPath: "/agencies",
				clicks: 5_816,
				visitorRatePercent: 89.1,
				signupRatePercent: 24.7,
				paidRatePercent: 61.3,
				averageOrderUsdMinor: 6_240,
				pendingRatePercent: 16.7,
				createdAt: "2025-11-04T08:00:00.000Z",
				lastConversionAt: "2026-07-23T07:18:00.000Z",
			},
			{
				code: "RAMI-FOUNDERS",
				label: "Founder network",
				landingPath: "/start",
				commissionRatePercent: 20,
				clicks: 2_147,
				visitorRatePercent: 80.6,
				signupRatePercent: 20.9,
				paidRatePercent: 49.4,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 27.5,
				createdAt: "2026-01-18T10:10:00.000Z",
				lastConversionAt: "2026-07-20T05:46:00.000Z",
			},
			{
				code: "RAMI-SCALE",
				label: "Scale workshop",
				landingPath: "/events/scale",
				commissionRatePercent: 27,
				clicks: 936,
				visitorRatePercent: 91.2,
				signupRatePercent: 29.8,
				paidRatePercent: 56.7,
				averageOrderUsdMinor: 6_900,
				pendingRatePercent: 39.8,
				createdAt: "2026-05-12T07:30:00.000Z",
				lastConversionAt: "2026-07-16T10:22:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Adam Tarek",
		email: "adam@pixelbrief.eg",
		company: "Pixel Brief",
		channel: "creator",
		status: "active",
		country: "Egypt",
		joinedAt: "2026-02-16T10:24:00.000Z",
		lastActiveAt: "2026-07-20T21:15:00.000Z",
		defaultCommissionRatePercent: 16,
		payoutMethod: "paypal",
		payoutEmail: "adam@pixelbrief.eg",
		notes: "Arabic design tutorials and template reviews.",
		codes: [
			{
				code: "PIXELBRIEF",
				label: "Tutorial audience",
				landingPath: "/templates",
				clicks: 2_793,
				visitorRatePercent: 77.3,
				signupRatePercent: 18.6,
				paidRatePercent: 35.8,
				averageOrderUsdMinor: 3_860,
				pendingRatePercent: 29.4,
				createdAt: "2026-02-17T12:00:00.000Z",
				lastConversionAt: "2026-07-20T18:37:00.000Z",
			},
			{
				code: "ADAM-LIVE",
				label: "Livestream offer",
				landingPath: "/start",
				commissionRatePercent: 19,
				clicks: 618,
				visitorRatePercent: 85.9,
				signupRatePercent: 27.2,
				paidRatePercent: 41.5,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 46.2,
				createdAt: "2026-06-02T17:00:00.000Z",
				lastConversionAt: "2026-07-12T23:14:00.000Z",
			},
		],
	},
	{
		userId: null,
		name: "Camille Dufour",
		email: "camille@independents.ch",
		company: "Independents CH",
		channel: "partner",
		status: "paused",
		country: "Switzerland",
		joinedAt: "2025-08-11T11:16:00.000Z",
		lastActiveAt: "2026-06-26T09:32:00.000Z",
		defaultCommissionRatePercent: 14,
		payoutMethod: "wise",
		payoutEmail: "camille@independents.ch",
		notes: "Seasonal partner; campaigns resume in September.",
		codes: [
			{
				code: "INDIECH",
				label: "Partner directory",
				status: "paused",
				landingPath: "/start",
				clicks: 2_082,
				visitorRatePercent: 74.6,
				signupRatePercent: 12.4,
				paidRatePercent: 33.7,
				averageOrderUsdMinor: 4_120,
				pendingRatePercent: 11.2,
				createdAt: "2025-08-13T08:00:00.000Z",
				lastConversionAt: "2026-06-22T10:41:00.000Z",
			},
			{
				code: "CAMILLE-Q1",
				label: "Q1 campaign",
				status: "expired",
				landingPath: "/templates/consulting",
				commissionRatePercent: 16,
				clicks: 1_304,
				visitorRatePercent: 80.3,
				signupRatePercent: 17.1,
				paidRatePercent: 36.4,
				averageOrderUsdMinor: 4_900,
				pendingRatePercent: 0,
				createdAt: "2026-01-05T07:00:00.000Z",
				expiresAt: "2026-04-01T00:00:00.000Z",
				lastConversionAt: "2026-03-27T16:29:00.000Z",
			},
		],
	},
];

let affiliatesMemory: Affiliate[] | null = null;
let mutationSequence = 0;

export function listMockAffiliates(): Affiliate[] {
	return getAffiliates().map(cloneAffiliate);
}

export function getMockAffiliate(affiliateId: string): Affiliate {
	return cloneAffiliate(requireAffiliate(affiliateId));
}

export function createMockAffiliate(input: CreateAffiliateInput): Affiliate {
	const affiliates = getAffiliates();
	const name = requireText(input.name, "Affiliate name");
	const email = requireEmail(input.email);
	const defaultCommissionRatePercent = requireCommissionRate(
		input.defaultCommissionRatePercent,
	);

	if (
		affiliates.some(
			(affiliate) => affiliate.email.toLowerCase() === email.toLowerCase(),
		)
	) {
		throw new Error("An affiliate with this email already exists.");
	}

	const now = new Date().toISOString();
	const affiliateId = nextMutationId("aff");
	const affiliate: Affiliate = {
		id: affiliateId,
		userId: null,
		name,
		email,
		avatarUrl: `/images/avatars/${String((affiliates.length % 12) + 1).padStart(2, "0")}.png`,
		company: cleanOptionalText(input.company),
		channel: input.channel,
		status: "pending",
		country: requireText(input.country, "Country"),
		joinedAt: now,
		lastActiveAt: now,
		defaultCommissionRatePercent,
		payoutMethod: input.payoutMethod ?? null,
		payoutEmail: cleanOptionalText(input.payoutEmail),
		notes: cleanOptionalText(input.notes),
		codes: [],
		performance: { ...EMPTY_PERFORMANCE },
	};

	if (input.initialCode) {
		affiliate.codes.push(
			buildNewCode(affiliate, input.initialCode, "paused", now),
		);
		affiliate.performance = summarizeCodes(affiliate.codes);
	}

	affiliates.unshift(affiliate);
	persistAffiliates();
	return cloneAffiliate(affiliate);
}

export function createMockAffiliateCode(
	affiliateId: string,
	input: AffiliateCodeDraft,
): Affiliate {
	const affiliate = requireAffiliate(affiliateId);
	const status: AffiliateCodeStatus =
		affiliate.status === "active" ? "active" : "paused";

	affiliate.codes.unshift(
		buildNewCode(affiliate, input, status, new Date().toISOString()),
	);
	affiliate.lastActiveAt = new Date().toISOString();
	affiliate.performance = summarizeCodes(affiliate.codes);

	persistAffiliates();
	return cloneAffiliate(affiliate);
}

export function setMockAffiliateStatus({
	affiliateId,
	status,
}: SetAffiliateStatusInput): Affiliate {
	const affiliate = requireAffiliate(affiliateId);
	affiliate.status = status;
	affiliate.lastActiveAt = new Date().toISOString();

	persistAffiliates();
	return cloneAffiliate(affiliate);
}

export function setMockAffiliateCodeStatus({
	affiliateId,
	codeId,
	status,
}: SetAffiliateCodeStatusInput): Affiliate {
	const affiliate = requireAffiliate(affiliateId);
	const code = affiliate.codes.find((candidate) => candidate.id === codeId);

	if (!code) {
		throw new Error(`Affiliate code "${codeId}" was not found.`);
	}

	if (code.status === "expired") {
		throw new Error("Expired affiliate codes cannot be reactivated.");
	}

	code.status = status;
	affiliate.lastActiveAt = new Date().toISOString();

	persistAffiliates();
	return cloneAffiliate(affiliate);
}

function getAffiliates() {
	if (affiliatesMemory) {
		return affiliatesMemory;
	}

	affiliatesMemory = readPersistedAffiliates() ?? createSeedAffiliates();
	return affiliatesMemory;
}

function requireAffiliate(affiliateId: string) {
	const affiliate = getAffiliates().find(
		(candidate) => candidate.id === affiliateId,
	);

	if (!affiliate) {
		throw new Error(`Affiliate "${affiliateId}" was not found.`);
	}

	return affiliate;
}

function createSeedAffiliates(): Affiliate[] {
	return SEED_AFFILIATES.map((seed, affiliateIndex) => {
		const codes = seed.codes.map((code, codeIndex) =>
			createSeedCode(
				code,
				affiliateIndex,
				codeIndex,
				seed.defaultCommissionRatePercent,
			),
		);

		return {
			...seed,
			id: `aff_${String(affiliateIndex + 1).padStart(4, "0")}`,
			avatarUrl: `/images/avatars/${String((affiliateIndex % 12) + 1).padStart(2, "0")}.png`,
			codes,
			performance: summarizeCodes(codes),
		};
	});
}

function createSeedCode(
	seed: SeedCode,
	affiliateIndex: number,
	codeIndex: number,
	defaultCommissionRatePercent: number,
): AffiliateCode {
	const uniqueVisitors = Math.round(
		seed.clicks * (seed.visitorRatePercent / 100),
	);
	const signups = Math.round(uniqueVisitors * (seed.signupRatePercent / 100));
	const paidConversions = Math.round(signups * (seed.paidRatePercent / 100));
	const revenueUsdMinor = paidConversions * seed.averageOrderUsdMinor;
	const commissionRatePercent =
		seed.commissionRatePercent ?? defaultCommissionRatePercent;
	const commissionUsdMinor = Math.round(
		revenueUsdMinor * (commissionRatePercent / 100),
	);
	const pendingCommissionUsdMinor = Math.round(
		commissionUsdMinor * (seed.pendingRatePercent / 100),
	);

	return {
		id: `code_${affiliateIndex + 1}_${codeIndex + 1}`,
		code: seed.code,
		label: seed.label,
		landingPath: seed.landingPath,
		status: seed.status ?? "active",
		commissionRatePercent,
		attributionWindowDays: seed.attributionWindowDays ?? 30,
		createdAt: seed.createdAt,
		expiresAt: seed.expiresAt ?? null,
		lastConversionAt: seed.lastConversionAt ?? null,
		performance: {
			clicks: seed.clicks,
			uniqueVisitors,
			signups,
			paidConversions,
			conversionRatePercent: ratioPercent(paidConversions, uniqueVisitors),
			revenueUsdMinor,
			commissionUsdMinor,
			paidCommissionUsdMinor: commissionUsdMinor - pendingCommissionUsdMinor,
			pendingCommissionUsdMinor,
		},
	};
}

function buildNewCode(
	affiliate: Affiliate,
	input: AffiliateCodeDraft,
	status: AffiliateCodeStatus,
	createdAt: string,
): AffiliateCode {
	const code = normalizeCode(input.code);
	assertUniqueCode(code);
	const expiresAt = input.expiresAt ?? null;

	if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
		throw new Error("Code expiration must be a valid date.");
	}

	return {
		id: nextMutationId("code"),
		code,
		label: requireText(input.label, "Code label"),
		landingPath: normalizeLandingPath(input.landingPath),
		status,
		commissionRatePercent: requireCommissionRate(
			input.commissionRatePercent ?? affiliate.defaultCommissionRatePercent,
		),
		attributionWindowDays: requireAttributionWindow(
			input.attributionWindowDays ?? 30,
		),
		createdAt,
		expiresAt,
		lastConversionAt: null,
		performance: { ...EMPTY_PERFORMANCE },
	};
}

function summarizeCodes(codes: readonly AffiliateCode[]): AffiliatePerformance {
	const totals = codes.reduce(
		(summary, code) => {
			summary.clicks += code.performance.clicks;
			summary.uniqueVisitors += code.performance.uniqueVisitors;
			summary.signups += code.performance.signups;
			summary.paidConversions += code.performance.paidConversions;
			summary.revenueUsdMinor += code.performance.revenueUsdMinor;
			summary.commissionUsdMinor += code.performance.commissionUsdMinor;
			summary.paidCommissionUsdMinor += code.performance.paidCommissionUsdMinor;
			summary.pendingCommissionUsdMinor +=
				code.performance.pendingCommissionUsdMinor;
			return summary;
		},
		{ ...EMPTY_PERFORMANCE },
	);

	totals.conversionRatePercent = ratioPercent(
		totals.paidConversions,
		totals.uniqueVisitors,
	);
	return totals;
}

function readPersistedAffiliates() {
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
		if (!isPersistedAffiliatesState(value)) {
			return null;
		}

		return value.affiliates.map((affiliate) => ({
			...cloneAffiliate(affiliate),
			performance: summarizeCodes(affiliate.codes),
		}));
	} catch {
		return null;
	}
}

function persistAffiliates() {
	const storage = getStorage();
	if (!storage || !affiliatesMemory) {
		return;
	}

	const state: PersistedAffiliatesStateV1 = {
		version: STORAGE_VERSION,
		affiliates: affiliatesMemory,
	};

	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// The in-memory mock remains usable when storage is blocked or full.
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

function isPersistedAffiliatesState(
	value: unknown,
): value is PersistedAffiliatesStateV1 {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<PersistedAffiliatesStateV1>;
	return (
		candidate.version === STORAGE_VERSION &&
		Array.isArray(candidate.affiliates) &&
		candidate.affiliates.every(
			(affiliate) =>
				affiliate &&
				typeof affiliate === "object" &&
				typeof affiliate.id === "string" &&
				typeof affiliate.name === "string" &&
				typeof affiliate.email === "string" &&
				Array.isArray(affiliate.codes) &&
				affiliate.codes.every(
					(code) =>
						code &&
						typeof code === "object" &&
						typeof code.id === "string" &&
						typeof code.code === "string" &&
						typeof code.performance === "object",
				),
		)
	);
}

function cloneAffiliate(affiliate: Affiliate): Affiliate {
	return {
		...affiliate,
		codes: affiliate.codes.map((code) => ({
			...code,
			performance: { ...code.performance },
		})),
		performance: { ...affiliate.performance },
	};
}

function assertUniqueCode(code: string) {
	const normalized = code.toLowerCase();
	const exists = getAffiliates().some((affiliate) =>
		affiliate.codes.some(
			(candidate) => candidate.code.toLowerCase() === normalized,
		),
	);

	if (exists) {
		throw new Error(`The affiliate code "${code}" is already in use.`);
	}
}

function normalizeCode(value: string) {
	const code = value.trim().toUpperCase();
	if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
		throw new Error(
			"Affiliate codes must be 3–32 characters using letters, numbers, dashes, or underscores.",
		);
	}
	return code;
}

function normalizeLandingPath(value: string | undefined) {
	const path = value?.trim() || "/start";
	return path.startsWith("/") ? path : `/${path}`;
}

function requireText(value: string, label: string) {
	const clean = value.trim();
	if (!clean) {
		throw new Error(`${label} is required.`);
	}
	return clean;
}

function cleanOptionalText(value: string | undefined) {
	const clean = value?.trim();
	return clean || null;
}

function requireEmail(value: string) {
	const email = requireText(value, "Email address").toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new Error("Enter a valid affiliate email address.");
	}
	return email;
}

function requireCommissionRate(value: number) {
	if (!Number.isFinite(value) || value <= 0 || value > 50) {
		throw new Error("Commission rate must be greater than 0% and at most 50%.");
	}
	return Math.round(value * 10) / 10;
}

function requireAttributionWindow(value: number) {
	if (!Number.isInteger(value) || value < 1 || value > 365) {
		throw new Error("Attribution window must be between 1 and 365 days.");
	}
	return value;
}

function ratioPercent(value: number, totalValue: number) {
	if (totalValue === 0) {
		return 0;
	}
	return Math.round((value / totalValue) * 1_000) / 10;
}

function nextMutationId(prefix: string) {
	mutationSequence += 1;
	return `${prefix}_${Date.now().toString(36)}_${mutationSequence.toString(36)}`;
}
