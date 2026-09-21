import { describe, expect, it } from "vitest";

import type { ProjectQueryRow } from "../../../projects/infrastructure/persistence/projects.repository";
import { mapAppProjectRow } from "./app-project.mapper";

// Copy of the `projectRow` fixture of `app-projects.service.spec.ts`: the
// spec must not import from another spec file.
function projectRow(overrides: Partial<ProjectQueryRow> = {}): ProjectQueryRow {
	return {
		activeSlug: null,
		createdAt: new Date("2026-08-01T08:00:00.000Z"),
		engine: "v2_app",
		framework: "web-app",
		hideWanditBadge: false,
		id: "project-1",
		languages: ["fr", "en"],
		leadCount: 0,
		logoUrl: null,
		metaPixelId: null,
		name: "Booking app",
		pendingDeploymentCount: 0,
		previewImageUrl: null,
		prompt: "Build me a booking app",
		targetPlatform: "web",
		templateVersion: "web-app@1.0.0",
		tiktokPixelId: null,
		updatedAt: new Date("2026-08-01T09:00:00.000Z"),
		...overrides,
	};
}

describe("mapAppProjectRow", () => {
	it("maps a v2_app row to the AppProject fields", () => {
		expect(mapAppProjectRow(projectRow())).toMatchObject({
			createdAt: "2026-08-01T08:00:00.000Z",
			engine: "v2_app",
			framework: "web-app",
			id: "project-1",
			languages: ["fr", "en"],
			name: "Booking app",
			targetPlatform: "web",
			templateVersion: "web-app@1.0.0",
		});
	});

	it("throws on a language outside ar, fr, en", () => {
		expect(() => mapAppProjectRow(projectRow({ languages: ["xx"] }))).toThrow();
	});
});
