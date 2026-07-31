/**
 * scrape_leads — the server-executed tool that queues a real lead scrape.
 *
 * Same architecture as generate_page: a FACTORY closed over the owned
 * project/chat ids. The tool does no scraping itself — it snapshots the
 * search spec into an attempt row, hands off to the Trigger.dev task, and
 * returns only the "queued"/"unavailable" answer the model relays. The chat
 * card polls the attempt endpoint for live progress and the download.
 */
import { Logger } from "@nestjs/common";
import { auth, tasks } from "@trigger.dev/sdk";
import {
	type ScrapeLeadsInput,
	type ScrapeLeadsOutput,
	scrapeLeadsInputSchema,
	scrapeLeadsOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: pulling the task VALUE here would drag the Trigger task
// (and its DB pool) into the Nest process. The type is enough to make
// tasks.trigger() check the payload shape.
import type { scrapeLeadsTask } from "../../../../trigger/scrape-leads.task";
import type { LeadScrapeSpec } from "../../../lead-scrapes/domain/lead-scrape-spec";
import type { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { isLeadSearchConfigured } from "../../../lead-scrapes/scraper/google-maps-search";

// Static Nest logger (no DI needed): queue-side events land in the API
// server terminal; the scrape itself logs in the Trigger worker terminal.
const logger = new Logger("scrape-leads");

const DEFAULT_LIMIT = 100;

export type ScrapeLeadsToolDeps = {
	chatId: string;
	leadScrapesRepository: LeadScrapesRepository;
	projectId: string;
	// ISO alpha-2 country from the request IP (trusted server-side context,
	// not model input), or null when the edge sent none.
	requestCountryCode: string | null;
};

// Explicit return type: composite-project declaration emit cannot name the
// SDK's inferred ExecutableTool type; the plain Tool shape is what callers need.
export function createScrapeLeadsTool(
	deps: ScrapeLeadsToolDeps,
): Tool<ScrapeLeadsInput, ScrapeLeadsOutput> {
	return tool({
		description:
			"Queue a real background scrape that finds local businesses " +
			"(name, phone, email when their website reveals one, website, " +
			"address) matching a niche + location, and exports them to an " +
			"Excel file the user downloads from the chat. Call it ONCE per " +
			"request; progress appears live in the conversation.",
		inputSchema: scrapeLeadsInputSchema,
		outputSchema: scrapeLeadsOutputSchema,
		execute: async ({
			country,
			limit,
			location,
			query,
		}): Promise<ScrapeLeadsOutput> => {
			// Checked at CALL time, not boot time: the server must run before
			// credentials exist, and the model must answer honestly when they don't.
			if (
				!isLeadSearchConfigured() ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Lead scraping isn't configured on this server yet (a Serper " +
						"API key plus Cloudflare R2 and Trigger.dev credentials are " +
						"required). Tell the user honestly that the feature will work " +
						"as soon as the credentials are added.",
					status: "unavailable",
				};
			}

			// Snapshotted NOW so later provider or environment changes never
			// change what this attempt meant. The model's country (it knows
			// "Alger" is Algeria) beats the IP header, which is only a default.
			const spec: LeadScrapeSpec = {
				countryCode:
					normalizeCountryCode(country ?? null) ??
					normalizeCountryCode(deps.requestCountryCode),
				limit: Math.min(200, Math.max(5, limit ?? DEFAULT_LIMIT)),
				location: location?.trim() || null,
				query: query.trim(),
				sources: ["google-maps"],
				version: 1,
			};

			const attempt = await deps.leadScrapesRepository.insertAttempt({
				chatId: deps.chatId,
				projectId: deps.projectId,
				spec,
			});

			logger.log(
				`Queued lead scrape "${spec.query}" in ${spec.location ?? spec.countryCode ?? "anywhere"} ` +
					`(limit ${spec.limit}) — attempt ${attempt.id}`,
			);

			let realtime: ScrapeLeadsOutput["realtime"];
			try {
				const handle = await tasks.trigger<typeof scrapeLeadsTask>(
					"scrape-leads",
					{ attemptId: attempt.id },
				);

				await deps.leadScrapesRepository.markAttemptTriggered(
					attempt.id,
					handle.id,
				);
				logger.log(
					`Trigger.dev accepted the scrape — run ${handle.id}. Follow the ` +
						"live logs in the worker terminal (npx trigger.dev@latest dev).",
				);
				realtime = await mintRealtimeHandle(handle.id);
			} catch (error) {
				logger.error(
					`Queueing attempt ${attempt.id} failed: ` +
						(error instanceof Error ? error.message : String(error)),
				);
				// Queueing failed (Trigger down, bad key…): close the attempt and
				// answer honestly — NEVER throw raw, the model needs something to
				// relay instead of an opaque tool error.
				await deps.leadScrapesRepository.markAttemptFailed(
					attempt.id,
					error instanceof Error ? error.message : String(error),
				);

				return {
					message:
						"Queueing the lead scrape failed on the server. Tell the user " +
						"and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			return {
				attemptId: attempt.id,
				message:
					"Queued: the lead scrape is running in the background. Progress " +
					"and the Excel download appear right here in the conversation — " +
					"usually a few minutes.",
				realtime,
				status: "queued",
			};
		},
	});
}

/**
 * Mint a read-scoped Realtime token so the chat card can subscribe to the
 * run instead of polling. Best-effort: on failure the card silently falls
 * back to polling, so the scrape must never fail because of this.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<ScrapeLeadsOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			// Long enough to outlive any scrape (maxDuration 1800s) plus a
			// same-session reload; expired tokens just mean polling fallback.
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the chat card ` +
				`will poll instead: ${error instanceof Error ? error.message : String(error)}`,
		);

		return undefined;
	}
}

export type ScrapeLeadsTool = ReturnType<typeof createScrapeLeadsTool>;

// Execute-less twin used ONLY for validateUIMessages in the controller:
// same schemas, zero side effects — validating history must never be able
// to queue a scrape.
export const scrapeLeadsToolSchemaOnly: Tool<
	ScrapeLeadsInput,
	ScrapeLeadsOutput
> = tool({
	inputSchema: scrapeLeadsInputSchema,
	outputSchema: scrapeLeadsOutputSchema,
});

function normalizeCountryCode(countryCode: string | null): string | null {
	const normalized = countryCode?.trim().toLowerCase() ?? "";

	return /^[a-z]{2}$/.test(normalized) ? normalized : null;
}
