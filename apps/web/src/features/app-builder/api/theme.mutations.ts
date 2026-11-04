/**
 * The save mutation of the builder Thème sheet. It calls theme.services.ts.
 * Then it refreshes the theme, the version list, the project counts, the Code view, and the GitHub status.
 * Only the lazy Thème sheet (components/preview/theme-sheet.tsx) imports this file.
 * So the contracts look catalog stays out of the builder chunk.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PutAppThemeBody } from "@wandit/contracts/v2/app-theme";

import { isApiClientError } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { githubKeys } from "./github.queries";
import { saveAppTheme } from "./theme.services";

/**
 * Saves the selection of the Thème sheet as a "theme" commit. `expectedHeadSha` is the head of the
 * last theme GET; the API compares and swaps on it. The sheet shows the error messages.
 */
export function useSaveAppTheme(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appBuilderKeys.theme(projectId), "save"],
		mutationFn: (body: PutAppThemeBody) => saveAppTheme(projectId, body),
		onSuccess: async () => {
			// The save is a new version, so an open versions popover shows it.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.versions(projectId),
			});
			// The new commit changes the version number and the unpublished count of the project.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.project(projectId),
			});
			// The commit rewrites src/styles/theme.json, so the Code view tree and the open file refetch.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.code(projectId),
			});
			// The save moves the head. The GitHub Update sends the head of the status, so it refetches.
			void queryClient.invalidateQueries({
				queryKey: githubKeys.status(projectId),
			});
			// The mutation stays pending until the new file arrives. So Save cannot send the old head again.
			await queryClient.invalidateQueries({
				queryKey: appBuilderKeys.theme(projectId),
			});
		},
		onError: async (error) => {
			// The head moved after the GET. The refetch gives the new head, and the next Save uses it.
			// The mutation stays pending until the new head arrives. So Save cannot send the old head again.
			if (isApiClientError(error) && error.code === "THEME_HEAD_MOVED") {
				await queryClient.invalidateQueries({
					queryKey: appBuilderKeys.theme(projectId),
				});
			}
		},
	});
}
