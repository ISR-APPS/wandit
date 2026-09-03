import type { DeploymentCurrent } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	canPublish,
	displaySlug,
	publishableVersion,
	slugVerdict,
} from "./publish-state";

function current(patch: Partial<DeploymentCurrent> = {}): DeploymentCurrent {
	return {
		activeDeploymentId: null,
		error: null,
		liveUrl: null,
		pendingVersionId: null,
		publishedAt: null,
		publishedVersionId: null,
		slug: null,
		uiState: "draft",
		...patch,
	};
}

describe("displaySlug", () => {
	it("prefers the live slug over any local choice", () => {
		expect(
			displaySlug(current({ slug: "acme" }), "draft-pick", "My Shop"),
		).toBe("acme");
	});

	it("falls back to the pre-publish draft choice, then the project name", () => {
		expect(displaySlug(current(), "draft-pick", "My Shop")).toBe("draft-pick");
		expect(displaySlug(current(), null, "My Shop")).toBe("my-shop");
	});

	it("returns empty for names that produce no usable slug", () => {
		expect(displaySlug(current(), null, "متجري")).toBe("");
		expect(displaySlug(undefined, null, undefined)).toBe("");
	});
});

describe("slugVerdict", () => {
	const base = {
		slug: "acme",
		dirty: true,
		unchanged: false,
		checking: false,
		availability: { slug: "acme", available: true, reason: null } as const,
	};

	it("is idle until the user edits away from the saved slug", () => {
		expect(slugVerdict({ ...base, dirty: false })).toBe("idle");
		expect(slugVerdict({ ...base, unchanged: true })).toBe("idle");
	});

	it("flags invalid DNS labels before asking the server", () => {
		expect(slugVerdict({ ...base, slug: "-bad-" })).toBe("invalid");
		expect(slugVerdict({ ...base, slug: "Bad" })).toBe("invalid");
	});

	it("reports checking while the query is in flight or unsettled", () => {
		expect(slugVerdict({ ...base, checking: true })).toBe("checking");
		expect(slugVerdict({ ...base, availability: undefined })).toBe("checking");
	});

	it("maps the server verdicts", () => {
		expect(
			slugVerdict({
				...base,
				availability: { slug: "acme", available: false, reason: "taken" },
			}),
		).toBe("taken");
		expect(
			slugVerdict({
				...base,
				availability: { slug: "acme", available: false, reason: "reserved" },
			}),
		).toBe("reserved");
		expect(slugVerdict(base)).toBe("available");
	});
});

describe("canPublish", () => {
	it("requires a draft version and no publish in flight", () => {
		expect(canPublish(undefined)).toBe(false);
		expect(canPublish(current())).toBe(false);
		expect(canPublish(current({ pendingVersionId: crypto.randomUUID() }))).toBe(
			true,
		);
		expect(
			canPublish(
				current({
					pendingVersionId: crypto.randomUUID(),
					uiState: "publishing",
				}),
			),
		).toBe(false);
	});

	it("allows republish after a failure", () => {
		expect(
			canPublish(
				current({ pendingVersionId: crypto.randomUUID(), uiState: "failed" }),
			),
		).toBe(true);
	});
});

describe("publishableVersion", () => {
	it("returns null without a previewed version", () => {
		expect(publishableVersion(current(), null, null)).toBeNull();
	});

	it("offers the previewed version when the site has never been published", () => {
		const preview = { id: crypto.randomUUID(), number: 1 };

		expect(
			publishableVersion(
				current({ pendingVersionId: preview.id }),
				preview,
				null,
			),
		).toBe(preview);
	});

	it("returns null while publishing is in flight", () => {
		const preview = { id: crypto.randomUUID(), number: 2 };

		expect(
			publishableVersion(
				current({
					pendingVersionId: preview.id,
					publishedVersionId: crypto.randomUUID(),
					uiState: "publishing",
				}),
				preview,
				null,
			),
		).toBeNull();
	});

	it("falls back to a newer latest version when the preview is live", () => {
		const preview = { id: crypto.randomUUID(), number: 1 };
		const latest = { id: crypto.randomUUID(), number: 3 };

		expect(
			publishableVersion(
				current({
					publishedVersionId: preview.id,
					uiState: "published",
				}),
				preview,
				latest,
			),
		).toBe(latest);
	});

	it("returns null when the preview and latest version are already live", () => {
		const preview = { id: crypto.randomUUID(), number: 1 };

		expect(
			publishableVersion(
				current({
					publishedVersionId: preview.id,
					uiState: "published",
				}),
				preview,
				preview,
			),
		).toBeNull();
	});

	it("returns null when the preview is live without a latest version", () => {
		const preview = { id: crypto.randomUUID(), number: 1 };

		expect(
			publishableVersion(
				current({
					publishedVersionId: preview.id,
					uiState: "published",
				}),
				preview,
				null,
			),
		).toBeNull();
	});

	it("offers a newer draft than the live version", () => {
		const preview = { id: crypto.randomUUID(), number: 2 };

		expect(
			publishableVersion(
				current({
					pendingVersionId: preview.id,
					publishedVersionId: crypto.randomUUID(),
					uiState: "published",
				}),
				preview,
				preview,
			),
		).toBe(preview);
	});

	it("offers a historical version behind the live version", () => {
		const preview = { id: crypto.randomUUID(), number: 1 };
		const latest = { id: crypto.randomUUID(), number: 3 };

		expect(
			publishableVersion(
				current({
					publishedVersionId: crypto.randomUUID(),
					uiState: "published",
				}),
				preview,
				latest,
			),
		).toBe(preview);
	});

	it("offers the previewed version again after a failed publish", () => {
		const preview = { id: crypto.randomUUID(), number: 2 };

		expect(
			publishableVersion(
				current({
					pendingVersionId: preview.id,
					publishedVersionId: crypto.randomUUID(),
					uiState: "failed",
				}),
				preview,
				preview,
			),
		).toBe(preview);
	});
});
