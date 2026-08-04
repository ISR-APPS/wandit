import type { PageOverview } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	buildPublishedSlugRenameBody,
	buildPublishPageBody,
	deriveGenerationState,
	isHistoricalPreview,
	resolvePreviewVersion,
} from "./page-version-state";

const v1 = {
	id: "11111111-1111-4111-8111-111111111111",
	number: 1,
	createdAt: "2026-07-31T12:00:00.000Z",
};
const v2 = {
	id: "22222222-2222-4222-8222-222222222222",
	number: 2,
	createdAt: "2026-07-31T12:01:00.000Z",
};

function overview(patch: Partial<PageOverview> = {}): PageOverview {
	return {
		artifactId: "33333333-3333-4333-8333-333333333333",
		activeVersion: v1,
		latestAttempt: null,
		...patch,
	};
}

describe("resolvePreviewVersion", () => {
	it("follows the server active version when there is no manual selection", () => {
		expect(resolvePreviewVersion(null, v1)).toEqual(v1);
		expect(resolvePreviewVersion(null, v2)).toEqual(v2);
	});

	it("collapses a current-version selection back to server truth", () => {
		expect(resolvePreviewVersion(v1, v1)).toEqual(v1);
	});

	it("keeps an explicit historical selection when a newer version arrives", () => {
		expect(resolvePreviewVersion(v1, v2, [v1, v2])).toEqual(v1);
	});

	it("reconciles a selection made before overview finishes loading", () => {
		expect(resolvePreviewVersion(v2, undefined)).toEqual(v2);
		expect(resolvePreviewVersion(v2, v2)).toEqual(v2);
	});

	it("falls back to server-active when a selected version is no longer listed", () => {
		expect(resolvePreviewVersion(v1, v2, [v2])).toEqual(v2);
	});
});

describe("isHistoricalPreview", () => {
	it("only treats the server-active version as editable", () => {
		expect(isHistoricalPreview(v2, v2)).toBe(false);
		expect(isHistoricalPreview(v1, v2)).toBe(true);
		expect(isHistoricalPreview(v1, null)).toBe(true);
		expect(isHistoricalPreview(null, v2)).toBe(false);
	});
});

describe("buildPublishPageBody", () => {
	it("always sends the resolved preview version id", () => {
		expect(buildPublishPageBody(v1)).toEqual({ versionId: v1.id });
		expect(buildPublishPageBody(v1, "older-design")).toEqual({
			slug: "older-design",
			versionId: v1.id,
		});
	});
});

describe("buildPublishedSlugRenameBody", () => {
	it("pins a slug rename to the version that is currently live", () => {
		expect(buildPublishedSlugRenameBody("boutique", v1.id)).toEqual({
			slug: "boutique",
			versionId: v1.id,
		});
	});

	it("keeps the legacy fallback when current has no published version id", () => {
		expect(buildPublishedSlugRenameBody("boutique", null)).toEqual({
			slug: "boutique",
		});
	});
});

describe("deriveGenerationState", () => {
	it("maps queued and generating attempts to active toolbar phases", () => {
		expect(
			deriveGenerationState(
				overview({
					latestAttempt: {
						id: "44444444-4444-4444-8444-444444444444",
						status: "queued",
						error: null,
						versionId: null,
						createdAt: "2026-07-31T12:02:00.000Z",
					},
				}),
			),
		).toEqual({
			generationPhase: "thinking",
			isGenerating: true,
			pendingVersionNumber: 2,
		});

		expect(
			deriveGenerationState(
				overview({
					activeVersion: v2,
					latestAttempt: {
						id: "55555555-5555-4555-8555-555555555555",
						status: "generating",
						error: null,
						versionId: null,
						createdAt: "2026-07-31T12:03:00.000Z",
					},
				}),
			),
		).toEqual({
			generationPhase: "building",
			isGenerating: true,
			pendingVersionNumber: 3,
		});
	});

	it("returns idle outside an in-flight attempt", () => {
		expect(deriveGenerationState(overview())).toEqual({
			generationPhase: "idle",
			isGenerating: false,
			pendingVersionNumber: 2,
		});
	});
});
