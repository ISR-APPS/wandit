import type { DeploymentCurrent } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { canPublish, displaySlug, slugVerdict } from "./publish-state";

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
