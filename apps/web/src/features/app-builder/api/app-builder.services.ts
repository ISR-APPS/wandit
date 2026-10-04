/**
 * Data layer of the app builder. Each function calls a V2 route through
 * `@/lib/api-client` and parses the answer with contracts.
 * Called by app-builder.queries.ts, app-builder.mutations.ts,
 * lib/use-builder-chat.ts, lib/use-preview-token.ts, the chat pane, the
 * composer, and the device panel.
 */

import {
	type AppProject as ApiAppProject,
	appBuilderRoutes,
	appProjectSchema,
	type CancelTurnResponse,
	type CodeFileResponse,
	type CreateAppProjectRequest,
	type CreateAppProjectResponse,
	cancelTurnResponseSchema,
	codeFileResponseSchema,
	codeSnapshotResponseSchema,
	createAppProjectResponseSchema,
	type DevicePlatform,
	endDeviceSessionResponseSchema,
	type ListVersionsResponse,
	listVersionsResponseSchema,
	PHONE_LINK_PATH,
	type PhonePreviewLinkResponse,
	type PreviewTokenResponse,
	type ProjectCostCaps,
	phonePreviewLinkResponseSchema,
	previewTokenResponseSchema,
	projectCostCapsSchema,
	type RestoreVersionBody,
	type RestoreVersionResponse,
	restoreVersionResponseSchema,
	type SandboxWakeResponse,
	type StartDeviceSessionResponse,
	sandboxWakeResponseSchema,
	startDeviceSessionResponseSchema,
	type TurnEstimateResponse,
	turnEstimateResponseSchema,
	type UpdateProjectCostCapsRequest,
	type VersionDiffResponse,
	versionDiffResponseSchema,
} from "@wandit/contracts";

import type { FileUIPart } from "ai";

import { apiClient, isApiClientError } from "@/lib/api-client";
import type { AppProject, CodeFile, CodeSnapshot } from "./dto";

/** One turn the composer or a chat card sends. */
export type SendBuilderMessageInput = {
	/** The trimmed draft, or the text of a card action. Empty only when `files` holds a file. */
	text: string;
	/** Files the user uploaded for this message, with their upload URLs. Empty for a card action. */
	files: FileUIPart[];
};

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
 * `GET /api/v2/projects/:id`. null when no project has this id or the V2
 * gate refuses the user, so the route shows its not-found screen. Every
 * other failure propagates and the query enters its error state. `get` is
 * the test seam; production gets the shared client.
 */
export async function getAppProject(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<AppProject | null> {
	try {
		const data = await get<unknown>(appBuilderRoutes.project(projectId));
		return toUiAppProject(appProjectSchema.parse(data));
	} catch (error) {
		if (!isApiClientError(error)) throw error;
		if (error.statusCode === 404) return null;
		// A mounted module answers 403 V2_BUILDER_DISABLED to a user outside
		// the rollout. That user sees the same screen as with no module: 404.
		if (error.code === "V2_BUILDER_DISABLED") return null;
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
		kind: project.targetPlatform === "mobile" ? "mobile" : "web",
		languages: project.languages,
		templateVersion: project.templateVersion,
		engine: project.engine,
		versionNumber: project.versionNumber,
		unpublishedChanges: project.unpublishedChanges,
		hasCodeChanges: project.hasCodeChanges,
	};
}

/**
 * `GET /api/v2/projects/:id/cost-caps`. Both caps are in centi-credits; a
 * null monthly cap means no monthly limit. Only workspace owners and admins
 * may call it: a member gets 403 WORKSPACE_PERMISSION_DENIED.
 */
export async function getCostCaps(projectId: string): Promise<ProjectCostCaps> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.costCaps(projectId),
	);
	return projectCostCapsSchema.parse(data);
}

/**
 * `PUT /api/v2/projects/:id/cost-caps` replaces both caps and answers the
 * stored values. The same role rule as the read applies.
 */
export async function updateCostCaps(
	projectId: string,
	body: UpdateProjectCostCapsRequest,
): Promise<ProjectCostCaps> {
	const data = await apiClient.put<unknown>(
		appBuilderRoutes.costCaps(projectId),
		body,
	);
	return projectCostCapsSchema.parse(data);
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

/**
 * `POST /api/v2/projects/:id/sandbox/wake` boots a sleeping sandbox
 * without a turn and charges no credits. Every success is a 202; the
 * caller then polls the preview token. A 429 RATE_LIMITED answers after
 * 6 wakes per user in 10 minutes and propagates like every other error.
 */
export async function wakeSandbox(
	projectId: string,
): Promise<SandboxWakeResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.wakeSandbox(projectId),
	);
	return sandboxWakeResponseSchema.parse(data);
}

/**
 * Mints a 60-minute phone link for Expo Go (WANDIT-193). The API signs a
 * phone preview token; the preview Worker turns it into an `exps://` URL.
 * `expoUsername` is the Expo Go account for the iPhone check, or "" for
 * none. A 409 `SANDBOX_NOT_RUNNING` propagates. `get` and `post` are the
 * test seams.
 */
export async function getPhonePreviewLink(
	projectId: string,
	expoUsername: string,
	get: typeof apiClient.get = apiClient.get,
	post: typeof fetch = fetch,
): Promise<PhonePreviewLinkResponse> {
	const data = await get<unknown>(appBuilderRoutes.previewToken(projectId), {
		query: {
			client: "phone",
			expoUsername: expoUsername === "" ? undefined : expoUsername,
		},
	});
	const { token, previewUrl } = previewTokenResponseSchema.parse(data);
	// The mint route sits on the run host of the token. A plain-text body
	// needs no CORS preflight, and no cookie rides along.
	const response = await post(new URL(PHONE_LINK_PATH, previewUrl), {
		body: token,
		credentials: "omit",
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(`Phone link mint failed with HTTP ${response.status}`);
	}
	return phonePreviewLinkResponseSchema.parse(await response.json());
}

/**
 * `POST /api/v2/projects/:id/device-sessions` starts an Appetize device
 * session (WANDIT-196) and answers its client config. 402, 409, and 404
 * propagate as API errors. `post` is the test seam.
 */
export async function startDeviceSession(
	projectId: string,
	platform: DevicePlatform,
	post: typeof apiClient.post = apiClient.post,
): Promise<StartDeviceSessionResponse> {
	const data = await post<unknown>(appBuilderRoutes.deviceSessions(projectId), {
		platform,
	});
	return startDeviceSessionResponseSchema.parse(data);
}

/**
 * Ends one device session and sends its Appetize session token, or no
 * token when the session never started. `post` is the test seam.
 */
export async function endDeviceSession(
	projectId: string,
	deviceSessionId: string,
	appetizeSessionToken: string | undefined,
	post: typeof apiClient.post = apiClient.post,
): Promise<void> {
	const data = await post<unknown>(
		appBuilderRoutes.endDeviceSession(projectId, deviceSessionId),
		{ appetizeSessionToken },
	);
	endDeviceSessionResponseSchema.parse(data);
}

/** Maps one file answer of the API to what the Code view shows: text, or binary with no content. */
function toCodeFile(file: CodeFileResponse): CodeFile {
	return file.binary
		? { kind: "binary", path: file.path, size: file.size }
		: { kind: "text", path: file.path, content: file.content, size: file.size };
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
 * `GET /api/v2/projects/:id/turns/estimate`: the hold that the next turn
 * reserves, so the composer shows the real cost before send.
 */
export async function getTurnEstimate(
	projectId: string,
): Promise<TurnEstimateResponse> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.turnEstimate(projectId),
	);
	return turnEstimateResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id/versions` answers one page of 50 versions,
 * newest first. The items are git commits of the project's repository.
 * `cursor` is the `nextCursor` of the previous page; null loads the first.
 */
export async function listVersions(
	projectId: string,
	cursor: string | null,
): Promise<ListVersionsResponse> {
	const data = await apiClient.get<unknown>(
		appBuilderRoutes.versions(projectId),
		// The client drops a null value, so the first page sends no cursor.
		{ query: { cursor } },
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
 * input: a stale head answers 409 VERSION_CONFLICT, a running turn answers
 * 409 BUILDER_TURN_ACTIVE, and a turn that waits for the user answers 409
 * BUILDER_TURN_WAITING.
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
