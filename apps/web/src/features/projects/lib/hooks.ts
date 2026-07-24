// Feature hooks that aren't queries/mutations.

import { useNavigate } from "@tanstack/react-router";
import type {
	ComposerMetadata,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { promptStash, useAuthModal, useSession } from "@/features/auth";
import { CREDIT_COSTS, useCredits } from "@/features/credits";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateProject } from "../api/projects.mutations";
import { chatAutostart } from "./chat-autostart";
import { deriveProjectName } from "./helpers";

export type UseCreateProjectWithPromptResult = {
	create: (
		prompt: string,
		composer?: ComposerMetadata,
		attachments?: UploadAttachmentResponse[],
	) => Promise<boolean>;
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
	const { canAfford, consume } = useCredits();
	const createProject = useCreateProject();
	const navigate = useNavigate();
	const [insufficientOpen, setInsufficientOpen] = useState(false);
	const [cost, setCost] = useState<number>(CREDIT_COSTS.generation);

	const createSignedInProject = useCallback(
		async (
			prompt: string,
			composer?: ComposerMetadata,
			attachments?: UploadAttachmentResponse[],
		) => {
			const name = deriveProjectName(prompt);
			const generationCost =
				composer?.mode === "video"
					? CREDIT_COSTS.videoGeneration
					: CREDIT_COSTS.generation;
			setCost(generationCost);
			// Affordability gate BEFORE the request, charge AFTER it succeeds —
			// a failed creation must never leave a consumed-credit ledger entry.
			if (!canAfford(generationCost)) {
				setInsufficientOpen(true);
				return false;
			}

			let created: { projectId: string; chatId: string };

			try {
				created = await createProject.mutateAsync({
					prompt,
					composer,
					// Uploaded R2 assets ride the create body as FileRefs — the server
					// persists them as file parts on the first user message (spec §11).
					attachments: attachments?.length
						? attachments.map((attachment) => ({
								url: attachment.url,
								mediaType: attachment.mediaType,
								filename: attachment.filename,
							}))
						: undefined,
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));
				return false;
			}

			consume(generationCost, name);
			toast.success(t("projects.createSuccess", { name }));
			// The prompt is already persisted as the chat's first message
			// server-side; this one-shot flag tells the workspace to start
			// streaming the AI's answer to it on arrival.
			chatAutostart.stash(created);

			try {
				await navigate({
					to: "/p/$projectId",
					params: { projectId: created.projectId },
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}

			// The server accepted and persisted the project even if client-side
			// navigation failed, so a second submit must not duplicate it.
			return true;
		},
		[canAfford, consume, createProject, navigate, t],
	);

	const create = useCallback(
		async (
			prompt: string,
			composer?: ComposerMetadata,
			attachments?: UploadAttachmentResponse[],
		) => {
			if (!session) {
				// Uploaded files cannot survive auth, but keeping composer metadata
				// restores the selected workflow and its settings on the dashboard.
				promptStash.stash(prompt, composer);
				open();
				return true;
			}

			return createSignedInProject(prompt, composer, attachments);
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
