import { describe, expect, it } from "vitest";

import {
	supabaseCreateProjectResponseSchema,
	supabaseProjectUrl,
} from "./supabase-management";

describe("supabaseCreateProjectResponseSchema", () => {
	it("parses the documented V1ProjectResponse example shape", () => {
		const parsed = supabaseCreateProjectResponseSchema.safeParse({
			id: "bzkkgknsgekeqhgbbnze",
			ref: "abcdefghijklmnopqrst",
			organization_id: "48bc8086-cf3f-4a7a-9f2e-1ec3d60a53a3",
			organization_slug: "tsrqponmlkjihgfedcba",
			name: "wandit-proj_1",
			region: "eu-central-1",
			created_at: "2026-09-16T12:00:00.000Z",
			status: "INACTIVE",
		});

		expect(parsed.success).toBe(true);
	});
});

describe("supabaseProjectUrl", () => {
	it("builds the public URL from the ref", () => {
		expect(supabaseProjectUrl("abcdefghijklmnopqrst")).toBe(
			"https://abcdefghijklmnopqrst.supabase.co",
		);
	});
});
