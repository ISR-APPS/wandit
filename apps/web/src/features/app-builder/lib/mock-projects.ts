/**
 * Mock projects and versions of the app builder, one web app and one mobile app.
 * Read only by api/app-builder.services.ts, which copies them into its store.
 * Generated-app content stays in English on purpose (docs/localization.md).
 */

import type { AppProject, AppVersion } from "../api/dto";

export const MOCK_APP_PROJECTS: AppProject[] = [
	{
		id: "nadi-fitness",
		name: "Nadi Fitness",
		slug: "nadi",
		description:
			"Membership app for a gym in Oran: phone sign-in, CIB / Edahabia payments, QR door pass and a front-desk dashboard.",
		kind: "web",
		versionNumber: 4,
		unpublishedChanges: 3,
	},
	{
		id: "nadi-fitness-mobile",
		name: "Nadi Fitness",
		slug: "nadi",
		description:
			"Membership app for a gym in Oran: phone sign-in, CIB / Edahabia payments, QR door pass and a front-desk dashboard.",
		kind: "mobile",
		versionNumber: 4,
		unpublishedChanges: 3,
	},
];

/** Versions of every mock project, newest first. v3 is the live one. */
export const MOCK_APP_VERSIONS: AppVersion[] = [
	{
		number: 4,
		summary: "QR pass and door scanner",
		createdAt: "2026-09-03T18:40:00.000Z",
		isLive: false,
	},
	{
		number: 3,
		summary: "Added sign-in and payments",
		createdAt: "2026-09-03T17:55:00.000Z",
		isLive: true,
	},
	{
		number: 2,
		summary: "Database and phone sign-in",
		createdAt: "2026-09-03T17:20:00.000Z",
		isLive: false,
	},
	{
		number: 1,
		summary: "First screens and navigation",
		createdAt: "2026-09-03T16:50:00.000Z",
		isLive: false,
	},
];
