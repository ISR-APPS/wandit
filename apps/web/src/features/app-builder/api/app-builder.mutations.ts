/**
 * Mutations of the app builder. Most call a service and write the result
 * into the query cache, so the panel that reads the query updates at once.
 * Called by the dashboard create flow, the Settings panel, the Sign-in
 * panel, the Payments panel, the versions popover, and the Expo Go popover.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateAppProjectRequest } from "@wandit/contracts";
import { toast } from "sonner";

import { projectKeys } from "@/features/projects";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import {
	type AppProjectPatch,
	createAppProject,
	getPhonePreviewLink,
	restoreVersion,
	setCollaboratorRole,
	setPaymentsMode,
	setSignInMethod,
	updateAppProject,
} from "./app-builder.services";
import type { CollaboratorRole, SignInMethodId } from "./dto";

/**
 * Creates a V2 app project from the dashboard prompt. The V1 project grid
 * lists V2 projects too, so its list query refreshes and the new card shows.
 */
export function useCreateAppProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateAppProjectRequest) => createAppProject(body),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
}

/**
 * Mints a phone link for Expo Go. No cache write: each popover open mints a
 * new link, and the popover reads the answer from the mutation.
 */
export function useMintPhonePreviewLink(projectId: string) {
	return useMutation({
		mutationFn: (expoUsername: string) =>
			getPhonePreviewLink(projectId, expoUsername),
	});
}

/** Name, description, or kind. The project menu list refreshes too, so its badge stays right. */
export function useUpdateAppProject(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.project(projectId), "update"],
		mutationFn: (patch: AppProjectPatch) => updateAppProject(projectId, patch),
		onSuccess: (project) => {
			queryClient.setQueryData(appBuilderKeys.project(projectId), project);
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.projects(),
			});
		},
	});
}

/** Turns one sign-in method on or off. Writes the returned summary into the sign-in query. */
export function useSetSignInMethod(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.signIn(projectId), "set"],
		mutationFn: (input: { methodId: SignInMethodId; enabled: boolean }) =>
			setSignInMethod(projectId, input),
		onSuccess: (summary) => {
			queryClient.setQueryData(appBuilderKeys.signIn(projectId), summary);
		},
	});
}

/** Switches the provider keys between test and live. Writes the returned summary into the payments query. */
export function useSetPaymentsMode(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.payments(projectId), "mode"],
		mutationFn: (mode: "test" | "live") => setPaymentsMode(projectId, mode),
		onSuccess: (summary) => {
			queryClient.setQueryData(appBuilderKeys.payments(projectId), summary);
		},
	});
}

/** Changes the role of one collaborator. Writes the returned settings into the settings query. */
export function useSetCollaboratorRole(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.settings(projectId), "role"],
		mutationFn: (input: { collaboratorId: string; role: CollaboratorRole }) =>
			setCollaboratorRole(projectId, input),
		onSuccess: (settings) => {
			queryClient.setQueryData(appBuilderKeys.settings(projectId), settings);
		},
	});
}

/** Inputs of `useRestoreVersion` beyond the project id. `deps` is the spec seam; production omits `restoreVersion`. */
export type RestoreVersionDeps = {
	/** The restore POST. The spec injects a fake through it. */
	restoreVersion?: typeof restoreVersion;
	/** Runs after a restore succeeds, also when the popover already closed. The page reloads the preview with it. */
	onRestored?: () => void;
};

/**
 * Restores one version as a new copy-forward commit. `expectedHeadSha` is
 * the head the user saw; the API compares and swaps on it. Success
 * invalidates the versions list and the project row.
 */
export function useRestoreVersion(
	projectId: string,
	deps: RestoreVersionDeps = {},
) {
	const queryClient = useQueryClient();
	const doRestore = deps.restoreVersion ?? restoreVersion;
	return useMutation({
		mutationKey: [...appBuilderKeys.versions(projectId), "restore"],
		mutationFn: ({
			sha,
			expectedHeadSha,
		}: {
			sha: string;
			expectedHeadSha: string;
		}) => doRestore(projectId, sha, { expectedHeadSha }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.versions(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.project(projectId),
			});
			// A restore rewrites the worktree, so the Code view tree and the
			// open file refetch too.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.code(projectId),
			});
			deps.onRestored?.();
		},
		onError: (error) => {
			if (isApiClientError(error) && error.code === "VERSION_CONFLICT") {
				// The head moved, so the list the user saw is stale.
				void queryClient.invalidateQueries({
					queryKey: appBuilderKeys.versions(projectId),
				});
			}
			toast.error(getApiErrorMessage(error));
		},
	});
}
