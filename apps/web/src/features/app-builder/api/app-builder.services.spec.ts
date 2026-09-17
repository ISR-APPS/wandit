import type { AppProject as ApiAppProject } from "@wandit/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiClientError, type apiClient } from "@/lib/api-client";
import {
	getAppProject,
	getBuilderThread,
	getCodeFile,
	getPaymentsSummary,
	getProjectSettings,
	getSignInSummary,
	listAppProjects,
	resetMockStore,
	setCollaboratorRole,
	setPaymentsMode,
	setSignInMethod,
	toUiAppProject,
	updateAppProject,
} from "./app-builder.services";

const WEB_ID = "nadi-fitness";
const MOBILE_ID = "nadi-fitness-mobile";

beforeEach(() => {
	resetMockStore();
});

describe("getAppProject", () => {
	it("returns a copy, so a caller cannot change the store", async () => {
		const first = await getAppProject(WEB_ID);
		if (!first) throw new Error("fixture missing");
		first.name = "changed";
		const second = await getAppProject(WEB_ID);
		expect(second?.name).toBe("Nadi Fitness");
	});

	it("answers null on a 404 and rethrows every other API error", async () => {
		const realId = crypto.randomUUID();
		const getFails =
			(statusCode: number): typeof apiClient.get =>
			async () => {
				throw new ApiClientError({
					code: `HTTP_${statusCode}`,
					message: "The request failed.",
					path: `/api/v2/projects/${realId}`,
					requestId: "req-1",
					statusCode,
					timestamp: "2026-09-17T00:00:00.000Z",
				});
			};

		expect(await getAppProject(realId, getFails(404))).toBeNull();
		await expect(getAppProject(realId, getFails(500))).rejects.toMatchObject({
			statusCode: 500,
		});
	});
});

describe("listAppProjects", () => {
	it("returns only the seed rows after a real id seeded a placeholder", async () => {
		// The thread guard seeds every map of the store for the unknown id.
		await getBuilderThread(crypto.randomUUID());
		const projects = await listAppProjects();
		expect(projects.map((project) => project.id)).toEqual([
			"nadi-fitness",
			"nadi-fitness-mobile",
		]);
	});
});

describe("getBuilderThread", () => {
	it("seeds the mock fixtures for a real project id instead of throwing", async () => {
		const thread = await getBuilderThread(crypto.randomUUID());
		expect(thread.focusLabel).toBe("Pass screen");
	});
});

describe("updateAppProject", () => {
	it("changes the kind", async () => {
		const project = await updateAppProject(WEB_ID, { kind: "mobile" });
		expect(project.kind).toBe("mobile");
		expect((await getAppProject(WEB_ID))?.kind).toBe("mobile");
	});

	it("patches the real row of a fetched project, not a fixture", async () => {
		const realId = crypto.randomUUID();
		// SAFETY: the fake answers the one GET this case makes, and
		// getAppProject parses the answer with appProjectSchema.
		const getReal = (async () => ({
			...API_PROJECT,
			id: realId,
			targetPlatform: "mobile",
		})) as typeof apiClient.get;
		await getAppProject(realId, getReal);

		const project = await updateAppProject(realId, { name: "Atlas Two" });

		expect(project).toMatchObject({
			id: realId,
			name: "Atlas Two",
			slug: "atlas",
			kind: "mobile",
		});
	});
});

describe("setSignInMethod", () => {
	it("flips one method and leaves the others", async () => {
		const summary = await setSignInMethod(WEB_ID, {
			methodId: "google",
			enabled: true,
		});
		expect(summary.methods.find((m) => m.id === "google")?.enabled).toBe(true);
		expect(summary.methods.find((m) => m.id === "phoneOtp")?.enabled).toBe(
			true,
		);
		expect((await getSignInSummary(WEB_ID)).methods).toEqual(summary.methods);
	});
});

describe("setCollaboratorRole", () => {
	it("changes the role of one collaborator", async () => {
		const settings = await setCollaboratorRole(WEB_ID, {
			collaboratorId: "u2",
			role: "viewer",
		});
		expect(settings.collaborators.find((c) => c.id === "u2")?.role).toBe(
			"viewer",
		);
		expect((await getProjectSettings(WEB_ID)).collaborators[1]?.role).toBe(
			"viewer",
		);
	});
});

describe("setCollaboratorRole with an unknown id", () => {
	it("throws and changes nothing", async () => {
		await expect(
			setCollaboratorRole(WEB_ID, { collaboratorId: "nobody", role: "viewer" }),
		).rejects.toThrow("Unknown collaborator");
		expect((await getProjectSettings(WEB_ID)).collaborators[1]?.role).toBe(
			"editor",
		);
	});
});

describe("setPaymentsMode", () => {
	it("switches a connected provider to test keys", async () => {
		const summary = await setPaymentsMode(WEB_ID, "test");
		expect(summary.provider?.mode).toBe("test");
		expect((await getPaymentsSummary(WEB_ID)).provider?.mode).toBe("test");
	});

	it("leaves a project without a provider unchanged", async () => {
		const summary = await setPaymentsMode(MOBILE_ID, "live");
		expect(summary.provider).toBeNull();
	});
});

describe("getCodeFile", () => {
	it("returns null for a path outside the repository", async () => {
		expect(await getCodeFile(WEB_ID, "nope.ts")).toBeNull();
	});
});

// A V2 project answer as `GET /api/v2/projects/:id` sends it, per appProjectSchema.
const API_PROJECT = {
	id: crypto.randomUUID(),
	name: "Atlas Shop",
	engine: "v2_app",
	prompt: "A storefront for crafts",
	status: "draft",
	leadCount: 0,
	createdAt: "2026-09-10T10:00:00.000Z",
	updatedAt: "2026-09-10T10:00:00.000Z",
	thumbnailSeed: 7,
	previewImageUrl: null,
	logoUrl: null,
	publishedSlug: "atlas",
	metaPixelId: null,
	tiktokPixelId: null,
	hideWanditBadge: false,
	targetPlatform: "web",
	framework: "tanstack-start",
	templateVersion: "1",
	languages: ["ar", "fr", "en"],
} satisfies ApiAppProject;

describe("toUiAppProject", () => {
	it("maps a web project to the UI shape", () => {
		expect(toUiAppProject(API_PROJECT)).toEqual({
			id: API_PROJECT.id,
			name: "Atlas Shop",
			slug: "atlas",
			description: "A storefront for crafts",
			kind: "web",
			versionNumber: 0,
			unpublishedChanges: 0,
		});
	});

	it("maps a mobile target and a missing published slug", () => {
		const mobile = {
			...API_PROJECT,
			targetPlatform: "mobile",
			publishedSlug: undefined,
		} satisfies ApiAppProject;
		const ui = toUiAppProject(mobile);
		expect(ui.kind).toBe("mobile");
		expect(ui.slug).toBe("");
	});
});
