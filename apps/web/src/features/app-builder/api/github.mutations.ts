/**
 * Mutations of the GitHub sync: start a GitHub connect or App install, create
 * and link a repo, unlink it, and pull the GitHub commits (Update). Each one
 * calls github.services.ts, refreshes the caches that its answer changes, and
 * shows a refusal as a toast. Called by components/more/integrations-panel.tsx
 * and pages/app-builder-page.tsx.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	CreateGithubRepositoryBody,
	GithubPullBody,
	ProjectGithubStatusResponse,
} from "@wandit/contracts";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { githubKeys } from "./github.queries";
import {
	createGithubRepository,
	pullFromGithub,
	startGithubAuthorize,
	unlinkGithubRepository,
} from "./github.services";

/**
 * Asks the API for the GitHub page of a connect or an App install, then
 * opens it in this tab. GitHub sends the user back to `returnUrl` with the
 * `github` or `github_error` param.
 */
export function useStartGithubAuthorize() {
	return useMutation({
		mutationKey: [...githubKeys.account(), "authorize"],
		mutationFn: startGithubAuthorize,
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/** Creates the GitHub repo and links it. The answer is the new status, so the panel shows the link at once. */
export function useCreateGithubRepository(projectId: string) {
	const queryClient = useQueryClient();
	const key = githubKeys.status(projectId);
	return useMutation({
		mutationKey: [...key, "link"],
		mutationFn: (body: CreateGithubRepositoryBody) =>
			createGithubRepository(projectId, body),
		onSuccess: (status) => {
			queryClient.setQueryData(key, status);
		},
		onError: (error) => {
			// A code without an errors.json text shows the server message.
			toast.error(getApiErrorMessage(error));
			// A 409 GITHUB_ALREADY_LINKED means another tab linked a repo. The refetch shows it.
			void queryClient.invalidateQueries({ queryKey: key });
			// A 409 GITHUB_NOT_CONNECTED or a 403 GITHUB_INSTALLATION_NOT_YOURS means the cached account is old.
			// The refetch shows the Connect row or the new installations.
			void queryClient.invalidateQueries({ queryKey: githubKeys.account() });
		},
	});
}

/** Removes the link of the project. The repo stays on GitHub, and the banner hides at once. */
export function useUnlinkGithubRepository(projectId: string) {
	const queryClient = useQueryClient();
	const key = githubKeys.status(projectId);
	return useMutation({
		mutationKey: [...key, "unlink"],
		mutationFn: () => unlinkGithubRepository(projectId),
		onSuccess: () => {
			queryClient.setQueryData<ProjectGithubStatusResponse>(key, (status) =>
				status === undefined ? undefined : { ...status, link: null },
			);
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
			void queryClient.invalidateQueries({ queryKey: key });
		},
	});
}

/**
 * Merges the GitHub commits into the project: the Update button of the chat
 * banner. `mutate` takes the `headSha` of the last status answer; the API
 * compares and swaps on it. `onUpdated` runs after a success; the page
 * reloads the preview with it.
 */
export function usePullFromGithub(projectId: string, onUpdated: () => void) {
	const queryClient = useQueryClient();
	const statusKey = githubKeys.status(projectId);
	return useMutation({
		mutationKey: [...statusKey, "pull"],
		mutationFn: (expectedHeadSha: GithubPullBody["expectedHeadSha"]) =>
			pullFromGithub(projectId, { expectedHeadSha }),
		onSuccess: async () => {
			// The pull is a new "github" commit in the sandbox worktree, like a
			// restore. The version list, the project counts, the Code view tree,
			// the open file, and the theme can all change.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.versions(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.project(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.code(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.theme(projectId),
			});
			onUpdated();
			// The mutation stays pending until the new status arrives. So the banner cannot send the old head again.
			await queryClient.invalidateQueries({ queryKey: statusKey });
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
			// A 409 VERSION_CONFLICT or GITHUB_UPDATE_CHANGED means a head moved. The refetch gives the new heads.
			void queryClient.invalidateQueries({ queryKey: statusKey });
		},
	});
}
