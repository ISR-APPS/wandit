// Feature hooks that aren't queries/mutations.

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type {
	ComposerMetadata,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	canAutostartStashedPrompt,
	promptStash,
	type StashedPrompt,
	useAuthModal,
	useSession,
} from "@/features/auth";
import {
	CREDIT_COSTS,
	creditsKeys,
	useCreditBalanceQuery,
} from "@/features/credits";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateProject } from "../api/projects.mutations";
import { outputRequiresSourceImage } from "../components/prompt-box";
import { canDraftAutostart } from "./autostart-eligibility";
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
 * for the post-auth dashboard; signed-in prompts charge credits, create the
 * project and navigate to the workspace. Call sites render
 * <InsufficientCreditsDialog /> next to their PromptBox with
 * { insufficientOpen, setInsufficientOpen, cost }.
 */
export function useCreateProjectWithPrompt(): UseCreateProjectWithPromptResult {
	const { t } = useTranslation();
	const { data: session, isPending: isSessionPending } = useSession();
	const { open } = useAuthModal();
	const balanceQuery = useCreditBalanceQuery({ enabled: Boolean(session) });
	const createProject = useCreateProject();
	const queryClient = useQueryClient();
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
			// This is a convenience precheck only. The server performs the atomic
			// reservation and remains authoritative if this cached balance is stale.
			const availableCredits = balanceQuery.data?.balance;
			if (availableCredits === undefined) {
				toast.error(
					balanceQuery.error
						? getApiErrorMessage(balanceQuery.error)
						: t("credits.balanceLoadError"),
				);
				return false;
			}

			if (availableCredits < generationCost) {
				setInsufficientOpen(true);
				return false;
			}

			// Claim the post-auth stash so a later dashboard visit cannot create
			// a second project from the same landing-page draft.
			promptStash.consume();

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
				if (
					isApiClientError(error) &&
					error.statusCode === 402 &&
					(error.code === "INSUFFICIENT_CREDITS" ||
						error.code === "GENERATION_PAYMENT_REQUIRED")
				) {
					void queryClient.invalidateQueries({
						queryKey: creditsKeys.balance(),
					});
					void queryClient.invalidateQueries({
						queryKey: creditsKeys.ledgers(),
					});
					return false;
				}

				toast.error(getApiErrorMessage(error));
				return false;
			}

			void queryClient.invalidateQueries({
				queryKey: creditsKeys.balance(),
			});
			void queryClient.invalidateQueries({
				queryKey: creditsKeys.ledgers(),
			});
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
		[
			balanceQuery.data?.balance,
			balanceQuery.error,
			createProject,
			navigate,
			queryClient,
			t,
		],
	);

	const create = useCallback(
		async (
			prompt: string,
			composer?: ComposerMetadata,
			attachments?: UploadAttachmentResponse[],
		) => {
			if (!session) {
				// Uploaded files cannot survive auth, but keeping composer metadata
				// restores the selected workflow. Drafts that lost required inputs
				// (attachments, source stills) or whose price was never shown may
				// only prefill — the dashboard autostart checks the recorded flag.
				promptStash.stash(prompt, composer, {
					autostart: canDraftAutostart(
						composer,
						attachments?.length ?? 0,
						outputRequiresSourceImage,
					),
				});
				open();
				return true;
			}

			return createSignedInProject(prompt, composer, attachments);
		},
		[createSignedInProject, open, session],
	);

	return {
		create,
		isCreating:
			createProject.isPending ||
			isSessionPending ||
			(Boolean(session) && balanceQuery.isPending),
		insufficientOpen,
		setInsufficientOpen,
		cost,
	};
}

export type UseAutostartStashedPromptResult = {
	/** Bump = remount the PromptBox (prefill on restore, clear after success). */
	restoreKey: number;
	restoredPrompt: string;
	restoredComposer?: ComposerMetadata;
	/** OR this into the PromptBox isSubmitting while the auto-create runs. */
	isAutostarting: boolean;
};

/**
 * Dashboard-only companion to useCreateProjectWithPrompt (pass its `create`):
 * consumes the post-auth prompt stash, restores the draft into the composer,
 * and — when the stash is fresh and was marked eligible — creates the project
 * and starts generation without another click.
 *
 * Failure paths never lose the draft and never charge twice: a signed-out or
 * failed-balance settle downgrades to prefill, a rejected create re-stashes
 * the draft as prefill-only, and a successful create clears the composer so
 * a failed navigation cannot invite a duplicate submit.
 */
export function useAutostartStashedPrompt(
	create: UseCreateProjectWithPromptResult["create"],
): UseAutostartStashedPromptResult {
	const { data: session, isPending: isSessionPending } = useSession();
	const balanceQuery = useCreditBalanceQuery({ enabled: Boolean(session) });
	const [restored, setRestored] = useState<{
		key: number;
		prompt: string;
		composer?: ComposerMetadata;
	}>({ key: 0, prompt: "" });
	const [isAutostarting, setIsAutostarting] = useState(false);
	// idle → (consume) → waiting → done; the ref also latches Strict Mode's
	// double effects so the one-shot stash is read exactly once.
	const phaseRef = useRef<"idle" | "waiting" | "done">("idle");
	const draftRef = useRef<StashedPrompt | null>(null);
	// Snapshot of promptStash.generation() at consume time: a sign-out in
	// between clears the stash, and a deferred re-stash must not resurrect it.
	const stashGenerationRef = useRef(0);
	// create's identity changes every render (react-query mutation objects);
	// going through a ref keeps the firing effect off that treadmill.
	const createRef = useRef(create);
	createRef.current = create;

	// Put a consumed draft back as prefill-only (never re-billable) unless the
	// user signed out since — the next account must not inherit it.
	const restashPrefillOnly = useCallback((draft: StashedPrompt) => {
		if (promptStash.generation() !== stashGenerationRef.current) return;
		promptStash.stash(draft.prompt, draft.composer);
	}, []);

	useEffect(() => {
		if (phaseRef.current !== "idle") return;
		phaseRef.current = "done";
		const draft = promptStash.consume();
		if (!draft) return;
		stashGenerationRef.current = promptStash.generation();
		setRestored((prev) => ({
			key: prev.key + 1,
			prompt: draft.prompt,
			composer: draft.composer,
		}));
		if (canAutostartStashedPrompt(draft)) {
			draftRef.current = draft;
			phaseRef.current = "waiting";
			setIsAutostarting(true);
		}
	}, []);

	// Any exit from the wait that does not create keeps the draft twice over:
	// visible as prefill, and re-stashed prefill-only so a full-page reload or
	// re-auth still finds it — and can never re-bill it.
	const abandonWait = useCallback(() => {
		const draft = draftRef.current;
		if (!draft || phaseRef.current !== "waiting") return;
		phaseRef.current = "done";
		draftRef.current = null;
		restashPrefillOnly(draft);
		setIsAutostarting(false);
	}, [restashPrefillOnly]);

	// Leaving the dashboard mid-wait (SPA navigation before session/balance
	// settle) must not drop the already-consumed draft. Deferred by a tick so
	// a Strict Mode simulated unmount/remount cancels it instead of aborting.
	const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (unmountTimerRef.current !== null) {
			clearTimeout(unmountTimerRef.current);
			unmountTimerRef.current = null;
		}
		return () => {
			unmountTimerRef.current = setTimeout(abandonWait, 0);
		};
	}, [abandonWait]);

	useEffect(() => {
		const draft = draftRef.current;
		if (!draft || phaseRef.current !== "waiting") return;
		if (isSessionPending) return;
		if (!session) {
			// The route guard let the page in but the client session settled
			// signed-out (revoked cookie, failed session fetch).
			abandonWait();
			return;
		}
		if (balanceQuery.isError) {
			// Autostart is one-shot — a failed balance fetch downgrades to a
			// visible prefill (with the reason) instead of burning it silently.
			toast.error(getApiErrorMessage(balanceQuery.error));
			abandonWait();
			return;
		}
		if (balanceQuery.isPending) return;
		if (!canAutostartStashedPrompt(draft)) {
			// The wait outlived the freshness window (offline, suspended tab).
			abandonWait();
			return;
		}
		phaseRef.current = "done";
		draftRef.current = null;
		createRef
			.current(draft.prompt, draft.composer)
			.then((created) => {
				if (created) {
					// Success normally navigates away; if navigation failed, an empty
					// remount stops the still-primed draft from being submitted (and
					// charged) a second time.
					setRestored((prev) => ({ key: prev.key + 1, prompt: "" }));
					return;
				}
				// The create was refused (insufficient credits, 401, server error).
				// The refusal UI already showed; put the draft back as prefill-only.
				restashPrefillOnly(draft);
			})
			.catch(() => {
				restashPrefillOnly(draft);
			})
			.finally(() => {
				setIsAutostarting(false);
			});
	}, [
		abandonWait,
		balanceQuery.error,
		balanceQuery.isError,
		balanceQuery.isPending,
		isSessionPending,
		restashPrefillOnly,
		session,
	]);

	return {
		restoreKey: restored.key,
		restoredPrompt: restored.prompt,
		restoredComposer: restored.composer,
		isAutostarting,
	};
}
