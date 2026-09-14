/**
 * Mutations of the app builder. Each one calls a service and writes the
 * result into the query cache, so the panel that reads the query updates at
 * once. Called by the composer, the Settings panel, the Sign-in panel, and
 * the Payments panel.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import {
	type AppProjectPatch,
	type SendBuilderMessageInput,
	sendBuilderMessage,
	setCollaboratorRole,
	setPaymentsMode,
	setSignInMethod,
	updateAppProject,
} from "./app-builder.services";
import type { CollaboratorRole, SignInMethodId } from "./dto";

/** Sends one turn. The thread, the project version, and the version list change on success. */
export function useSendBuilderMessage(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.thread(projectId), "send"],
		mutationFn: (input: SendBuilderMessageInput) =>
			sendBuilderMessage(projectId, input),
		onSuccess: (thread) => {
			queryClient.setQueryData(appBuilderKeys.thread(projectId), thread);
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.project(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.versions(projectId),
			});
		},
		// The composer clears the draft when it sends, so a failed turn must at least say so.
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
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
