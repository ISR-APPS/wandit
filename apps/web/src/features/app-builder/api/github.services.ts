/**
 * Data layer of the GitHub sync of a V2 project: the GitHub account of the
 * user, the link of one project, and the Update pull. Each function calls one
 * route of `appBuilderRoutes` through `@/lib/api-client` and parses the answer
 * with its schema from `packages/contracts/src/v2/github.ts`.
 * Called by github.queries.ts and github.mutations.ts.
 */

import {
	appBuilderRoutes,
	type CreateGithubRepositoryBody,
	type GithubAccountResponse,
	type GithubAuthorizeBody,
	type GithubAuthorizeResponse,
	type GithubPullBody,
	type GithubPullResponse,
	githubAccountResponseSchema,
	githubAuthorizeResponseSchema,
	githubPullResponseSchema,
	type ProjectGithubStatusResponse,
	projectGithubStatusResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * 5 min, above the API worst case: a sandbox boot, git fetches and pushes, and
 * pnpm install (120 s cap on the API). The shared 60 s cut ends the request
 * while the API still works, and the preview then does not reload.
 */
const GITHUB_PULL_TIMEOUT_MS = 5 * 60_000;

/**
 * `GET /api/v2/github/account`: the GitHub login of the user and the App
 * installations they can reach. A refused token refresh answers `connected: false`.
 */
export async function getGithubAccount(): Promise<GithubAccountResponse> {
	const data = await apiClient.get<unknown>(appBuilderRoutes.githubAccount);
	return githubAccountResponseSchema.parse(data);
}

/**
 * `POST /api/v2/github/authorize`: the GitHub page that starts a connect
 * ("authorize") or an App install ("install"). The API refuses a return URL
 * on another origin.
 */
export async function startGithubAuthorize(
	body: GithubAuthorizeBody,
): Promise<GithubAuthorizeResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.githubAuthorize,
		body,
	);
	return githubAuthorizeResponseSchema.parse(data);
}

/**
 * `GET /api/v2/projects/:id/github`: the link and sync state of the project,
 * and the head that a pull sends back. The API also asks GitHub for its head.
 */
export async function getProjectGithubStatus(
	projectId: string,
): Promise<ProjectGithubStatusResponse> {
	const data = await apiClient.get<unknown>(appBuilderRoutes.github(projectId));
	return projectGithubStatusResponseSchema.parse(data);
}

/**
 * `POST /api/v2/projects/:id/github`: creates a GitHub repo with the user
 * token, links it, and answers the new status. A project with a link
 * answers 409 GITHUB_ALREADY_LINKED.
 */
export async function createGithubRepository(
	projectId: string,
	body: CreateGithubRepositoryBody,
): Promise<ProjectGithubStatusResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.github(projectId),
		body,
	);
	return projectGithubStatusResponseSchema.parse(data);
}

/** `DELETE /api/v2/projects/:id/github`: removes the link. The repo stays on GitHub. */
export async function unlinkGithubRepository(projectId: string): Promise<void> {
	await apiClient.delete(appBuilderRoutes.github(projectId));
}

/**
 * `POST /api/v2/projects/:id/github/pull`: merges the GitHub commits into the
 * project. A stale `expectedHeadSha` answers 409 VERSION_CONFLICT, a running
 * or waiting turn 409 BUILDER_TURN_ACTIVE or BUILDER_TURN_WAITING.
 */
export async function pullFromGithub(
	projectId: string,
	body: GithubPullBody,
): Promise<GithubPullResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.githubPull(projectId),
		body,
		{ timeout: GITHUB_PULL_TIMEOUT_MS },
	);
	return githubPullResponseSchema.parse(data);
}
