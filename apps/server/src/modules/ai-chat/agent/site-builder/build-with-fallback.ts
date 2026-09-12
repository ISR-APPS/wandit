/**
 * Runs a page build through the fallback chain for its page kind.
 * The Trigger task injects builds, event sinks, classification, namespaces, and fallback reporting.
 * This file performs no I/O and imports no Nest modules.
 */
import type { PageBuildFailureCode } from "@wandit/contracts";

import type { NormalizedAiError } from "../../../ai-errors/domain";
import {
	fallbackBuilderModel,
	isTransientProviderFailure,
} from "../../../pages";
import type { BuildProgressEvent } from "./build-progress";
import { appendReadyMediaAssets } from "./ready-media-assets";
import type { BuilderPageKind, SiteBuildResult } from "./site-builder-agent";

/** Describes one isolated model run and its unique media namespace. */
export type FallbackBuildRun = {
	model: string;
	assetNamespace: string;
	brief: string;
};

/** Includes each failed run and the final successful run for task logs. */
export type BuildWithFallbackResult = {
	build: SiteBuildResult;
	model: string;
	runs: Array<{ model: string; failureCode: PageBuildFailureCode | null }>;
};

/**
 * Retries transient provider failures through the chain for the page kind.
 * Each fallback reuses completed images from earlier runs.
 */
export async function runSiteBuildWithFallback(params: {
	brief: string;
	model: string;
	pageKind: BuilderPageKind;
	abortSignal: AbortSignal;
	runBuild: (
		run: FallbackBuildRun,
		onEvent: (event: BuildProgressEvent) => void,
	) => Promise<SiteBuildResult>;
	classifyFailure: (
		error: unknown,
		model: string,
	) => {
		failureCode: PageBuildFailureCode;
		normalized: NormalizedAiError;
	};
	nextAssetNamespace: () => string;
	onEvent: (event: BuildProgressEvent) => void;
	onFallback: (info: {
		error: unknown;
		failureCode: PageBuildFailureCode;
		fromModel: string;
		normalized: NormalizedAiError;
		toModel: string;
	}) => void;
}): Promise<BuildWithFallbackResult> {
	const images: Array<{
		aspect: string;
		height: number;
		role: string;
		url: string;
		width: number;
	}> = [];
	const runs: BuildWithFallbackResult["runs"] = [];
	let brief = params.brief;
	let model = params.model;

	// Each result returns or throws. Only an approved fallback starts another run.
	// A start model outside the chain adds one initial run.
	// LIMIT: up to five runs (one outside start model plus four chain models) inside the task's 2700 s maxDuration; a late fallback can still hit that ceiling. Upgrade: pass a deadline and stop the chain when the remaining time is short.
	while (true) {
		const assetNamespace = params.nextAssetNamespace();

		try {
			const build = await params.runBuild(
				{ assetNamespace, brief, model },
				(event) => {
					if (event.type === "image-generated") {
						images.push({
							aspect: event.aspect,
							height: event.height,
							role: event.role,
							url: event.url,
							width: event.width,
						});
					}

					params.onEvent(event);
				},
			);
			runs.push({ failureCode: null, model });

			return { build, model, runs };
		} catch (error) {
			// Cancellation is final, even when the provider failure is temporary.
			if (params.abortSignal.aborted) {
				throw error;
			}

			const { failureCode, normalized } = params.classifyFailure(error, model);
			runs.push({ failureCode, model });

			// Permanent failures retain their original error and do not add another provider charge.
			if (!isTransientProviderFailure(failureCode, normalized)) {
				throw error;
			}

			const next = fallbackBuilderModel(
				params.pageKind,
				runs.map((run) => run.model),
			);

			// An exhausted chain keeps the last provider error.
			if (next === null) {
				throw error;
			}

			params.onFallback({
				error,
				failureCode,
				fromModel: model,
				normalized,
				toModel: next,
			});
			params.onEvent({
				fromModel: model,
				toModel: next,
				type: "model-fallback",
			});
			// LIMIT: one image per role, newest wins; the 16-line READY MEDIA cap holds 16 roles. Upgrade: raise MAX_READY_MEDIA_ASSET_LINES.
			const newestImageByRole = new Map<string, (typeof images)[number]>();
			for (const image of images.toReversed()) {
				if (!newestImageByRole.has(image.role)) {
					newestImageByRole.set(image.role, image);
				}
			}
			brief = appendReadyMediaAssets(
				params.brief,
				[...newestImageByRole.values()].map((image) => ({
					kind: `image for ${image.role} (${image.aspect}, ${image.width}x${image.height})`,
					url: image.url,
				})),
			);
			model = next;
		}
	}
}
