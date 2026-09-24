/**
 * The prompt → V2 project flow of the dashboard. Creates the app project,
 * refreshes the credits, and opens `/app/$projectId`. Same result shape as
 * the V1 `useCreateProjectWithPrompt`, so the dashboard swaps the two.
 * Calls `useCreateAppProject` and the credits and projects features.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type {
	ComposerMetadata,
	TargetPlatform,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { creditsKeys } from "@/features/credits";
import { isInsufficientCreditsApiError } from "@/features/projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateAppProject } from "../api/app-builder.mutations";
import { toCreateAppProjectBody } from "./create-app-project-body";

/** What the dashboard reads: the same four fields as the V1 hook result. */
export type UseCreateAppProjectWithPromptResult = {
	/** Resolves true when the server kept the project, even if navigation failed. */
	create: (
		prompt: string,
		composer?: ComposerMetadata,
		attachments?: UploadAttachmentResponse[],
	) => Promise<boolean>;
	isCreating: boolean;
	/** True after a 402: the dashboard opens the insufficient credits dialog. */
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
};

/**
 * `targetPlatform` is the app type chip pick of the prompt box. The server
 * checks the balance and refuses `mobile` until WANDIT-192; both come back
 * as errors here, so the dashboard has no precheck of its own.
 */
export function useCreateAppProjectWithPrompt(
	targetPlatform: TargetPlatform,
): UseCreateAppProjectWithPromptResult {
	const { locale } = useTranslation();
	const createAppProject = useCreateAppProject();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [insufficientOpen, setInsufficientOpen] = useState(false);

	const create = useCallback(
		async (
			prompt: string,
			composer?: ComposerMetadata,
			attachments?: UploadAttachmentResponse[],
		) => {
			let created: { projectId: string };
			try {
				created = await createAppProject.mutateAsync(
					toCreateAppProjectBody({
						prompt,
						composer,
						attachments,
						locale,
						targetPlatform,
					}),
				);
			} catch (error) {
				// The cached balance is stale when the server answers 402.
				void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
				if (isInsufficientCreditsApiError(error)) {
					setInsufficientOpen(true);
					return false;
				}
				toast.error(getApiErrorMessage(error));
				return false;
			}

			// The first turn reserves credits; the balance shown must follow.
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
			try {
				await navigate({
					to: "/app/$projectId",
					params: { projectId: created.projectId },
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
			// The server kept the project, so a second submit must not make a twin.
			return true;
		},
		[createAppProject, locale, navigate, queryClient, targetPlatform],
	);

	return {
		create,
		isCreating: createAppProject.isPending,
		insufficientOpen,
		setInsufficientOpen,
	};
}
