/**
 * State of the model menu: the priced models, the pick of one project or of
 * the next new project, and its setter. The builder page and the dashboard
 * (through the barrel) call it. Reads `GET /api/v2/models` through
 * app-builder.queries.ts, and the stored pick through helpers.ts.
 */

import { useQuery } from "@tanstack/react-query";
import type { LlmModelPrice } from "@wandit/contracts";
import { useMemo, useState } from "react";

import { builderModelsQuery } from "../api/app-builder.queries";
import { readBuilderModel, writeBuilderModel } from "./helpers";

/** What the model menu reads and sets. BuilderModelPicker renders it. */
export type BuilderModelPick = {
	/** Priced models of `GET /api/v2/models`, in server order. Undefined while the list loads or after it failed: the menu then hides. */
	models: readonly LlmModelPrice[] | undefined;
	/** Model id the next send carries. Undefined while the list loads, or when no listed model fits: the server default then runs. */
	modelId: string | undefined;
	/** Uses this listed model id from the next send, and stores it for the project. */
	setModelId: (modelId: string) => void;
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
	return {
		models: data?.models,
		modelId:
			pick !== null && pick.projectId === projectId
				? pick.modelId
				: storedModelId,
		setModelId: (modelId) => {
			writeBuilderModel(projectId, modelId);
			setPick({ projectId, modelId });
		},
	};
}

// The pick of a build without V2. Callers never show it, because useV2BuilderEnabled answers false there.
const NO_MODEL_PICK: BuilderModelPick = {
	models: undefined,
	modelId: undefined,
	setModelId: () => undefined,
};

/**
 * The model menu state. A build without V2 (the Vercel production build)
 * gets a pick with no models. The bundler then removes the list query and
 * the storage code.
 */
export const useBuilderModelPick: typeof useBuilderModelPickInBuild =
	__V2_BUILDER_IN_BUILD__ ? useBuilderModelPickInBuild : () => NO_MODEL_PICK;
