import { describe, expect, it } from "vitest";

import { followDeadlineFor, statusToolFor } from "./provider-job-follow";

describe("provider job follow", () => {
	it("uses the dedicated Higgsfield Personal Clipper status tool and id", () => {
		expect(statusToolFor("higgsfield", "personal_clipper_create")).toEqual({
			idProperty: "row_id",
			toolName: "personal_clipper_status",
		});
	});

	it("keeps job_status for every other provider and submitted tool", () => {
		expect(statusToolFor("higgsfield", "generate_video")).toEqual({
			toolName: "job_status",
		});
		expect(
			statusToolFor("another-provider", "personal_clipper_create"),
		).toEqual({ toolName: "job_status" });
	});

	it("normalizes provider and tool casing at the routing boundary", () => {
		expect(statusToolFor(" HIGGSFIELD ", " PERSONAL_CLIPPER_CREATE ")).toEqual({
			idProperty: "row_id",
			toolName: "personal_clipper_status",
		});
	});

	it("follows Personal Clipper for 50 minutes", () => {
		expect(followDeadlineFor("personal_clipper_create")).toBe(50 * 60 * 1000);
		expect(followDeadlineFor(" PERSONAL_CLIPPER_CREATE ")).toBe(50 * 60 * 1000);
	});

	it("keeps the existing 25-minute deadline for other tools", () => {
		expect(followDeadlineFor("generate_video")).toBe(25 * 60 * 1000);
		expect(followDeadlineFor("personal_clipper_status")).toBe(25 * 60 * 1000);
	});
});
