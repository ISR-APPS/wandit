// Feature hooks that aren't queries/mutations.

import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { promptStash, useRequireAuth } from "@/features/auth";
import { CREDIT_COSTS, useCredits } from "@/features/credits";
import { useCreateProject } from "../api/projects.mutations";
import { PROJECTS_COPY } from "./constants";
import { deriveProjectName } from "./helpers";

export type UseCreateProjectWithPromptResult = {
	create: (prompt: string) => void;
	isCreating: boolean;
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
	cost: number;
};

/**
 * The prompt → project flow, shared by the landing hero and the dashboard
 * (cross-agent contract — signature is frozen). Stashes the prompt, runs the
 * auth continuation, charges credits, creates the project and navigates to
 * the workspace. Call sites render <InsufficientCreditsDialog /> next to
 * their PromptBox with { insufficientOpen, setInsufficientOpen, cost }.
 */
export function useCreateProjectWithPrompt(): UseCreateProjectWithPromptResult {
	const requireAuth = useRequireAuth();
	const { consume } = useCredits();
	const createProject = useCreateProject();
	const navigate = useNavigate();
	const [insufficientOpen, setInsufficientOpen] = useState(false);

	const cost = CREDIT_COSTS.generation;

	const create = useCallback(
		(prompt: string) => {
			promptStash.stash(prompt);
			requireAuth(async () => {
				promptStash.consume();
				const name = deriveProjectName(prompt);
				// consume() re-checks the live balance atomically — covers both
				// the canAfford gate and the charge in one step.
				if (!consume(cost, name)) {
					setInsufficientOpen(true);
					return;
				}
				const project = await createProject.mutateAsync(prompt);
				toast.success(PROJECTS_COPY.createSuccess(project.name));
				await navigate({
					to: "/p/$projectId",
					params: { projectId: project.id },
				});
			});
		},
		[requireAuth, consume, createProject, navigate],
	);

	return {
		create,
		isCreating: createProject.isPending,
		insufficientOpen,
		setInsufficientOpen,
		cost,
	};
}
