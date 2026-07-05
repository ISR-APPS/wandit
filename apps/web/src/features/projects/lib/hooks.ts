// Feature hooks that aren't queries/mutations.

import { useNavigate } from "@tanstack/react-router";
import type { ComposerMetadata } from "@wandit/contracts";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { promptStash, useAuthModal, useSession } from "@/features/auth";
import { CREDIT_COSTS, useCredits } from "@/features/credits";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateProject } from "../api/projects.mutations";
import { deriveProjectName } from "./helpers";

export type UseCreateProjectWithPromptResult = {
	create: (prompt: string, composer?: ComposerMetadata) => void;
	isCreating: boolean;
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
	cost: number;
};

/**
 * The prompt → project flow, shared by the landing hero and the dashboard
 * (cross-agent contract — signature is frozen). Signed-out prompts are stashed
 * for the post-Google dashboard; signed-in prompts charge credits, create the
 * project and navigate to the workspace. Call sites render
 * <InsufficientCreditsDialog /> next to their PromptBox with
 * { insufficientOpen, setInsufficientOpen, cost }.
 */
export function useCreateProjectWithPrompt(): UseCreateProjectWithPromptResult {
	const { t } = useTranslation();
	const { data: session, isPending: isSessionPending } = useSession();
	const { open } = useAuthModal();
	const { consume } = useCredits();
	const createProject = useCreateProject();
	const navigate = useNavigate();
	const [insufficientOpen, setInsufficientOpen] = useState(false);

	const cost = CREDIT_COSTS.generation;

	const createSignedInProject = useCallback(
		async (prompt: string, composer?: ComposerMetadata) => {
			const name = deriveProjectName(prompt);
			// consume() re-checks the live balance atomically — covers both
			// the canAfford gate and the charge in one step.
			if (!consume(cost, name)) {
				setInsufficientOpen(true);
				return;
			}
			try {
				const { projectId } = await createProject.mutateAsync({
					prompt,
					composer,
				});
				toast.success(t("projects.createSuccess", { name }));
				await navigate({
					to: "/p/$projectId",
					params: { projectId },
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		},
		[consume, createProject, navigate, t],
	);

	const create = useCallback(
		(prompt: string, composer?: ComposerMetadata) => {
			if (!session) {
				promptStash.stash(prompt);
				open();
				return;
			}

			void createSignedInProject(prompt, composer);
		},
		[createSignedInProject, open, session],
	);

	return {
		create,
		isCreating: createProject.isPending || isSessionPending,
		insufficientOpen,
		setInsufficientOpen,
		cost,
	};
}
