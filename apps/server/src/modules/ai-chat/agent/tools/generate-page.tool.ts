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

import { Logger } from "@nestjs/common";
import type { tasks } from "@trigger.dev/sdk";
import {
	type GeneratePageInput,
	type GeneratePageOutput,
	generatePageInputSchema,
	generatePageOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";
import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	isDefinitiveTriggerRejection,
	mintRealtimeHandle,
	triggerGeneratePageTask,
} from "../../../pages/application/page-build-handoff";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { ConversationGeneratedAsset } from "../annotate-generated-assets";
import {
	buildSiteBuilderSystemPrompt,
	WORLD_DEPARTURE_POINT_HEADING,
} from "../site-builder/builder-prompt";
import { buildCodSiteBuilderSystemPrompt } from "../site-builder/cod-builder-prompt";
import { buildSimpleCodSiteBuilderSystemPrompt } from "../site-builder/simple-cod-builder-prompt";
import {
	SIMPLE_COD_STYLE_DOC,
	sampleSimpleCodRecipe,
} from "../site-builder/simple-cod-recipe";
import type { BuilderReasoningOption } from "./builder-model-options";
import { getWorld } from "../worlds";
import { COD_GENRE_DOC, FUSION_CONTRACT } from "../worlds/cod/genre";

// Static Nest logger (no DI needed): queue-side events land in the API
// server terminal; the build itself logs in the Trigger worker terminal.
const logger = new Logger("generate-page");

export type GeneratePageToolDeps = {
	// Per-request builder override from the composer's model picker (already
	// resolved against the allow-list in builder-model-options.ts).
	// Undefined = use the env default.
	builderModel?: string;
	// Per-request reasoning pick from the composer (already validated against
	// BUILDER_REASONING_OPTIONS). Undefined = env fallback (default "auto").
	builderReasoning?: BuilderReasoningOption;
	chatId: string;
	// Finished [Generated …] assets from this conversation's transcript. The
	// execute path appends the ones the Brain's brief forgot, so a build can
	// never lose media the user generated on purpose.
	conversationAssets?: readonly ConversationGeneratedAsset[];
	// Raw http(s) links the user supplied in chat, preserved even when the
	// Brain omits them from its free-text brief.
	conversationUserLinks?: readonly string[];
	pagesRepository: PagesRepository;
	parentEventId?: string;
	projectId: string;
	/** Payer + acting member; the build task meters against this subject. */
	subject: MeteringSubject;
	userId: string;
};

// Media- and link-heavy chats stay bounded so deterministic appendices can
// never crowd out the brief itself.
const MAX_READY_MEDIA_ASSET_LINES = 16;
const MAX_USER_LINKS = 16;
const USER_HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`)\]}]+/giu;
const TRAILING_URL_SYNTAX_PATTERN = /[.,;:!?…。，、；：！？\p{Pe}\p{Pf}]+$/gu;
const URL_MARKDOWN_WRAPPERS = ["**", "__", "~~", "*", "_", "~"] as const;

function stripTrailingUrlSyntax(
	candidate: string,
	leadingText: string,
): string {
	const url = candidate.replace(TRAILING_URL_SYNTAX_PATTERN, "");
	const wrapper = URL_MARKDOWN_WRAPPERS.find(
		(syntax) => leadingText.endsWith(syntax) && url.endsWith(syntax),
	);

	return wrapper ? url.slice(0, -wrapper.length) : url;
}

function collectHttpUrls(text: string): Set<string> {
	return new Set(
		[...text.matchAll(USER_HTTP_URL_PATTERN)]
			.map((match) =>
				stripTrailingUrlSyntax(match[0], text.slice(0, match.index)),
			)
			.filter(Boolean),
	);
}

/**
 * Deterministic belt-and-braces for generated media: whatever the Brain's
 * free-text brief forgot, the server appends. Assets whose URL the brief
 * already mentions are skipped, so a diligent brief passes through unchanged.
 */
export function appendReadyMediaAssets(
	brief: string,
	assets: readonly ConversationGeneratedAsset[],
): string {
	const missing = assets
		.filter((asset) => !brief.includes(asset.url))
		.slice(0, MAX_READY_MEDIA_ASSET_LINES);

	if (missing.length === 0) {
		return brief;
	}

	const lines = missing.map((asset) => `- ${asset.kind}: ${asset.url}`);

	return [
		brief.trimEnd(),
		"",
		"READY MEDIA ASSETS (generated in this conversation — hosted, final, and allowed on the page):",
		...lines,
		"Placing every listed asset is part of the brief: give each one the role it serves best, and never generate a new image for a role a listed asset already covers.",
	].join("\n");
}

/**
 * Deterministic guard for user-provided links: append the candidates the Brain's
 * free-text brief forgot, while preserving the transcript's order.
 */
export function appendUserLinks(
	brief: string,
	links: readonly string[],
): string {
	const briefUrls = collectHttpUrls(brief);
	const missing = [
		...new Set(links.filter((link) => !briefUrls.has(link))),
	].slice(-MAX_USER_LINKS);

	if (missing.length === 0) {
		return brief;
	}

	return [
		brief.trimEnd(),
		"",
		"USER LINKS (URLs the user shared in this conversation — use the ones that belong on this page; ignore any that were only references):",
		...missing.map((link) => `- ${link}`),
	].join("\n");
}

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
			codMode,
			pageKind,
			productSku,
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

			// Snapshotted NOW so later prompt, model, or environment changes
			// never change what this attempt meant. The selected design-world bible
			// or server-sampled simple recipe rides inside the same snapshot — the
			// trigger task and build loop never need to know which path supplied it.
			const requestedWorldIds = worldIds ?? (worldId ? [worldId] : []);
			let resolvedWorlds = requestedWorldIds.flatMap((id) => {
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

			if (isCod && !productSku) {
				return {
					message:
						"Cannot queue this COD page yet: productSku is missing. Ask " +
						"the user for the merchant's exact product SKU first (or any " +
						"short internal product code they want on their orders), then " +
						"call generate_page again with that exact value. Never invent " +
						"or reformat it.",
					status: "needs-input",
				};
			}

			const artifact = await deps.pagesRepository.findOrCreateLandingArtifact(
				deps.projectId,
			);
			// The mode default is inference, not a coin flip: a max build always
			// rides on worlds (the Brain samples them), so a world-less COD call
			// means the simple flow — and historical calls with worlds keep meaning
			// what they meant.
			const resolvedCodMode = isCod
				? (codMode ?? (resolvedWorlds.length > 0 ? "max" : "simple"))
				: undefined;
			const isSimpleCod = resolvedCodMode === "simple";

			if (isSimpleCod && resolvedWorlds.length > 0) {
				logger.warn(
					`Simple COD build requested with ${resolvedWorlds.length} world${resolvedWorlds.length === 1 ? "" : "s"} — dropping world docs because the server-sampled recipe owns the skin.`,
				);
				resolvedWorlds = [];
			}

			const basePrompt = isCod
				? isSimpleCod
					? await buildSimpleCodSiteBuilderSystemPrompt()
					: await buildCodSiteBuilderSystemPrompt()
				: await buildSiteBuilderSystemPrompt();
			const designerSystemPrompt = isCod
				? isSimpleCod
					? [
							basePrompt,
							COD_GENRE_DOC,
							SIMPLE_COD_STYLE_DOC,
							sampleSimpleCodRecipe(),
						].join("\n\n")
					: [
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
					? // Product dossier docs stay bare — a bare world document is law.
						// Website worlds ride behind the departure-point heading so the
						// builder treats them as the brief's foundation, not a template.
						`${basePrompt}\n\n${
							resolvedWorlds[0].kind === "product"
								? resolvedWorlds[0].doc
								: `${WORLD_DEPARTURE_POINT_HEADING}\n\n${resolvedWorlds[0].doc}`
						}`
					: basePrompt;
			// COD funnels default to their own builder (cheap landing models
			// underperformed on conversion pages); an explicit composer pick
			// still wins for both kinds.
			const builderModel =
				deps.builderModel ??
				(isCod
					? (env.AI_PAGE_COD_BUILDER_MODEL ?? "openai/gpt-5.6-luna")
					: (env.AI_PAGE_BUILDER_MODEL ?? env.AI_PAGE_DESIGN_MODEL));
			const finalBrief = appendUserLinks(
				appendReadyMediaAssets(brief, deps.conversationAssets ?? []),
				deps.conversationUserLinks ?? [],
			);
			const attempt = await deps.pagesRepository.insertAttempt({
				artifactId: artifact.id,
				chatId: deps.chatId,
				model: builderModel,
				projectId: deps.projectId,
				spec: {
					brief: finalBrief,
					...(resolvedCodMode ? { codMode: resolvedCodMode } : {}),
					designerSystemPrompt,
					// Image models are snapshotted like the builder model: the
					// Trigger worker keeps its own env, and a stale deploy there
					// must never silently build with different image models than
					// the API server queued with.
					...(env.AI_IMAGE_EDIT_MODEL
						? { imageEditModel: env.AI_IMAGE_EDIT_MODEL }
						: {}),
					...(env.AI_IMAGE_MODEL ? { imageModel: env.AI_IMAGE_MODEL } : {}),
					pageKind: isCod ? "cod" : "website",
					...(productSku ? { productSku } : {}),
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
					(resolvedCodMode ? `, COD mode "${resolvedCodMode}"` : "") +
					(resolvedWorlds.length > 0
						? `, world${resolvedWorlds.length === 1 ? "" : "s"} "${resolvedWorlds.map((world) => world.id).join('", "')}"`
						: ", no world"),
			);
			// Log only a preview: the full brief is user business data and the
			// full spec is already persisted on the attempt row above.
			logger.log(
				`Brief for attempt ${attempt.id} (${finalBrief.length} chars, ` +
					`${(deps.conversationAssets ?? []).length} conversation assets): ` +
					`${finalBrief.slice(0, 200)}${finalBrief.length > 200 ? "…" : ""}`,
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
			const realtime = await mintRealtimeHandle(handle.id, (message) =>
				logger.warn(message),
			);

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
