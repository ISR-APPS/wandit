/**
 * Background lead scrape — runs on Trigger.dev, NOT inside the Nest app.
 *
 * The whole job in one sentence: read the attempt row the scrape_leads tool
 * queued, discover businesses on Google Maps, harvest + MX-verify contact
 * emails from their websites, export everything to a styled .xlsx in R2, and
 * flip the attempt to succeeded/failed so the chat card's polling sees it.
 *
 * Progress model: the row's stage/progress/foundCount columns ARE the UI —
 * the chat card polls the attempt endpoint, so every meaningful step writes
 * them (metadata.set mirrors the same values for the Trigger dashboard).
 *
 * No NestJS imports here on purpose: the Trigger CLI bundles this file on
 * its own; the Nest DI container does not exist in this process.
 */
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { and, createDb, eq, inArray } from "@wandit/db";
import { leadScrapeAttempts } from "@wandit/db/schema/lead-scrape-attempts";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";

import {
	contentTypeFor,
	leadScrapeFileKey,
	putSiteFile,
} from "../infrastructure/storage/r2";
import {
	ensureLeadScrapeUsageSettled,
	refundLeadScrapeUsageIfReserved,
	reserveLeadScrapeUsageForExecution,
	settleLeadScrapeUsage,
} from "../modules/lead-scrapes/application/services/lead-scrape-billing";
import {
	type LeadRecord,
	leadScrapeSpecSchema,
	toPreviewRows,
} from "../modules/lead-scrapes/domain/lead-scrape-spec";
import { discoverBusinessEmail } from "../modules/lead-scrapes/scraper/email-discovery";
import { verifyEmailsByMx } from "../modules/lead-scrapes/scraper/email-verify";
import { searchGoogleMapsBusinesses } from "../modules/lead-scrapes/scraper/google-maps-search";
import {
	buildLeadsWorkbook,
	leadsWorkbookFilename,
} from "../modules/lead-scrapes/scraper/xlsx-export";
import type { BillingAdmissionMode } from "../modules/metering/application/services/fixed-operation-billing";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import { createTriggerMetering } from "./metering.runtime";
import { recoverSettledLeadScrapeCompletion } from "./settled-completion-recovery";

// How many business websites are crawled at once for emails. Modest on
// purpose: these are other people's small servers.
const EMAIL_DISCOVERY_CONCURRENCY = 6;

type Stage = "searching" | "extracting" | "verifying" | "exporting";

export const scrapeLeadsTask = task({
	id: "scrape-leads",
	// A 200-record scrape is minutes of work (search pages + site crawls);
	// the ceiling is a safety net. The repository's stale-row self-heal
	// (38 min) must stay above the five-minute admission TTL plus this.
	maxDuration: 1800,
	retry: { maxAttempts: 1 },
	run: async (
		payload: {
			/**
			 * Acting member at queue time — may differ from the project creator in
			 * an org workspace. Optional for in-flight pre-teams payloads, which
			 * fall back to the project creator (correct for personal projects).
			 */
			actorUserId?: string;
			attemptId: string;
			billingMode?: BillingAdmissionMode;
			parentEventId?: string;
		},
		{ ctx, signal },
	) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb();

		try {
			const [loaded] = await db
				.select({
					attempt: leadScrapeAttempts,
					organizationId: projects.organizationId,
					userId: projects.userId,
				})
				.from(leadScrapeAttempts)
				.innerJoin(projects, eq(projects.id, leadScrapeAttempts.projectId))
				.where(eq(leadScrapeAttempts.id, payload.attemptId))
				.limit(1);

			if (!loaded) {
				throw new Error(`Lead scrape attempt ${payload.attemptId} not found`);
			}

			const { attempt, userId } = loaded;
			// The project's owner entity pays: org projects debit the org pool.
			// The ACTOR is the queue-time member (who reserved at the tool
			// boundary), not the project creator the durable row points at.
			const subject: MeteringSubject = {
				actorUserId: payload.actorUserId ?? userId,
				...(loaded.organizationId
					? { organizationId: loaded.organizationId }
					: {}),
			};
			const meteringService = createTriggerMetering(db);

			if (attempt.status === "succeeded") {
				await ensureLeadScrapeUsageSettled(meteringService, {
					attemptId: attempt.id,
					resultCount: attempt.rowCount ?? attempt.foundCount,
					subject,
				});

				logger.info(
					`Attempt ${attempt.id} already succeeded; duplicate task run skipped`,
				);

				return { rowCount: attempt.rowCount, skipped: true };
			}

			// Atomically claim queued work or an explicit retry of a failed
			// attempt — concurrent duplicate runs cannot both scrape.
			const [claim] = await db
				.update(leadScrapeAttempts)
				.set({
					completedAt: null,
					error: null,
					progress: 5,
					stage: "searching",
					startedAt: new Date(),
					status: "running",
					triggerRunId: ctx.run.id,
				})
				.where(
					and(
						eq(leadScrapeAttempts.id, attempt.id),
						inArray(leadScrapeAttempts.status, ["queued", "failed"]),
					),
				)
				.returning({ id: leadScrapeAttempts.id });

			if (!claim) {
				throw new Error(
					`Attempt ${attempt.id} is already being scraped by another run`,
				);
			}

			let usageEvent: AiUsageEvent | null = null;
			let meteringClosed = false;

			const setProgress = async (input: {
				stage?: Stage;
				progress: number;
				foundCount?: number;
			}) => {
				await db
					.update(leadScrapeAttempts)
					.set({
						progress: Math.round(input.progress),
						...(input.stage ? { stage: input.stage } : {}),
						...(input.foundCount !== undefined
							? { foundCount: input.foundCount }
							: {}),
					})
					.where(eq(leadScrapeAttempts.id, attempt.id));
				metadata.set("progress", Math.round(input.progress));

				if (input.foundCount !== undefined) {
					metadata.set("found", input.foundCount);
				}

				if (input.stage) {
					metadata.set("stage", input.stage);
				}
			};

			try {
				usageEvent = await reserveLeadScrapeUsageForExecution(meteringService, {
					attemptId: attempt.id,
					billingMode: payload.billingMode,
					parentEventId: payload.parentEventId,
					runtimeBillingDisabled: env.GENERATION_BILLING_MODE === "off",
					subject,
				});

				const spec = leadScrapeSpecSchema.parse(attempt.spec);

				logger.info(
					`🔎 Scrape starting — "${spec.query}" in ${spec.location ?? spec.countryCode ?? "anywhere"}, ` +
						`limit ${spec.limit}, attempt ${attempt.id}`,
				);

				// Stage 1 — discover businesses on Google Maps. Search fills
				// 5% → 45% proportionally to how much of the limit it found.
				const records = await searchGoogleMapsBusinesses({
					countryCode: spec.countryCode,
					limit: spec.limit,
					location: spec.location,
					onProgress: (found) =>
						setProgress({
							foundCount: found,
							progress: 5 + Math.min(40, (40 * found) / spec.limit),
						}),
					query: spec.query,
					signal,
				});

				logger.info(`📍 Google Maps returned ${records.length} businesses`);

				if (records.length === 0) {
					throw new Error(
						`No businesses found for "${spec.query}"` +
							(spec.location ? ` in ${spec.location}` : "") +
							" — try a broader niche or a bigger city",
					);
				}

				// Stage 2 — crawl each business's website for a contact email.
				signal.throwIfAborted();
				await setProgress({
					foundCount: records.length,
					progress: 45,
					stage: "extracting",
				});

				const withWebsites = records.filter((record) => record.website);
				let crawled = 0;

				await mapWithConcurrency(
					withWebsites,
					EMAIL_DISCOVERY_CONCURRENCY,
					async (record) => {
						if (signal.aborted) {
							return;
						}

						// biome-ignore lint/style/noNonNullAssertion: filtered on website above
						record.email = await discoverBusinessEmail(record.website!, signal);
						crawled += 1;

						// One DB write per handful of sites keeps the card lively
						// without hammering Postgres.
						if (crawled % 5 === 0 || crawled === withWebsites.length) {
							await setProgress({
								progress:
									45 +
									(withWebsites.length > 0
										? (27 * crawled) / withWebsites.length
										: 27),
							});
						}
					},
				);

				const emailsFound = records.filter((record) => record.email).length;

				logger.info(
					`✉️ Found emails for ${emailsFound}/${withWebsites.length} sites with websites`,
				);

				// Stage 3 — verify email domains (MX) + final de-duplication.
				signal.throwIfAborted();
				await setProgress({ progress: 75, stage: "verifying" });

				const verified = await verifyEmailsByMx(
					records.flatMap((record) => (record.email ? [record.email] : [])),
				);

				for (const record of records) {
					if (!record.email) {
						continue;
					}

					record.emailVerified = verified.get(record.email) ?? false;

					// A dead domain means the address is unusable for outreach —
					// drop it rather than exporting a bouncing contact.
					if (!record.emailVerified) {
						record.email = null;
					}
				}

				const finalRecords = dedupeRecords(records);

				// Contactable rows first: this is an outreach list, so leads
				// with a working email lead the sheet (and the card preview).
				finalRecords.sort(
					(a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)),
				);

				await setProgress({
					foundCount: finalRecords.length,
					progress: 88,
				});

				// Stage 4 — build the workbook and upload it BEFORE the terminal
				// DB write: a succeeded row must never point at a missing object.
				signal.throwIfAborted();
				await setProgress({ progress: 92, stage: "exporting" });

				const workbook = await buildLeadsWorkbook(finalRecords);
				const fileName = leadsWorkbookFilename(spec.query, spec.location);
				const r2Key = leadScrapeFileKey(
					attempt.projectId,
					attempt.id,
					fileName,
				);

				await putSiteFile(r2Key, workbook.bytes, contentTypeFor(fileName));
				logger.info(`☁️ Uploaded ${fileName} to R2 → ${r2Key}`);

				// A cancellation past this point may leave an orphaned object,
				// but it must never publish a cancelled attempt as succeeded.
				signal.throwIfAborted();

				if (usageEvent) {
					await settleLeadScrapeUsage(
						meteringService,
						usageEvent.id,
						workbook.rowCount,
					);
					meteringClosed = true;
				}

				const [completed] = await db
					.update(leadScrapeAttempts)
					.set({
						columnCount: workbook.columnCount,
						completedAt: new Date(),
						fileName,
						fileSize: workbook.bytes.byteLength,
						foundCount: finalRecords.length,
						previewRows: toPreviewRows(finalRecords),
						progress: 100,
						r2Key,
						rowCount: workbook.rowCount,
						status: "succeeded",
					})
					.where(
						and(
							eq(leadScrapeAttempts.id, attempt.id),
							eq(leadScrapeAttempts.status, "running"),
							eq(leadScrapeAttempts.triggerRunId, ctx.run.id),
						),
					)
					.returning({ id: leadScrapeAttempts.id });

				if (!completed) {
					const [current] = await db
						.select({
							rowCount: leadScrapeAttempts.rowCount,
							status: leadScrapeAttempts.status,
						})
						.from(leadScrapeAttempts)
						.where(eq(leadScrapeAttempts.id, attempt.id))
						.limit(1);
					const replay = recoverSettledLeadScrapeCompletion(
						attempt.id,
						current ?? null,
					);

					logger.warn(
						`Attempt ${attempt.id} was already finalized after billing settlement`,
					);
					return replay;
				}

				logger.info(
					`🎉 Lead list ready — ${workbook.rowCount} rows, ` +
						`${emailsFound} emails found, ${fileName}`,
				);

				// Returned for Trigger dashboard visibility only.
				return {
					emailsFound,
					fileName,
					rowCount: workbook.rowCount,
					skipped: false,
				};
			} catch (error) {
				if (usageEvent && !meteringClosed) {
					try {
						meteringClosed = await refundLeadScrapeUsageIfReserved(
							meteringService,
							{
								attemptId: attempt.id,
								eventId: usageEvent.id,
								subject,
							},
						);
					} catch (refundError) {
						logger.error(
							`Lead scrape refund failed: ${refundError instanceof Error ? refundError.message : String(refundError)}`,
						);
					}
				}

				logger.error(
					`❌ Scrape failed: ${error instanceof Error ? error.message : String(error)}`,
				);

				// Record the failure for the chat card, then rethrow so the run
				// also shows as failed in the Trigger dashboard.
				await db
					.update(leadScrapeAttempts)
					.set({
						completedAt: new Date(),
						error: error instanceof Error ? error.message : String(error),
						status: "failed",
					})
					.where(
						and(
							eq(leadScrapeAttempts.id, attempt.id),
							eq(leadScrapeAttempts.status, "running"),
							eq(leadScrapeAttempts.triggerRunId, ctx.run.id),
						),
					);

				throw error;
			}
		} finally {
			await db.$client.end();
		}
	},
});

// Small inline worker pool — enough concurrency control that a p-limit
// dependency is not warranted.
async function mapWithConcurrency<T>(
	items: readonly T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;

	const runners = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const item = items[nextIndex];

				nextIndex += 1;

				if (item !== undefined) {
					await worker(item);
				}
			}
		},
	);

	await Promise.all(runners);
}

/**
 * Search-stage dedupe works on Google place ids; this last pass catches the
 * remaining real-world duplicates — the same business listed twice with the
 * same phone number or the same verified email.
 */
function dedupeRecords(records: readonly LeadRecord[]): LeadRecord[] {
	const seenPhones = new Set<string>();
	const seenEmails = new Set<string>();
	const result: LeadRecord[] = [];

	for (const record of records) {
		const phoneKey = record.phone?.replace(/\D/g, "") ?? "";
		const emailKey = record.email ?? "";

		if (phoneKey.length > 5 && seenPhones.has(phoneKey)) {
			continue;
		}

		if (emailKey && seenEmails.has(emailKey)) {
			continue;
		}

		if (phoneKey.length > 5) {
			seenPhones.add(phoneKey);
		}

		if (emailKey) {
			seenEmails.add(emailKey);
		}

		result.push(record);
	}

	return result;
}
