/**
 * Mock projects of the app builder, one web app and one mobile app.
 * Read by api/app-builder.services.ts, which copies them into its store.
 * Generated-app content stays in English on purpose (docs/localization.md).
 */

import type { AppProject } from "../api/dto";

export const MOCK_APP_PROJECTS: AppProject[] = [
	{
		id: "nadi-fitness",
		name: "Nadi Fitness",
		description:
			"Membership app for a gym in Oran: member accounts, QR door pass and a front-desk dashboard.",
		kind: "web",
		engine: "v2_app",
		versionNumber: 4,
		unpublishedChanges: 3,
		hasCodeChanges: true,
	},
	{
		id: "nadi-fitness-mobile",
		name: "Nadi Fitness",
		description:
			"Membership app for a gym in Oran: member accounts, QR door pass and a front-desk dashboard.",
		kind: "mobile",
		engine: "v2_app",
		versionNumber: 4,
		unpublishedChanges: 3,
		hasCodeChanges: true,
	},
];
