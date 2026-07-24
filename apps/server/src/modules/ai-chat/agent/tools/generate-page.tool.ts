/**
 * generate_page — the server-executed tool that queues a real page build.
 *
 * Unlike ask_user (no execute), this tool is a FACTORY: it must know which
 * project/chat it acts for, so the
 * agent builds a fresh instance per request with those ids closed over.
 *
 * The tool itself does no design work. It snapshots the content brief, both
 * Art Director stage prompts, the Art Director model, and the Builder
 * prompt/model into an attempt row and hands off to the Trigger.dev task; its
 * return value is only the
 * "queued"/"unavailable" answer the model relays.
 */
import { Logger } from "@nestjs/common";
import { tasks } from "@trigger.dev/sdk";
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
import {
	buildArtDirectorExtractionSystemPrompt,
	buildArtDirectorSystemPrompt,
} from "../art-director/art-director-prompt";
import { buildSiteBuilderSystemPrompt } from "../site-builder/builder-prompt";

// Static Nest logger (no DI needed): queue-side events land in the API
// server terminal; the build itself logs in the Trigger worker terminal.
const logger = new Logger("generate-page");

export type GeneratePageToolDeps = {
	chatId: string;
	pagesRepository: PagesRepository;
	projectId: string;
};

// Explicit return type: composite-project declaration emit cannot name the
// SDK's inferred ExecutableTool type; the plain Tool shape is what callers need.
export function createGeneratePageTool(
	deps: GeneratePageToolDeps,
): Tool<GeneratePageInput, GeneratePageOutput> {
	return tool({
		description:
			"Queue the real landing-page build for this project. Call it ONCE, " +
			"after the factual content brief is complete. Do not choose the visual " +
			"direction yourself: the queued Art Director does that before the " +
			"Builder runs. The finished page appears in the user's Page tab.",
		inputSchema: generatePageInputSchema,
		outputSchema: generatePageOutputSchema,
		execute: async ({ brief, title }): Promise<GeneratePageOutput> => {
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
			// never change what this attempt meant.
			const artDirectorExtractionSystemPrompt =
				buildArtDirectorExtractionSystemPrompt();
			const artDirectorSystemPrompt = buildArtDirectorSystemPrompt();
			const designerSystemPrompt = await buildSiteBuilderSystemPrompt();
			const builderModel =
				env.AI_PAGE_BUILDER_MODEL ?? env.AI_PAGE_DESIGN_MODEL;
			const attemptSpec = {
				artDirectorExtractionSystemPrompt,
				artDirectorModel: env.AI_ART_DIRECTOR_MODEL,
				artDirectorSystemPrompt,
				brief,
				designerSystemPrompt,
				title,
				version: 2 as const,
			};
			const attempt = await deps.pagesRepository.insertAttempt({
				artifactId: artifact.id,
				chatId: deps.chatId,
				model: builderModel,
				projectId: deps.projectId,
				spec: attemptSpec,
			});

			logger.log(
				`Queued page build "${title}" — attempt ${attempt.id}, ` +
					`Art Director ${env.AI_ART_DIRECTOR_MODEL}, Builder ${builderModel}`,
			);
			logger.log(`Content brief for attempt ${attempt.id}:\n${brief}`);

			try {
				const handle = await tasks.trigger<typeof generatePageTask>(
					"generate-page",
					{ attemptId: attempt.id },
				);

				await deps.pagesRepository.markAttemptTriggered(attempt.id, handle.id);
				logger.log(
					`Trigger.dev accepted the build — run ${handle.id}. Follow the ` +
						"live logs in the worker terminal (npx trigger.dev@latest dev).",
				);
			} catch (error) {
				logger.error(
					`Queueing attempt ${attempt.id} failed: ` +
						(error instanceof Error ? error.message : String(error)),
				);
				// Queueing failed (Trigger down, bad key…): close the attempt and
				// answer honestly — NEVER throw raw, the model needs something to
				// relay instead of an opaque tool error.
				await deps.pagesRepository.markAttemptFailed(
					attempt.id,
					error instanceof Error ? error.message : String(error),
				);

				return {
					message:
						"Queueing the page build failed on the server. The brief is " +
						"safe in this conversation — tell the user and offer to retry " +
						"in a moment.",
					status: "unavailable",
				};
			}

			// Advisory number for the human-facing message; the task assigns
			// the real one inside its transaction.
			const versionNumber = await deps.pagesRepository.nextVersionNumber(
				artifact.id,
			);

			return {
				attemptId: attempt.id,
				message:
					`Queued: version ${versionNumber} is being generated in the ` +
					"background. It will appear in the Page tab when ready — " +
					"usually a few minutes.",
				status: "queued",
				versionNumber,
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
