/**
 * Mock data of the More panels: backend, sign-in, payments, domains,
 * app stores, and settings.
 * Read only by api/app-builder.services.ts.
 * Generated-app content stays in English on purpose (docs/localization.md).
 */

import type {
	AppStoresSummary,
	BackendSummary,
	PaymentsSummary,
	ProjectDomain,
	ProjectSettings,
	SignInSummary,
} from "../api/dto";

export const MOCK_BACKEND: BackendSummary = {
	rowCount: 10_491,
	sizeMb: 38,
	storageGb: 1.2,
	storageNote: "Member photos, class posters",
	functionCallsToday: 2_104,
	tables: [
		{
			name: "members",
			columns: [
				"id",
				"phone",
				"full_name",
				"plan_id",
				"expires_at",
				"photo_url",
			],
			rowCount: 312,
		},
		{
			name: "plans",
			columns: ["id", "name", "price_dzd", "duration_days"],
			rowCount: 3,
		},
		{
			name: "payments",
			columns: [
				"id",
				"member_id",
				"amount_dzd",
				"provider",
				"status",
				"created_at",
			],
			rowCount: 1_204,
		},
		{
			name: "check_ins",
			columns: ["id", "member_id", "scanned_by", "scanned_at"],
			rowCount: 8_930,
		},
		{
			name: "classes",
			columns: ["id", "title", "coach", "starts_at", "capacity", "studio"],
			rowCount: 42,
		},
	],
	functions: [
		{ name: "createCheckout", trigger: "Called from app", callsToday: 96 },
		{ name: "paymentsWebhook", trigger: "Chargily event", callsToday: 91 },
		{ name: "verifyPass", trigger: "Door scanner", callsToday: 1_870 },
		{ name: "sendOtp", trigger: "Sign-in", callsToday: 47 },
	],
};

export const MOCK_SIGN_IN: SignInSummary = {
	userCount: 312,
	methods: [
		{ id: "phoneOtp", enabled: true },
		{ id: "emailPassword", enabled: false },
		{ id: "google", enabled: false },
		{ id: "magicLink", enabled: false },
	],
};

export const MOCK_PAYMENTS: PaymentsSummary = {
	provider: {
		name: "Chargily Pay",
		account: "nadi-fitness",
		cards: "CIB and Edahabia cards",
		mode: "live",
	},
	products: [
		{
			id: "monthly",
			name: "Monthly pass",
			billing: { kind: "recurring", days: 30 },
			priceDzd: 2_500,
		},
		{
			id: "quarterly",
			name: "Quarterly pass",
			billing: { kind: "recurring", days: 90 },
			priceDzd: 6_500,
		},
		{
			id: "day",
			name: "Day pass",
			billing: { kind: "oneTime" },
			priceDzd: 500,
		},
	],
	collectedDzd: 780_000,
	collectedMonth: "2026-09",
	paymentCount: 312,
	refundCount: 2,
	webhookPath: "/api/payments/webhook",
	webhookReceiving: true,
};

/** Payments before the user connects a provider. Used by the mobile mock project. */
export const MOCK_PAYMENTS_NOT_CONNECTED: PaymentsSummary = {
	provider: null,
	products: [],
	collectedDzd: 0,
	collectedMonth: "2026-09",
	paymentCount: 0,
	refundCount: 0,
	webhookPath: "/api/payments/webhook",
	webhookReceiving: false,
};

export const MOCK_DOMAINS: ProjectDomain[] = [
	{
		host: "nadi.wandit.app",
		kind: "wandit",
		status: "live",
		cnameTarget: null,
	},
	{
		host: "nadifitness.dz",
		kind: "custom",
		status: "verifying",
		cnameTarget: "proxy.wandit.app",
	},
];

export const MOCK_APP_STORES: AppStoresSummary = {
	ios: {
		status: "readyToSubmit",
		bundleId: "dz.nadi.app",
		latestBuild: 12,
		testflightTesters: 9,
	},
	android: { status: "notSetUp" },
	listing: [
		{
			id: "appIcon",
			done: true,
			detail: "1024 × 1024 · generated from your logo",
		},
		{
			id: "appName",
			done: true,
			detail: "Nadi Fitness · Your gym, in your pocket",
		},
		{ id: "description", done: true, detail: "EN · FR · AR" },
		{
			id: "screenshots",
			done: true,
			detail: '6.7" and 6.1" · generated from preview',
		},
		{ id: "privacyUrl", done: false, detail: "" },
		{ id: "ageRating", done: false, detail: "Health & Fitness" },
	],
};

export const MOCK_SETTINGS: ProjectSettings = {
	collaboratorLimit: 5,
	collaborators: [
		{
			id: "u1",
			name: "Zaki Benali",
			subtitle: "zaki@nadi.dz",
			role: "owner",
			pending: false,
		},
		{
			id: "u2",
			name: "Yacine Boudiaf",
			subtitle: "Front desk",
			role: "editor",
			pending: false,
		},
		{
			id: "u3",
			name: "Lina Cherif",
			subtitle: "",
			role: "viewer",
			pending: true,
		},
	],
	environmentVariables: [
		{
			name: "CHARGILY_SECRET_KEY",
			value: null,
			setBy: "payments",
			isPublic: false,
		},
		{
			name: "SMS_PROVIDER_TOKEN",
			value: null,
			setBy: "signIn",
			isPublic: false,
		},
		{
			name: "APP_URL",
			value: "https://nadi.wandit.app",
			setBy: null,
			isPublic: true,
		},
	],
};
