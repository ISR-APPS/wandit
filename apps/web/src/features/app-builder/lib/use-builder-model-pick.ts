/**
 * State of the model menu: the priced models, the model pick and the
 * thinking pick of one project or of the next new project, and their
 * setters. The builder page and the dashboard (through the barrel) call it.
 * Reads `GET /api/v2/models` through app-builder.queries.ts, and the stored
 * picks through helpers.ts. The builder composer and the dashboard prompt
 * box show the thinking pick.
 */

import { useQuery } from "@tanstack/react-query";
import type { BuilderThinking, LlmModelPrice } from "@wandit/contracts";
import { useMemo, useState } from "react";

import { builderModelsQuery } from "../api/app-builder.queries";
import {
	readBuilderModel,
	readBuilderThinking,
	writeBuilderModel,
	writeBuilderThinking,
} from "./helpers";

/** What the model menu reads and sets. BuilderModelPicker renders it. */
export type BuilderModelPick = {
	/** Priced models of `GET /api/v2/models`, in server order. Undefined while the list loads or after it failed: the menu then hides. */
	models: readonly LlmModelPrice[] | undefined;
	/** Model id the next send carries. Undefined while the list loads, or when no listed model fits: the server default then runs. */
	modelId: string | undefined;
	/** Uses this listed model id from the next send, and stores it for the project. */
	setModelId: (modelId: string) => void;
	/** Thinking level of the next send. The thinking row of the model card or the lock chip sets it. "balanced" when nothing valid is stored. */
	thinking: BuilderThinking;
	/** Uses this thinking level from the next send, and stores it for the project. */
	setThinking: (thinking: BuilderThinking) => void;
};

/**
 * `projectId` is the project of the pick; null is the next new project.
 * `isEnabled` false skips the list read, as for a user outside the V2
 * rollout: the route answers them 403.
 */
function useBuilderModelPickInBuild(
	projectId: string | null,
	isEnabled: boolean,
): BuilderModelPick {
	const { data } = useQuery({ ...builderModelsQuery(), enabled: isEnabled });
	// A project switch in place keeps this hook, so a pick of another project reads as none.
	const [pick, setPick] = useState<{
		projectId: string | null;
		modelId: string;
	} | null>(null);
	const storedModelId = useMemo(
		() => (data === undefined ? undefined : readBuilderModel(projectId, data)),
		[projectId, data],
	);
	// Ops can turn a model off. A pick that the list no longer holds then falls back to the stored-pick rule.
	const isPickListed =
		pick !== null &&
		pick.projectId === projectId &&
		data?.models.some((row) => row.modelId === pick.modelId) === true;
	// The same project rule as the model pick above.
	const [thinkingPick, setThinkingPick] = useState<{
		projectId: string | null;
		thinking: BuilderThinking;
	} | null>(null);
	const storedThinking = useMemo(
		() => readBuilderThinking(projectId),
		[projectId],
	);
	return {
		models: data?.models,
		modelId: isPickListed ? pick.modelId : storedModelId,
		setModelId: (modelId) => {
			writeBuilderModel(projectId, modelId);
			setPick({ projectId, modelId });
		},
		thinking:
			thinkingPick !== null && thinkingPick.projectId === projectId
				? thinkingPick.thinking
				: storedThinking,
		setThinking: (thinking) => {
			writeBuilderThinking(projectId, thinking);
			setThinkingPick({ projectId, thinking });
		},
	};
}

// The pick of a build without V2. Callers never show it, because useV2BuilderEnabled answers false there.
const NO_MODEL_PICK: BuilderModelPick = {
	models: undefined,
	modelId: undefined,
	setModelId: () => undefined,
	thinking: "balanced",
	setThinking: () => undefined,
};

/**
 * The model menu state. A build without V2 (the Vercel production build)
 * gets a pick with no models. The bundler then removes the list query and
 * the storage code.
 */
export const useBuilderModelPick: typeof useBuilderModelPickInBuild =
	__V2_BUILDER_IN_BUILD__ ? useBuilderModelPickInBuild : () => NO_MODEL_PICK;
