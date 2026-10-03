/**
 * Mock data of the More panels: sign-in, domains, app stores, and settings.
 * Read only by api/app-builder.services.ts.
 * Generated-app content stays in English on purpose (docs/localization.md).
 */

import type {
	AppStoresSummary,
	ProjectDomain,
	ProjectSettings,
	SignInSummary,
} from "../api/dto";

/** Sign-in panel data of every project: the member count of the seed gym app. */
export const MOCK_SIGN_IN: SignInSummary = {
	userCount: 312,
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

/** Settings panel data. Each `setBy` names a More panel that the nav still opens, so "Set by" shows its title. */
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
			name: "AI_API_KEY",
			value: null,
			setBy: "ai",
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
