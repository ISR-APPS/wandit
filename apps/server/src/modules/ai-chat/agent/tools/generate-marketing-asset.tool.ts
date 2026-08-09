/**
 * generate_marketing_asset — queues one named marketing deliverable (a
 * self-contained HTML document) built from a complete marketing brief. The
 * finished card appears in the workspace Marketing tab; the tool answers
 * immediately with "queued".
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type GenerateMarketingAssetInput,
	type GenerateMarketingAssetOutput,
	generateMarketingAssetInputSchema,
	generateMarketingAssetOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { generateMarketingAssetTask } from "../../../../trigger/generate-marketing-asset.task";
import { hasLlmProviderKey } from "../../../ai-provider/domain/llm-provider";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createMarketingAssetBilling,
	type MarketingAssetBilling,
} from "../../../marketing-assets/application/services/marketing-asset-billing";
import type { MarketingAssetsRepository } from "../../../marketing-assets/infrastructure/persistence/marketing-assets.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";

const logger = new Logger("generate-marketing-asset");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type GenerateMarketingAssetToolDeps = {
	chatId: string;
	marketingAssetsRepository: MarketingAssetsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	// Composer quality tier, snapshotted for later model swapping — the
	// generator does not read it yet.
	quality?: string;
	requestKeySeed?: string;
	/** Pays for the asset: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
};

export function createGenerateMarketingAssetTool(
	deps: GenerateMarketingAssetToolDeps,
): Tool<GenerateMarketingAssetInput, GenerateMarketingAssetOutput> {
	const billing = createMarketingAssetBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});

	return tool({
		description:
			"Queue one named marketing deliverable as a designed HTML document " +
			"(ad copy set, marketing strategy, video script, creative brief, or " +
			"a custom HTML asset). It builds in the background and appears as a " +
			"card in the user's Marketing tab. Call once per deliverable with a " +
			"complete marketing brief — the generator sees ONLY the brief, never " +
			"this conversation.",
		inputSchema: generateMarketingAssetInputSchema,
		outputSchema: generateMarketingAssetOutputSchema,
		execute: async (input, options): Promise<GenerateMarketingAssetOutput> => {
			if (
				!hasLlmProviderKey("marketing") ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Marketing asset generation is not configured on this server " +
						"yet. Tell the user honestly that model, storage, and " +
						"Trigger.dev credentials are required.",
					status: "unavailable",
				};
			}

			let asset: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							assetType: input.assetType,
							brief: input.brief,
							request: deps.requestKeySeed ?? options.toolCallId,
							title: input.title,
						}),
					)
					.digest("hex");

				asset = await deps.marketingAssetsRepository.insertAsset({
					assetType: input.assetType,
					brief: input.brief.trim(),
					chatId: deps.chatId,
					name: input.title.trim(),
					projectId: deps.projectId,
					requestKey,
					spec: deps.quality ? { quality: deps.quality } : undefined,
				});
			} catch (error) {
				logger.error(
					"Creating the marketing asset failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The marketing asset could not be saved on the server. Tell " +
						"the user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!asset.created && asset.status === "failed") {
				await refundReservation(deps, billing, asset.id);

				return {
					message:
						"This exact marketing request already failed. Tell the user " +
						"and wait for a new request before retrying.",
					status: "unavailable",
				};
			}

			if (
				!asset.created &&
				(asset.status === "generating" || asset.status === "succeeded")
			) {
				return {
					assetId: asset.id,
					message:
						"This marketing request was already accepted. Its card is in " +
						"the Marketing tab.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				asset.id,
				deps.parentEventId,
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let realtime: GenerateMarketingAssetOutput["realtime"];
			try {
				const handle = await triggerMarketingAssetTask({
					assetId: asset.id,
					billingMode: reservation.eventId ? "enforce" : "off",
					organizationId: deps.subject.organizationId ?? null,
					...(deps.parentEventId ? { parentEventId: deps.parentEventId } : {}),
					projectId: deps.projectId,
					userId: deps.userId,
				});

				try {
					await deps.marketingAssetsRepository.markAssetTriggered(
						asset.id,
						handle.id,
					);
				} catch (error) {
					logger.warn(
						`Could not persist Trigger.dev run id for ${asset.id}: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}

				realtime = await mintRealtimeHandle(handle.id);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				logger.error(
					`Trigger.dev did not confirm marketing asset ${asset.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed = await deps.marketingAssetsRepository.markAssetFailed(
							asset.id,
							"The background generator rejected this request. Please try again.",
							deps.userId,
						);

						if (closed) {
							await refundReservation(deps, billing, asset.id);

							return {
								message:
									"Trigger.dev rejected the marketing request. Tell the " +
									"user it was not queued and offer to retry after the " +
									"server configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected marketing asset ${asset.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// The request may have been accepted even when the HTTP response was
				// lost; the attempt-based idempotency key makes retries safe.
				return {
					assetId: asset.id,
					message:
						"The marketing request is saved, but Trigger.dev did not " +
						"confirm the handoff yet. Its card in the Marketing tab will " +
						"keep checking.",
					status: "queued",
				};
			}

			return {
				assetId: asset.id,
				message:
					"Queued: the marketing asset is being generated. It appears as " +
					"a named card in the user's Marketing tab, usually within a " +
					"minute or two.",
				realtime,
				status: "queued",
			};
		},
	});
}

/**
 * Mint a read-scoped Realtime token so the chat card can follow the run
 * instead of waiting on the poll. Best-effort: on failure the card silently
 * falls back to the Marketing list poll, so the queue must never fail here.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<GenerateMarketingAssetOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			// Long enough to outlive any generation plus a same-session reload;
			// an expired token just means the poll carries the card alone.
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the chat card ` +
				`will rely on polling: ${error instanceof Error ? error.message : String(error)}`,
		);

		return undefined;
	}
}

async function triggerMarketingAssetTask(payload: {
	assetId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`marketing-asset:${payload.assetId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof generateMarketingAssetTask>(
				"generate-marketing-asset",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`marketing-asset:${payload.assetId}`,
						`project:${payload.projectId}`,
					],
					ttl: "25m",
				},
			);
		} catch (error) {
			lastError = error;

			if (isDefinitiveTriggerRejection(error)) {
				break;
			}

			if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
				await delay(100 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Trigger.dev handoff failed");
}

function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

async function refundReservation(
	deps: GenerateMarketingAssetToolDeps,
	billing: MarketingAssetBilling,
	assetId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, assetId);
	} catch (error) {
		logger.error(
			`Refunding marketing asset reservation ${assetId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type GenerateMarketingAssetTool = ReturnType<
	typeof createGenerateMarketingAssetTool
>;

export const generateMarketingAssetToolSchemaOnly: Tool<
	GenerateMarketingAssetInput,
	GenerateMarketingAssetOutput
> = tool({
	inputSchema: generateMarketingAssetInputSchema,
	outputSchema: generateMarketingAssetOutputSchema,
});
