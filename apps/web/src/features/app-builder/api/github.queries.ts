/**
 * TanStack Query keys and options of the GitHub sync. queryFn delegates to
 * github.services.ts. The builder page reads the project status for the
 * update banner, and the Integrations panel reads it and the account.
 * github.mutations.ts and lib/use-builder-chat.ts refresh them.
 */

import { queryOptions } from "@tanstack/react-query";

import { appBuilderKeys } from "./app-builder.queries";
import { getGithubAccount, getProjectGithubStatus } from "./github.services";

/** Keys of the GitHub sync, under `appBuilderKeys.all`. The account is one per user, the status one per project. */
export const githubKeys = {
	all: [...appBuilderKeys.all, "github"] as const,
	account: () => [...githubKeys.all, "account"] as const,
	status: (projectId: string) =>
		[...githubKeys.all, "status", projectId] as const,
};

/**
 * 15 s between two status reads while the project has a link. The read uses our
 * database; the API asks GitHub at most once a minute, or once in 10 min with the webhook.
 */
const GITHUB_STATUS_POLL_MS = 15_000;

/**
 * The GitHub account of the user. The account route can call GitHub, so the
 * caller passes `enabled` only while the Integrations panel needs it.
 */
export const githubAccountQuery = (enabled: boolean) =>
	queryOptions({
		queryKey: githubKeys.account(),
		queryFn: getGithubAccount,
		enabled,
	});

/** The GitHub link and sync state of one project. */
export const projectGithubStatusQuery = (projectId: string) =>
	queryOptions({
		queryKey: githubKeys.status(projectId),
		queryFn: () => getProjectGithubStatus(projectId),
		// The GitHub webhook queues the sync run, and the worker writes the row.
		// The poll shows that row. A project without a link has nothing to find.
		refetchInterval: (query) =>
			query.state.data?.link ? GITHUB_STATUS_POLL_MS : false,
		refetchOnWindowFocus: true,
	});
