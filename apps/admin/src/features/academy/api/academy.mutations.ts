import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { academyKeys } from "./academy.queries";
import {
	createAcademyGuide,
	deleteAcademyGuide,
	updateAcademyGuide,
} from "./academy.services";

function useAcademyMutation<TVariables, TResult>(
	mutationFn: (variables: TVariables) => Promise<TResult>,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: academyKeys.all });
		},
	});
}

export function useCreateAcademyGuideMutation() {
	return useAcademyMutation(createAcademyGuide);
}

export function useUpdateAcademyGuideMutation() {
	return useAcademyMutation(updateAcademyGuide);
}

export function useDeleteAcademyGuideMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteAcademyGuide,
		onSuccess: (_result, guideId) => {
			refreshAcademyAfterDelete(queryClient, guideId);
		},
	});
}

export function refreshAcademyAfterDelete(
	queryClient: Pick<QueryClient, "invalidateQueries" | "removeQueries">,
	guideId: string,
): void {
	queryClient.removeQueries({
		queryKey: academyKeys.guide(guideId),
		exact: true,
	});
	void queryClient.invalidateQueries({ queryKey: academyKeys.lists });
}
