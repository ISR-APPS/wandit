import type {
	AppProject as ApiAppProject,
	CloudBackendResponse,
	CodeFileResponse,
	CodeSnapshotResponse,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import {
	ApiClientError,
	type ApiRequestOptions,
	type apiClient,
} from "@/lib/api-client";
import {
	createAppProject,
	getAppProject,
	getBuilderThread,
	getCloudBackend,
	getCodeFile,
	getCodeSnapshot,
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

describe("createAppProject", () => {
	const body = {
		prompt: "A shop",
		targetPlatform: "web" as const,
		languages: ["fr" as const],
	};

	it("posts the body to the create route and parses the ids", async () => {
		const projectId = crypto.randomUUID();
		const chatId = crypto.randomUUID();
		const calls: { path: string; body: unknown }[] = [];
		// SAFETY: createAppProject passes only the path and the body to post.
		const post = (async (path: string, sent: unknown) => {
			calls.push({ path, body: sent });
			return { projectId, chatId, turnId: null };
		}) as typeof apiClient.post;

		const created = await createAppProject(body, post);

		expect(calls).toEqual([{ path: "/api/v2/projects", body }]);
		expect(created).toEqual({ projectId, chatId, turnId: null });
	});

	it("rejects an answer without the project id", async () => {
		// SAFETY: the fake ignores its arguments and answers a partial body.
		const post = (async () => ({
			chatId: crypto.randomUUID(),
		})) as typeof apiClient.post;

		await expect(createAppProject(body, post)).rejects.toThrow();
	});
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

/**
 * A GET that answers `body` and records each URL and query it got. The
 * backend `status` is a plain string, so a case can send a bad one.
 */
function getAnswers(
	body:
		| CodeSnapshotResponse
		| CodeFileResponse
		| (Omit<CloudBackendResponse, "status"> & { status: string }),
	calls: { url: string; options?: ApiRequestOptions }[] = [],
): typeof apiClient.get {
	// SAFETY: the fake answers the one GET of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, options?: ApiRequestOptions) => {
		calls.push({ options, url });
		return body;
	}) as typeof apiClient.get;
}

describe("code view API", () => {
	const projectId = crypto.randomUUID();

	/** A GET that fails with the API error `code` and `statusCode`. */
	const getFails =
		(statusCode: number, code: string): typeof apiClient.get =>
		async () => {
			throw new ApiClientError({
				code,
				message: "The request failed.",
				path: `/api/v2/projects/${projectId}/code`,
				requestId: "req-1",
				statusCode,
				timestamp: "2026-09-24T00:00:00.000Z",
			});
		};

	const snapshot: CodeSnapshotResponse = {
		branch: "main",
		defaultFilePath: "src/app.tsx",
		files: [
			{ binary: false, content: "x", path: "src/app.tsx", size: 1 },
			{ binary: true, content: "", path: "logo.png", size: 12 },
		],
		tree: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
	};

	it("parses the snapshot and maps its prefetched files apart from the tree", async () => {
		const calls: { url: string; options?: ApiRequestOptions }[] = [];
		const { signal } = new AbortController();
		expect(
			await getCodeSnapshot(projectId, signal, getAnswers(snapshot, calls)),
		).toEqual({
			files: [
				{ content: "x", kind: "text", path: "src/app.tsx", size: 1 },
				{ kind: "binary", path: "logo.png", size: 12 },
			],
			snapshot: {
				branch: "main",
				defaultFilePath: "src/app.tsx",
				tree: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
			},
		});
		expect(calls).toEqual([
			{ options: { signal }, url: `/api/v2/projects/${projectId}/code` },
		]);
	});

	it("answers null for an asleep sandbox and rethrows every other error", async () => {
		expect(
			await getCodeSnapshot(
				projectId,
				undefined,
				getFails(409, "SANDBOX_NOT_RUNNING"),
			),
		).toBeNull();
		await expect(
			getCodeSnapshot(projectId, undefined, getFails(500, "INTERNAL_ERROR")),
		).rejects.toMatchObject({ statusCode: 500 });
	});

	it("sends the path as a query value with the abort signal, and maps a text file", async () => {
		const calls: { url: string; options?: ApiRequestOptions }[] = [];
		const { signal } = new AbortController();
		const file = await getCodeFile(
			projectId,
			"src/a b.ts",
			signal,
			getAnswers(
				{ binary: false, content: "x", path: "src/a b.ts", size: 1 },
				calls,
			),
		);

		expect(file).toEqual({
			content: "x",
			kind: "text",
			path: "src/a b.ts",
			size: 1,
		});
		expect(calls).toEqual([
			{
				options: { query: { path: "src/a b.ts" }, signal },
				url: `/api/v2/projects/${projectId}/code/file`,
			},
		]);
	});

	it("maps a binary file", async () => {
		const file = await getCodeFile(
			projectId,
			"logo.png",
			undefined,
			getAnswers({ binary: true, content: "", path: "logo.png", size: 12 }),
		);

		expect(file).toEqual({ kind: "binary", path: "logo.png", size: 12 });
	});

	it("maps the file errors to a kind and rethrows every other error", async () => {
		expect(
			await getCodeFile(
				projectId,
				"gone.ts",
				undefined,
				getFails(404, "CODE_FILE_NOT_FOUND"),
			),
		).toEqual({ kind: "missing", path: "gone.ts" });
		expect(
			await getCodeFile(
				projectId,
				".env",
				undefined,
				getFails(400, "CODE_PATH_INVALID"),
			),
		).toEqual({ kind: "missing", path: ".env" });
		expect(
			await getCodeFile(
				projectId,
				"big.json",
				undefined,
				getFails(413, "CODE_FILE_TOO_LARGE"),
			),
		).toEqual({ kind: "tooLarge", path: "big.json" });
		await expect(
			getCodeFile(
				projectId,
				"src/app.tsx",
				undefined,
				getFails(409, "SANDBOX_NOT_RUNNING"),
			),
		).rejects.toMatchObject({ statusCode: 409 });
	});
});

describe("getCloudBackend", () => {
	const projectId = crypto.randomUUID();

	it("reads the backend route and parses the answer", async () => {
		const calls: { url: string; options?: ApiRequestOptions }[] = [];
		const backend: CloudBackendResponse = {
			status: "creating",
			ref: "abcdefghijklmnopqrst",
			region: "eu-west-3",
			failureCode: null,
		};

		expect(
			await getCloudBackend(projectId, getAnswers(backend, calls)),
		).toEqual(backend);
		expect(calls.map((call) => call.url)).toEqual([
			`/api/v2/projects/${projectId}/cloud/backend`,
		]);
	});

	it("rejects an answer with an unknown status", async () => {
		await expect(
			getCloudBackend(
				projectId,
				getAnswers({
					status: "booting",
					ref: null,
					region: null,
					failureCode: null,
				}),
			),
		).rejects.toThrow();
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
