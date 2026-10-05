import { describe, expect, it } from "vitest";

import {
	easBuildStartOutputSchema,
	easBuildViewResponseSchema,
	mobileBuildSchema,
} from "./mobile-builds";

const BUILD = {
	artifactUrl: "https://expo.dev/artifacts/eas/abc.apk",
	commitSha: "a".repeat(40),
	completedAt: "2026-09-26T10:00:00.000Z",
	createdAt: "2026-09-26T09:40:00.000Z",
	errorCode: null,
	id: "0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10",
	kind: "apk",
	platform: "android",
	projectId: "7b1e2d3c-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
	status: "finished",
};

describe("mobileBuildSchema", () => {
	it("accepts an https APK URL", () => {
		expect(mobileBuildSchema.safeParse(BUILD).success).toBe(true);
	});

	it("refuses an APK URL that is not https", () => {
		for (const artifactUrl of [
			"javascript:alert(1)",
			"data:text/html,x",
			"http://expo.dev/artifacts/eas/abc.apk",
		]) {
			expect(
				mobileBuildSchema.safeParse({ ...BUILD, artifactUrl }).success,
			).toBe(false);
		}
	});
});

describe("EAS answers", () => {
	it("reads `eas build --json` output, which drops null keys", () => {
		const output = [{ id: "eas-1", platform: "ANDROID", status: "NEW" }];

		expect(easBuildStartOutputSchema.parse(output)).toEqual([
			{ id: "eas-1", status: "NEW" },
		]);
	});

	it("reads a GraphQL answer, which sends null fields", () => {
		const answer = {
			data: {
				builds: {
					byId: {
						artifacts: { buildUrl: null },
						error: null,
						id: "eas-1",
						status: "IN_PROGRESS",
					},
				},
			},
		};

		expect(easBuildViewResponseSchema.parse(answer).data?.builds.byId).toEqual({
			artifacts: { buildUrl: null },
			error: null,
			id: "eas-1",
			status: "IN_PROGRESS",
		});
	});

	it("refuses a GraphQL build URL that is not https", () => {
		const answer = {
			data: {
				builds: {
					byId: {
						artifacts: { buildUrl: "javascript:alert(1)" },
						id: "eas-1",
						status: "FINISHED",
					},
				},
			},
		};

		expect(easBuildViewResponseSchema.safeParse(answer).success).toBe(false);
	});
});
