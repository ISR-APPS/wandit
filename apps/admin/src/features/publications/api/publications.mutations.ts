/**
 * TanStack Query mutations for the suspend switch of a V2 app.
 * The suspend dialog calls them. Each success refreshes the publish log,
 * because every row of the project shows the new state.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminSuspendPublicationInput } from "./publications.dto";
import { publicationKeys } from "./publications.queries";
import {
	suspendPublication,
	unsuspendPublication,
} from "./publications.services";

/** Variables of the suspend call: the project id and the reason form. */
type SuspendPublicationVariables = AdminSuspendPublicationInput & {
	projectId: string;
};

/** Suspends the V2 app of a project. A second call overwrites the reason and the note. */
export function useSuspendPublicationMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ projectId, ...input }: SuspendPublicationVariables) =>
			suspendPublication(projectId, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: publicationKeys.all });
		},
	});
}

/** Serves a suspended V2 app again. The log shows the row status again after the refresh. */
export function useUnsuspendPublicationMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (projectId: string) => unsuspendPublication(projectId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: publicationKeys.all });
		},
	});
}
