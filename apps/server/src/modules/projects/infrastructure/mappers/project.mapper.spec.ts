import { describe, expect, it } from "vitest";

import type { ProjectQueryRow } from "../persistence/projects.repository";
import { mapProjectRow } from "./project.mapper";

function projectRow(
	previewImageUrl: string | null,
	logoUrl: string | null = null,
): ProjectQueryRow {
	return {
		activeSlug: null,
		createdAt: new Date("2026-07-31T08:00:00.000Z"),
		hideWanditBadge: false,
		id: "project_1",
		leadCount: 0,
		logoUrl,
		metaPixelId: null,
		name: "Summer launch",
		pendingDeploymentCount: 0,
		previewImageUrl,
		prompt: "Build a landing page",
		tiktokPixelId: null,
		updatedAt: new Date("2026-07-31T09:00:00.000Z"),
	};
}

describe("mapProjectRow", () => {
	it("passes through a preview image URL", () => {
		const previewImageUrl =
			"https://assets.example.com/sites/project_1/thumbnails/version_1.jpg";

		expect(mapProjectRow(projectRow(previewImageUrl)).previewImageUrl).toBe(
			previewImageUrl,
		);
	});

	it("passes through a null preview image URL", () => {
		expect(mapProjectRow(projectRow(null)).previewImageUrl).toBeNull();
	});

	it("passes through nullable project logo URLs", () => {
		const logoUrl =
			"https://assets.example.com/uploads/user_1/upload_1/brand.webp";

		expect(mapProjectRow(projectRow(null, logoUrl)).logoUrl).toBe(logoUrl);
		expect(mapProjectRow(projectRow(null)).logoUrl).toBeNull();
	});
});
