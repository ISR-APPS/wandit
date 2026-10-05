/**
 * Starts a project from the prompt box of the landing hero. The hero calls it.
 * Signed out: stashes the prompt with the app type and opens the auth modal,
 * and the dashboard creates the project after sign-in. Signed in: creates the
 * project now through the V2 or the V1 create hook.
 */

import type { TargetPlatform } from "@wandit/contracts";

import {
	useCreateAppProjectWithPrompt,
	useV2BuilderEnabled,
} from "@/features/app-builder";
import { promptStash, useAuthModal, useSession } from "@/features/auth";
import { useCreateProjectWithPrompt } from "@/features/projects";

/** What the hero reads. The hero renders the insufficient credits dialog. */
export type LandingCreate = {
	/** Resolves true when the draft is stashed or the server kept the project. */
	create: (prompt: string) => Promise<boolean>;
	isCreating: boolean;
	/** True after a refused create for credits. */
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
};

/** `targetPlatform` is the app type of the platform token in the hero sentence. */
export function useLandingCreate(
	targetPlatform: TargetPlatform,
): LandingCreate {
	const { data: session, isPending: isSessionPending } = useSession();
	const { open } = useAuthModal();
	// Product rule: a user in the V2 rollout builds an app with the V2 engine;
	// every other user builds a V1 page. Both hooks run so the switch is safe.
	// LIMIT: while the public settings load, the switch answers V1, so a
	// signed-in create in that window makes a V1 page.
	// Upgrade: expose the loading state from useV2BuilderEnabled and hold
	// the create until it is known.
	const v2Enabled = useV2BuilderEnabled();
	const v1Flow = useCreateProjectWithPrompt();
	const v2Flow = useCreateAppProjectWithPrompt(targetPlatform);
	const flow = v2Enabled ? v2Flow : v1Flow;

	async function create(prompt: string) {
		if (!session) {
			// The box has no files, so the draft always starts after sign-in.
			promptStash.stash(prompt, undefined, { autostart: true, targetPlatform });
			open();
			return true;
		}
		return flow.create(prompt);
	}

	return {
		create,
		isCreating: isSessionPending || flow.isCreating,
		insufficientOpen: flow.insufficientOpen,
		setInsufficientOpen: flow.setInsufficientOpen,
	};
}
