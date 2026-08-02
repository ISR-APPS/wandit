/**
 * scrape_leads — the server-executed tool that queues a real lead scrape.
 *
 * Same architecture as generate_page: a FACTORY closed over the owned
 * project/chat ids. The tool does no scraping itself — it snapshots the
 * search spec into an attempt row, hands off to the Trigger.dev task, and
 * returns only the "queued"/"unavailable" answer the model relays. The chat
 * card polls the attempt endpoint for live progress and the download.
 */
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
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
import {
	refundLeadScrapeUsageIfReserved,
	reserveLeadScrapeUsage,
} from "../../../lead-scrapes/application/services/lead-scrape-billing";
import type { LeadScrapeSpec } from "../../../lead-scrapes/domain/lead-scrape-spec";
import type { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { isLeadSearchConfigured } from "../../../lead-scrapes/scraper/google-maps-search";
import type { BillingAdmissionMode } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";

// Static Nest logger (no DI needed): queue-side events land in the API
// server terminal; the scrape itself logs in the Trigger worker terminal.
const logger = new Logger("scrape-leads");

const DEFAULT_LIMIT = 100;
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type ScrapeLeadsToolDeps = {
	chatId: string;
	leadScrapesRepository: LeadScrapesRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	// ISO alpha-2 country from the request IP (trusted server-side context,
	// not model input), or null when the edge sent none.
	requestCountryCode: string | null;
	userId: string;
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
			let usageEvent: AiUsageEvent | null = null;
			const billingMode: BillingAdmissionMode =
				env.GENERATION_BILLING_MODE === "off" ? "off" : "enforce";

			// The hold belongs at the chat-tool boundary: an insufficient balance must
			// escape tool execution as the typed mid-stream 402 before the model can
			// tell the user that work was queued. The Trigger task replays this exact
			// fingerprint before touching an external provider.
			if (billingMode === "enforce") {
				try {
					usageEvent = await reserveLeadScrapeUsage(deps.meteringService, {
						attemptId: attempt.id,
						parentEventId: deps.parentEventId,
						userId: deps.userId,
					});
				} catch (error) {
					try {
						await deps.leadScrapesRepository.markAttemptFailed(
							attempt.id,
							"The lead scrape could not reserve its required credits.",
						);
					} catch (markError) {
						logger.error(
							`Closing unreserved lead scrape ${attempt.id} failed`,
							markError instanceof Error ? markError.stack : String(markError),
						);
					}

					throw error;
				}
			}

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerScrapeLeadsTask({
					attemptId: attempt.id,
					billingMode,
					...(deps.parentEventId ? { parentEventId: deps.parentEventId } : {}),
					projectId: deps.projectId,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				logger.error(
					`Trigger.dev did not confirm lead scrape ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed = await deps.leadScrapesRepository.markAttemptFailed(
							attempt.id,
							"The background scraper rejected this request. Please try again.",
						);

						if (closed) {
							if (usageEvent) {
								try {
									await refundLeadScrapeUsageIfReserved(deps.meteringService, {
										attemptId: attempt.id,
										eventId: usageEvent.id,
										userId: deps.userId,
									});
								} catch (refundError) {
									// The event remains reserved and the metering sweep is the
									// durable backstop. Do not misreport the already-closed row.
									logger.error(
										`Refunding rejected lead scrape ${attempt.id} failed`,
										refundError instanceof Error
											? refundError.stack
											: String(refundError),
									);
								}
							}

							return {
								message:
									"Trigger.dev rejected the lead scrape. Tell the user it " +
									"was not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected lead scrape ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// A timeout or lost response can happen after Trigger.dev accepted
				// the task. Preserve the queued row; the global attempt key makes a
				// subsequent handoff safe and the task claim prevents duplicate work.
				return {
					attemptId: attempt.id,
					message:
						"The lead scrape is saved, but Trigger.dev did not confirm " +
						"the handoff yet. Its card will keep checking, and the same " +
						"request can be retried safely.",
					status: "queued",
				};
			}

			// Queue acceptance is authoritative. Persisting the diagnostic run id
			// is best-effort because the task may already have claimed the row and
			// written its own run id before this request resumes.
			try {
				await deps.leadScrapesRepository.markAttemptTriggered(
					attempt.id,
					handle.id,
				);
			} catch (error) {
				logger.warn(
					`Could not persist Trigger.dev run id for lead scrape ${attempt.id}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			logger.log(
				`Trigger.dev accepted the scrape — run ${handle.id}. Follow the ` +
					"live logs in the worker terminal (npx trigger.dev@latest dev).",
			);
			const realtime = await mintRealtimeHandle(handle.id);

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

async function triggerScrapeLeadsTask(payload: {
	attemptId: string;
	billingMode: BillingAdmissionMode;
	parentEventId?: string;
	projectId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`lead-scrape:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof scrapeLeadsTask>(
				"scrape-leads",
				{
					attemptId: payload.attemptId,
					billingMode: payload.billingMode,
					...(payload.parentEventId
						? { parentEventId: payload.parentEventId }
						: {}),
				},
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`lead-scrape-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					// Reservation recovery starts at 40 minutes. Starting within five
					// minutes leaves the full 30-minute task ceiling plus settlement
					// grace without ever making a live hold look stranded.
					ttl: "5m",
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
