/**
 * generate_page — the server-executed tool that queues a real page build.
 *
 * Unlike ask_user (no execute) and get_direction_candidates (module-level
 * singleton), this tool is a FACTORY: it must know which project/chat it acts
 * for, so the agent builds a fresh instance per request with those ids closed
 * over.
 *
 * The tool itself does no design work. It snapshots the designer prompt +
 * brief into an attempt row and hands off to the Trigger.dev task; its
 * return value is only the "queued"/"unavailable" answer the model relays.
 */
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type GeneratePageInput,
	type GeneratePageOutput,
	generatePageInputSchema,
	generatePageOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: pulling the task VALUE here would drag the Trigger task
// (and its DB pool) into the Nest process. The type is enough to make
// tasks.trigger() check the payload shape.
import type { generatePageTask } from "../../../../trigger/generate-page.task";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { buildSiteBuilderSystemPrompt } from "../site-builder/builder-prompt";
import { buildCodSiteBuilderSystemPrompt } from "../site-builder/cod-builder-prompt";
import type { BuilderReasoningOption } from "./builder-model-options";
import { getWorld } from "../worlds";
import { COD_GENRE_DOC, FUSION_CONTRACT } from "../worlds/cod/genre";

// Static Nest logger (no DI needed): queue-side events land in the API
// server terminal; the build itself logs in the Trigger worker terminal.
const logger = new Logger("generate-page");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type GeneratePageToolDeps = {
	// Per-request builder override from the composer's model picker (already
	// resolved against the allow-list in builder-model-options.ts).
	// Undefined = use the env default.
	builderModel?: string;
	// Per-request reasoning pick from the composer (already validated against
	// BUILDER_REASONING_OPTIONS). Undefined = env fallback (default "auto").
	builderReasoning?: BuilderReasoningOption;
	chatId: string;
	pagesRepository: PagesRepository;
	parentEventId?: string;
	projectId: string;
	/** Payer + acting member; the build task meters against this subject. */
	subject: MeteringSubject;
	userId: string;
};

// Explicit return type: composite-project declaration emit cannot name the
// SDK's inferred ExecutableTool type; the plain Tool shape is what callers need.
export function createGeneratePageTool(
	deps: GeneratePageToolDeps,
): Tool<GeneratePageInput, GeneratePageOutput> {
	return tool({
		description:
			"Queue the real landing-page build for this project. Call it ONCE, " +
			"after the brief is complete. The build " +
			"runs in the background and the finished page appears in the user's " +
			"Page tab — it is not instant.",
		inputSchema: generatePageInputSchema,
		outputSchema: generatePageOutputSchema,
		execute: async ({
			brief,
			pageKind,
			title,
			worldId,
			worldIds,
		}): Promise<GeneratePageOutput> => {
			// Checked at CALL time, not boot time: the server must run before
			// credentials exist, and the model must answer honestly when they don't.
			if (!isR2Configured() || !env.TRIGGER_SECRET_KEY) {
				return {
					message:
						"Page generation isn't configured on this server yet " +
						"(Cloudflare R2 + Trigger.dev credentials are missing). The " +
						"page brief is saved in this conversation and generation will " +
						"work as soon as the credentials are added — tell the user " +
						"that honestly.",
					status: "unavailable",
				};
			}

			const artifact = await deps.pagesRepository.findOrCreateLandingArtifact(
				deps.projectId,
			);
			// Snapshotted NOW so later prompt, model, or environment changes
			// never change what this attempt meant. The chosen design world's
			// bible rides inside the same snapshot — the trigger task and the
			// build loop never need to know worlds exist.
			const requestedWorldIds = worldIds ?? (worldId ? [worldId] : []);
			const resolvedWorlds = requestedWorldIds.flatMap((id) => {
				const world = getWorld(id);

				if (!world) {
					logger.warn(
						worldIds
							? `Unknown worldId "${id}" — dropping it from the fusion.`
							: `Unknown worldId "${id}" — building without a world doc.`,
					);

					return [];
				}

				return [world];
			});
			const isCod =
				pageKind === "cod" ||
				resolvedWorlds.some((world) => world.kind === "cod");
			const basePrompt = isCod
				? await buildCodSiteBuilderSystemPrompt()
				: await buildSiteBuilderSystemPrompt();
			const designerSystemPrompt = isCod
				? [
						basePrompt,
						COD_GENRE_DOC,
						...(resolvedWorlds.length > 0
							? [
									FUSION_CONTRACT(resolvedWorlds),
									...resolvedWorlds.map((world) => world.doc),
								]
							: []),
					].join("\n\n")
				: resolvedWorlds[0]
					? `${basePrompt}\n\n${resolvedWorlds[0].doc}`
					: basePrompt;
			// COD funnels default to their own builder (cheap landing models
			// underperformed on conversion pages); an explicit composer pick
			// still wins for both kinds.
			const builderModel =
				deps.builderModel ??
				(isCod
					? (env.AI_PAGE_COD_BUILDER_MODEL ?? "openai/gpt-5.6-luna")
					: (env.AI_PAGE_BUILDER_MODEL ?? env.AI_PAGE_DESIGN_MODEL));
			const attempt = await deps.pagesRepository.insertAttempt({
				artifactId: artifact.id,
				chatId: deps.chatId,
				model: builderModel,
				projectId: deps.projectId,
				spec: {
					brief,
					designerSystemPrompt,
					pageKind: isCod ? "cod" : "website",
					// "auto" is the resolver's default — only a real pick is
					// worth snapshotting.
					...(deps.builderReasoning && deps.builderReasoning !== "auto"
						? { reasoningEffort: deps.builderReasoning }
						: {}),
					title,
				},
			});

			logger.log(
				`Queued page build "${title}" — attempt ${attempt.id}, ` +
					`Builder ${builderModel}` +
					(resolvedWorlds.length > 0
						? `, world${resolvedWorlds.length === 1 ? "" : "s"} "${resolvedWorlds.map((world) => world.id).join('", "')}"`
						: ", no world"),
			);
			// Log only a preview: the full brief is user business data and the
			// full spec is already persisted on the attempt row above.
			logger.log(
				`Brief for attempt ${attempt.id} (${brief.length} chars): ${brief.slice(0, 200)}${brief.length > 200 ? "…" : ""}`,
			);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerGeneratePageTask({
					attemptId: attempt.id,
					...(deps.subject.actorIsLimitExempt
						? { actorIsLimitExempt: true }
						: {}),
					actorUserId: deps.subject.actorUserId,
					...(deps.parentEventId ? { parentEventId: deps.parentEventId } : {}),
					projectId: deps.projectId,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error(
					`Trigger.dev did not confirm page build ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed = await deps.pagesRepository.markAttemptFailed(
							attempt.id,
							"The background page builder rejected this request. Please try again.",
							deps.userId,
						);

						if (closed) {
							return {
								message:
									"Trigger.dev rejected the page build. Tell the user it " +
									"was not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (closeError) {
						logger.error(
							`Closing rejected page build ${attempt.id} failed: ${
								closeError instanceof Error
									? closeError.message
									: String(closeError)
							}`,
						);
					}
				}

				// A timeout or lost response may happen after Trigger.dev accepted
				// the task. Preserve the queued row; the attempt-scoped global key
				// makes each bounded handoff retry refer to that same run.
				return {
					attemptId: attempt.id,
					builderModel,
					message:
						"The page build is saved, but Trigger.dev did not confirm the " +
						"handoff yet. Its Page card will keep checking; do not start a " +
						"second build unless this attempt reaches a failed state.",
					status: "queued",
				};
			}

			// Trigger acceptance is authoritative. The task may claim the queued
			// row before this diagnostic write, and a DB error cannot revoke work
			// that is already running.
			try {
				const linked = await deps.pagesRepository.markAttemptTriggered(
					attempt.id,
					handle.id,
				);

				if (!linked) {
					logger.warn(
						`Page build ${attempt.id} was accepted but its queued run-id CAS lost`,
					);
				}
			} catch (error) {
				logger.warn(
					`Could not persist Trigger.dev run id for page build ${attempt.id}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			logger.log(
				`Trigger.dev accepted the build — run ${handle.id}. Follow the ` +
					"live logs in the worker terminal (npx trigger.dev@latest dev).",
			);
			const realtime = await mintRealtimeHandle(handle.id);

			// Advisory number for the human-facing message; the task assigns
			// the real one inside its transaction. This read is also best-effort:
			// accepted provider work must not surface as a failed tool call.
			let versionNumber: number | undefined;

			try {
				versionNumber = await deps.pagesRepository.nextVersionNumber(
					artifact.id,
				);
			} catch (error) {
				logger.warn(
					`Could not read advisory version for page build ${attempt.id}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			return {
				attemptId: attempt.id,
				builderModel,
				message:
					`Queued: ${versionNumber ? `version ${versionNumber}` : "the next version"} ` +
					"is being generated in the background. It will appear in the " +
					"Page tab when ready — usually a few minutes.",
				...(realtime ? { realtime } : {}),
				status: "queued",
				...(versionNumber ? { versionNumber } : {}),
			};
		},
	});
}

async function triggerGeneratePageTask(payload: {
	actorIsLimitExempt?: boolean;
	actorUserId: string;
	attemptId: string;
	parentEventId?: string;
	projectId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`page-build:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof generatePageTask>(
				"generate-page",
				{
					...(payload.actorIsLimitExempt ? { actorIsLimitExempt: true } : {}),
					actorUserId: payload.actorUserId,
					attemptId: payload.attemptId,
					...(payload.parentEventId
						? { parentEventId: payload.parentEventId }
						: {}),
				},
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`page-build-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					ttl: "35m",
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

/**
 * Mint a read-scoped Realtime token so the chat card can follow the build
 * live instead of showing a static "building…" line. Best-effort: on failure
 * the card falls back to its static state, so the queue must never fail here.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<GeneratePageOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			// Long enough to outlive any build plus a same-session reload; an
			// expired token just means the card shows the static line again.
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the chat card ` +
				`will show static progress: ${error instanceof Error ? error.message : String(error)}`,
		);

		return undefined;
	}
}

export type GeneratePageTool = ReturnType<typeof createGeneratePageTool>;

// Execute-less twin used ONLY for validateUIMessages in the controller:
// same schemas, zero side effects — validating history must never be able
// to queue a build.
export const generatePageToolSchemaOnly: Tool<
	GeneratePageInput,
	GeneratePageOutput
> = tool({
	inputSchema: generatePageInputSchema,
	outputSchema: generatePageOutputSchema,
});
