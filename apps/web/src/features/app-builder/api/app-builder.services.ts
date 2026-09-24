/**
 * Data layer of the app builder. Most functions are a mock store: each waits
 * a short delay and returns a copy, like a fetch. State lives in this module
 * until a reload. The functions under `// ---- Real API ----` call the V2
 * routes through `@/lib/api-client` and parse the response with contracts;
 * the Code view functions are there too.
 * Called by app-builder.queries.ts, app-builder.mutations.ts,
 * lib/use-builder-chat.ts, lib/use-preview-token.ts, and the route loader.
 */

import {
	type AppProject as ApiAppProject,
	appBuilderRoutes,
	appProjectSchema,
	type CancelTurnResponse,
	type CloudBackendResponse,
	type CodeFileResponse,
	type CreateAppProjectRequest,
	type CreateAppProjectResponse,
	cancelTurnResponseSchema,
	cloudBackendResponseSchema,
	cloudRoutes,
	codeFileResponseSchema,
	codeSnapshotResponseSchema,
	createAppProjectResponseSchema,
	type ListVersionsResponse,
	listVersionsResponseSchema,
	type PreviewTokenResponse,
	previewTokenResponseSchema,
	type RestoreVersionBody,
	type RestoreVersionResponse,
	restoreVersionResponseSchema,
	type VersionDiffResponse,
	versionDiffResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/lib/api-client";
import { type ComposerMode, MOCK_LATENCY_MS } from "../lib/constants";
import {
	MOCK_APP_STORES,
	MOCK_BACKEND,
	MOCK_DOMAINS,
	MOCK_PAYMENTS,
	MOCK_PAYMENTS_NOT_CONNECTED,
	MOCK_SETTINGS,
	MOCK_SIGN_IN,
} from "../lib/mock-panels";
import { MOCK_APP_PROJECTS } from "../lib/mock-projects";
import { MOCK_BUILDER_THREAD } from "../lib/mock-thread";
import type {
	AppProject,
	AppProjectKind,
	AppStoresSummary,
	BackendSummary,
	BuilderThread,
	CodeFile,
	CodeSnapshot,
	CollaboratorRole,
	PaymentsSummary,
	ProjectDomain,
	ProjectSettings,
	SignInMethodId,
	SignInSummary,
} from "./dto";

/** Fields the Settings panel can change. */
export type AppProjectPatch = {
	name?: string;
	description?: string;
	kind?: AppProjectKind;
};

/** One turn the composer or a chat card sends. */
export type SendBuilderMessageInput = {
	/** The trimmed draft, or the text of a card action. Never empty. */
	text: string;
	/** The composer choice. The page sends every mode as a build turn until the turn body has a mode field. */
	mode: ComposerMode;
};

type MockStore = {
	projects: Map<string, AppProject>;
	threads: Map<string, BuilderThread>;
	signIn: Map<string, SignInSummary>;
	payments: Map<string, PaymentsSummary>;
	settings: Map<string, ProjectSettings>;
};

let store: MockStore | null = null;

function createStore(): MockStore {
	const next: MockStore = {
		projects: new Map(),
		threads: new Map(),
		signIn: new Map(),
		payments: new Map(),
		settings: new Map(),
	};
	for (const project of MOCK_APP_PROJECTS) {
		seedProject(next, project.id, project.kind);
	}
	return next;
}

/**
 * Fills every map of `store` with the fixtures of one project. A mock id
 * copies its own project row; any other id is a real project that borrows
 * the first fixture row, so the panels that still read mocks work for it.
 */
function seedProject(
	store: MockStore,
	projectId: string,
	kind: AppProjectKind,
): void {
	const template =
		MOCK_APP_PROJECTS.find((project) => project.id === projectId) ??
		MOCK_APP_PROJECTS[0];
	// A real row that fetchAppProject stored stays. The placeholder is only
	// for an id the store has never seen.
	if (!store.projects.has(projectId)) {
		store.projects.set(
			projectId,
			structuredClone({ ...template, id: projectId, kind }),
		);
	}
	store.threads.set(projectId, {
		...structuredClone(MOCK_BUILDER_THREAD),
		projectId,
	});
	store.signIn.set(projectId, structuredClone(MOCK_SIGN_IN));
	// The mobile kind shows the not-connected state of the Payments panel.
	store.payments.set(
		projectId,
		structuredClone(
			kind === "web" ? MOCK_PAYMENTS : MOCK_PAYMENTS_NOT_CONNECTED,
		),
	);
	store.settings.set(projectId, structuredClone(MOCK_SETTINGS));
}

function getStore(): MockStore {
	if (!store) store = createStore();
	return store;
}

/** Drops every change made through the mutations. Specs call it before each case. */
export function resetMockStore(): void {
	store = null;
}

function delay(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

/**
 * Reads a value of the store. A project id the store does not hold yet — a
 * real id — gets the mock fixtures seeded first, so the panels that still
 * read mocks answer for it.
 */
function required<T>(map: Map<string, T>, projectId: string): T {
	const current = getStore();
	if (!map.has(projectId)) {
		// A real project id gets the mock fixtures until each panel lands on
		// its route. The kind comes from the real row when fetchAppProject
		// stored it; before that, `web` stands in.
		seedProject(
			current,
			projectId,
			current.projects.get(projectId)?.kind ?? "web",
		);
	}
	const value = map.get(projectId);
	if (value === undefined) {
		throw new Error(`Unknown app project: ${projectId}`);
	}
	return value;
}

/** The seed rows only. A placeholder row seeded for a real id must not reach the project menu. */
export async function listAppProjects(): Promise<AppProject[]> {
	await delay();
	const projects = getStore().projects;
	return structuredClone(
		MOCK_APP_PROJECTS.flatMap((seed) => {
			const row = projects.get(seed.id);
			return row ? [row] : [];
		}),
	);
}

/**
 * null when no project has this id, so the route can show its not-found
 * screen. `get` is the test seam of the real API call; production gets
 * the shared client.
 */
export async function getAppProject(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<AppProject | null> {
	// Only the seed ids answer the mock. A real id goes to the API even after
	// a panel guard seeded a placeholder row for it into the store.
	if (!MOCK_APP_PROJECTS.some((project) => project.id === projectId)) {
		return fetchAppProject(projectId, get);
	}
	await delay();
	const project = getStore().projects.get(projectId);
	return project ? structuredClone(project) : null;
}

export async function updateAppProject(
	projectId: string,
	patch: AppProjectPatch,
): Promise<AppProject> {
	await delay();
	const project = required(getStore().projects, projectId);
	Object.assign(project, patch);
	return structuredClone(project);
}

export async function getBuilderThread(
	projectId: string,
): Promise<BuilderThread> {
	await delay();
	return structuredClone(required(getStore().threads, projectId));
}

export async function getBackendSummary(
	projectId: string,
): Promise<BackendSummary> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_BACKEND);
}

export async function getSignInSummary(
	projectId: string,
): Promise<SignInSummary> {
	await delay();
	return structuredClone(required(getStore().signIn, projectId));
}

export async function setSignInMethod(
	projectId: string,
	input: { methodId: SignInMethodId; enabled: boolean },
): Promise<SignInSummary> {
	await delay();
	const summary = required(getStore().signIn, projectId);
	for (const method of summary.methods) {
		if (method.id === input.methodId) method.enabled = input.enabled;
	}
	return structuredClone(summary);
}

export async function getPaymentsSummary(
	projectId: string,
): Promise<PaymentsSummary> {
	await delay();
	return structuredClone(required(getStore().payments, projectId));
}

/** Switches the connected provider between test and live keys. No-op without a provider. */
export async function setPaymentsMode(
	projectId: string,
	mode: "test" | "live",
): Promise<PaymentsSummary> {
	await delay();
	const summary = required(getStore().payments, projectId);
	if (summary.provider) summary.provider.mode = mode;
	return structuredClone(summary);
}

export async function getProjectDomains(
	projectId: string,
): Promise<ProjectDomain[]> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_DOMAINS);
}

export async function getAppStoresSummary(
	projectId: string,
): Promise<AppStoresSummary> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_APP_STORES);
}

export async function getProjectSettings(
	projectId: string,
): Promise<ProjectSettings> {
	await delay();
	return structuredClone(required(getStore().settings, projectId));
}

export async function setCollaboratorRole(
	projectId: string,
	input: { collaboratorId: string; role: CollaboratorRole },
): Promise<ProjectSettings> {
	await delay();
	const settings = required(getStore().settings, projectId);
	const collaborator = settings.collaborators.find(
		(candidate) => candidate.id === input.collaboratorId,
	);
	if (!collaborator) {
		throw new Error(`Unknown collaborator: ${input.collaboratorId}`);
	}
	collaborator.role = input.role;
	return structuredClone(settings);
}

// ---- Real API ----

/**
 * `POST /api/v2/projects`. Creates the project, its first chat, and starts
 * the first builder turn. `post` comes from the caller so a spec can inject
 * a fake client. Errors propagate: the hook maps a 402 to the credits dialog.
 */
export async function createAppProject(
	body: CreateAppProjectRequest,
	post: typeof apiClient.post = apiClient.post,
): Promise<CreateAppProjectResponse> {
	const data = await post<unknown>(appBuilderRoutes.createProject, body);
	return createAppProjectResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id`. A 404 answers null like a missing mock id;
 * every other failure propagates so the query enters its error state.
 * `get` comes from the caller so a spec can inject a fake client. The
 * store keeps the real row, so a later mock guard (updateAppProject, the
 * panels) patches the real project and not a fixture.
 */
async function fetchAppProject(
	projectId: string,
	get: typeof apiClient.get,
): Promise<AppProject | null> {
	try {
		const data = await get<unknown>(appBuilderRoutes.project(projectId));
		const project = toUiAppProject(appProjectSchema.parse(data));
		getStore().projects.set(project.id, structuredClone(project));
		return project;
	} catch (error) {
		if (isApiClientError(error) && error.statusCode === 404) return null;
		throw error;
	}
}

/**
 * Maps the V2 project answer to the UI project. The app kind comes from
 * `targetPlatform`; a null platform counts as web.
 */
export function toUiAppProject(project: ApiAppProject): AppProject {
	return {
		id: project.id,
		name: project.name,
		description: project.prompt,
		kind: project.targetPlatform === "mobile" ? "mobile" : "web",
		// LIMIT: the V2 API has no publish state yet, so the slug, the version
		// number, and the unpublished count keep their empty values.
		// Upgrade: the publish state of WANDIT-178.
		slug: project.publishedSlug ?? "",
		versionNumber: 0,
		unpublishedChanges: 0,
	};
}

/**
 * Cancels a running builder turn. `POST /api/v2/projects/:id/turns/:turnId/cancel`
 * sends no body; apiClient adds the cookies and the workspace header.
 */
export async function cancelTurn(
	projectId: string,
	turnId: string,
): Promise<CancelTurnResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.cancelTurn(projectId, turnId),
	);
	return cancelTurnResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id/preview-token` mints a signed 15-minute
 * preview URL of the running sandbox. A 409 with code
 * `SANDBOX_NOT_RUNNING` answers while no sandbox runs; the caller polls
 * through it. The route is rate limited at 30 requests per user per
 * minute.
 */
export async function getPreviewToken(
	projectId: string,
): Promise<PreviewTokenResponse> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.previewToken(projectId),
	);
	return previewTokenResponseSchema.parse(data);
}

/** Maps one file answer of the API to what the Code view shows: text, or binary with no content. */
function toCodeFile(file: CodeFileResponse): CodeFile {
	return file.binary
		? { kind: "binary", path: file.path, size: file.size }
		: { kind: "text", path: file.path, content: file.content, size: file.size };
}

/**
 * `GET /api/v2/projects/:id/cloud/backend` answers the state of the
 * Supabase backend. The preview boot screen polls it to show the database
 * step. `get` is the test seam.
 */
export async function getCloudBackend(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<CloudBackendResponse> {
	const data = await get<unknown>(cloudRoutes.backend(projectId));
	return cloudBackendResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id/code` answers the file tree of the running
 * sandbox and the small files the server read with it. A 409
 * `SANDBOX_NOT_RUNNING` answers null: the server never wakes a sandbox for
 * a read, only the next turn does. `signal` stops a request that a newer
 * fetch replaced. `get` is the test seam.
 */
export async function getCodeSnapshot(
	projectId: string,
	signal?: AbortSignal,
	get: typeof apiClient.get = apiClient.get,
): Promise<{ snapshot: CodeSnapshot; files: CodeFile[] } | null> {
	try {
		const data = await get<unknown>(appBuilderRoutes.codeSnapshot(projectId), {
			signal,
		});
		const { files, ...snapshot } = codeSnapshotResponseSchema.parse(data);
		return { snapshot, files: files.map(toCodeFile) };
	} catch (error) {
		if (isApiClientError(error) && error.code === "SANDBOX_NOT_RUNNING") {
			return null;
		}
		throw error;
	}
}

/**
 * `GET /api/v2/projects/:id/code/file?path=` answers one file. The three
 * file errors map to a `CodeFile` kind the viewer shows; every other
 * failure, a 409 included, propagates. `signal` stops the request when the
 * user leaves the file. `get` is the test seam.
 */
export async function getCodeFile(
	projectId: string,
	path: string,
	signal?: AbortSignal,
	get: typeof apiClient.get = apiClient.get,
): Promise<CodeFile> {
	try {
		const data = await get<unknown>(appBuilderRoutes.codeFile(projectId), {
			query: { path },
			signal,
		});
		return toCodeFile(codeFileResponseSchema.parse(data));
	} catch (error) {
		// A hand-typed URL can name a path the API refuses, like `.env`. For
		// the user it is a file the Code view cannot show.
		if (
			isApiClientError(error) &&
			(error.code === "CODE_FILE_NOT_FOUND" ||
				error.code === "CODE_PATH_INVALID")
		) {
			return { kind: "missing", path };
		}
		if (isApiClientError(error) && error.code === "CODE_FILE_TOO_LARGE") {
			return { kind: "tooLarge", path };
		}
		throw error;
	}
}

/**
 * `GET /api/v2/projects/:id/versions` answers the version list, newest
 * first. The items are git commits of the project's repository.
 */
// LIMIT: only the first page of 50 loads; there is no cursor paging yet. Upgrade: follow `nextCursor`.
export async function listVersions(
	projectId: string,
): Promise<ListVersionsResponse> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.versions(projectId),
	);
	return listVersionsResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id/versions/:sha/diff` answers the stored `git
 * show` patch and the numstat of one commit.
 */
export async function getVersionDiff(
	projectId: string,
	sha: string,
): Promise<VersionDiffResponse> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.versionDiff(projectId, sha),
	);
	return versionDiffResponseSchema.parse(data);
}

/**
 * `POST /api/v2/projects/:id/versions/:sha/restore` copies the version
 * forward as a new commit. `body.expectedHeadSha` is the compare-and-swap
 * input: a stale head answers 409 VERSION_CONFLICT, and a running turn
 * answers 409 BUILDER_TURN_ACTIVE.
 */
export async function restoreVersion(
	projectId: string,
	sha: string,
	body: RestoreVersionBody,
): Promise<RestoreVersionResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.restoreVersion(projectId, sha),
		body,
	);
	return restoreVersionResponseSchema.parse(data);
}
