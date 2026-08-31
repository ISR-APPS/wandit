/**
 * Provider adapter for deterministic whole-clip edits.
 *
 * Seedance accepts the source only as a public HTTPS video reference. The
 * caller has already authorized and snapshotted that URL from a succeeded
 * attempt in the same project; this boundary only renders and publishes it.
 */
import { writeFile } from "node:fs/promises";

import { gateway } from "@ai-sdk/gateway";
import { env } from "@wandit/env/server";
import { experimental_generateVideo as generateVideo } from "ai";

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import type { NormalizedAiError } from "../../../ai-errors/domain";
import { renderAiErrorSentence } from "../../../ai-errors/domain";
import {
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	type GatewayMeteringContext,
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";
import {
	classifyVideoAdapterError,
	editVideoProviderTimeoutMs,
} from "./generate-video";

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"video/mp4": "mp4",
	"video/webm": "webm",
};

export type EditVideoResult =
	| (GatewayGenerationFailure & { failure?: NormalizedAiError })
	| { message: string; status: "unavailable" }
	| ({
			mediaType: string;
			status: "generated";
			url: string;
			warnings?: string[];
	  } & GatewayGenerationMetadata);

export async function editVideo(params: {
	abortSignal?: AbortSignal;
	attemptId: string;
	metering: GatewayMeteringContext<"video">;
	modelId: string;
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	outputPath: string;
	projectId: string;
	prompt: string;
	sourceDurationSeconds: number;
	sourceVideoUrl: string;
}): Promise<EditVideoResult> {
	if (
		!env.AI_GATEWAY_API_KEY ||
		!env.R2_PUBLIC_BASE_URL ||
		!isR2Configured() ||
		!env.TRIGGER_SECRET_KEY
	) {
		return {
			message: "video editing is not configured on this server",
			status: "unavailable",
		};
	}

	if (!isPublicHttpsUrl(params.sourceVideoUrl)) {
		return {
			message:
				"the snapshotted source video is not publicly reachable over HTTPS",
			status: "failed",
		};
	}

	let providerEvidence: GatewayGenerationMetadata | null = null;
	let providerAbortSignal = params.abortSignal;

	try {
		const timeoutSignal = AbortSignal.timeout(
			editVideoProviderTimeoutMs(params.sourceDurationSeconds),
		);
		providerAbortSignal = params.abortSignal
			? AbortSignal.any([params.abortSignal, timeoutSignal])
			: timeoutSignal;
		const providerOptions: NonNullable<
			Parameters<typeof generateVideo>[0]["providerOptions"]
		> = withGatewayAttribution({}, params.metering);
		// Seedance's verified edit recipe uses the provider-only "adaptive"
		// value. AI SDK 7.0.19 exposes only `${number}:${number}` publicly, so
		// keep the single unavoidable cast at this adapter boundary.
		const adaptiveAspect = "adaptive" as `${number}:${number}`;
		const result = await generateVideo({
			abortSignal: providerAbortSignal,
			aspectRatio: adaptiveAspect,
			duration: -1,
			inputReferences: [
				{ data: params.sourceVideoUrl, mediaType: "video/mp4" },
			],
			maxRetries: 0,
			model: gateway.video(params.modelId),
			n: 1,
			prompt: params.prompt,
			providerOptions,
		});

		providerEvidence = {
			model: params.modelId,
			providerMetadata: result.providerMetadata,
		};
		// Evidence is the billing/recovery authority and must be durable before
		// the final deterministic object can become recoverable.
		await params.onProviderGeneration?.(providerEvidence);

		const mediaType = result.video.mediaType;
		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "mp4";
		const key = siteVideoKey(params.projectId, params.attemptId, 1, extension);
		await writeFile(params.outputPath, result.video.uint8Array);
		await putSiteFile(
			key,
			result.video.uint8Array,
			mediaType,
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);

		return {
			mediaType,
			model: params.modelId,
			providerMetadata: result.providerMetadata,
			status: "generated",
			url: publicAssetUrl(key),
			...(result.warnings.length > 0
				? {
						warnings: result.warnings.map((warning) => JSON.stringify(warning)),
					}
				: {}),
		};
	} catch (error) {
		const errorCapture = gatewayGenerationCaptureFromError(error);
		const evidence =
			providerEvidence ??
			(errorCapture
				? {
						model: params.modelId,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);
		const failure = classifyVideoAdapterError({
			abortSignal: providerAbortSignal,
			error,
			model: params.modelId,
			providerMetadata: evidence?.providerMetadata,
		});

		return {
			...(evidence ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
			...(evidence ? { providerUnits: providerEvidence ? 1 : 0 } : {}),
			status: "failed",
		};
	}
}

function isPublicHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" && url.username === "" && url.password === ""
		);
	} catch {
		return false;
	}
}
