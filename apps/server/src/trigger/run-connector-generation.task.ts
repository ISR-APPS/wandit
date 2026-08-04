/**
 * Background connector generation — runs on Trigger.dev, NOT inside Nest.
 *
 * The whole job in one sentence: read the attempt row the chat agent's
 * generation intercept queued, replay the exact MCP tool call (e.g.
 * Higgsfield generate_video) with the user's own OAuth token, wait for the
 * provider — minutes, far past the API process's 5-minute undici ceiling —
 * extract the media URLs from the result, and settle the row. The chat card
 * follows this run over Trigger Realtime and reads the row when it settles.
 *
 * No NestJS imports of the framework runtime here on purpose: the Trigger
 * CLI bundles this file on its own; the Nest DI container does not exist in
 * this process. The mcp-connectors classes are constructed by hand — their
 * decorators are inert metadata outside Nest.
 */
// MUST be first: raises undici's 5-minute idle timeouts to an hour so the
// long silent generate call is not killed mid-flight.
import "./undici-timeouts";

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { and, createDb, eq, inArray } from "@wandit/db";
import { connectorGenerationAttempts } from "@wandit/db/schema/connector-generation-attempts";

import {
	captureGenerationCompleted,
	captureGenerationFailed,
	machineFailureReason,
} from "../infrastructure/analytics/generation-events";
import { extractMediaUrls } from "../modules/connector-generations/domain/extract-media-urls";
import {
	type ConnectorGenerationReservations,
	captureConnectorGenerationResult,
	createConnectorGenerationBilling,
	finalizeConnectorGenerationBilling,
	hasTerminalConnectorGenerationReplay,
} from "../modules/mcp-connectors/application/services/connector-generation-billing";
import { McpConnectionsService } from "../modules/mcp-connectors/application/services/mcp-connections.service";
import { connectorGatewayCaptures } from "../modules/mcp-connectors/domain/connector-generation-metering";
import { McpDcrClient } from "../modules/mcp-connectors/infrastructure/oauth/mcp-dcr.client";
import { McpConnectionsRepository } from "../modules/mcp-connectors/infrastructure/persistence/mcp-connections.repository";
import { McpConnectorsRepository } from "../modules/mcp-connectors/infrastructure/persistence/mcp-connectors.repository";
import { triggerAnalytics } from "./init";
import { createTriggerMetering } from "./metering.runtime";
import { recoverSettledConnectorCompletion } from "./settled-completion-recovery";

export type RunConnectorGenerationPayload = {
	attemptId: string;
	billing: ConnectorGenerationReservations;
	billingMode: "enforce" | "off";
};

export const runConnectorGenerationTask = task({
	id: "run-connector-generation",
	// Provider-side generation is minutes; the ceiling is a safety net. The
	// repository's stale-row self-heal (35 min) must stay ABOVE this.
	maxDuration: 1800,
	retry: { maxAttempts: 1 },
	run: async (payload: RunConnectorGenerationPayload, { ctx, signal }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb();
		let client: MCPClient | undefined;
		// Only the run that WON the claim may settle the row on error — a
		// duplicate run losing the race must not fail the live attempt.
		let claimed = false;
		let claimedAttempt: { organizationId: string | null; userId: string } | undefined;
		let providerCompleted = false;
		let completionCheckpointed = false;
		const generationBilling = createConnectorGenerationBilling({
			// Reservations were created by the API before this task was enqueued.
			// Their null/non-null event ids preserve that queue-time billing mode.
			isBillingDisabled: () => true,
			meteringService: createTriggerMetering(db),
		});

		try {
			const [attempt] = await db
				.select()
				.from(connectorGenerationAttempts)
				.where(eq(connectorGenerationAttempts.id, payload.attemptId))
				.limit(1);

			if (!attempt) {
				throw new Error(
					`Connector generation attempt ${payload.attemptId} not found`,
				);
			}

			if (attempt.status === "succeeded") {
				logger.info(
					`Attempt ${attempt.id} already succeeded; duplicate run skipped`,
				);

				return { skipped: true };
			}

			if (attempt.status === "failed") {
				logger.info(
					`Attempt ${attempt.id} already failed; refunded attempt cannot be replayed`,
				);
				return { skipped: true };
			}

			// Atomically claim queued work — concurrent duplicate runs cannot
			// both call the provider (a generation costs the user credits).
			const [claim] = await db
				.update(connectorGenerationAttempts)
				.set({
					completedAt: null,
					error: null,
					status: "running",
					triggerRunId: ctx.run.id,
				})
				.where(
					and(
						eq(connectorGenerationAttempts.id, attempt.id),
						eq(connectorGenerationAttempts.status, "queued"),
					),
				)
				.returning({ id: connectorGenerationAttempts.id });

			if (!claim) {
				throw new Error(
					`Attempt ${attempt.id} is already being run by another task`,
				);
			}
			claimed = true;
			claimedAttempt = {
				organizationId: attempt.organizationId,
				userId: attempt.userId,
			};
			// A terminal replay proves provider work already completed in an older
			// delivery. Reject the payload below, but never refund that prior work.
			providerCompleted = hasTerminalConnectorGenerationReplay(payload.billing);
			assertBillingPayload(payload.billing, payload.billingMode, attempt.id);

			metadata.set("stage", "generating");

			// Hand-wired mcp-connectors services (no Nest DI in this process).
			const connectorsRepository = new McpConnectorsRepository(db);
			const connectionsService = new McpConnectionsService(
				connectorsRepository,
				new McpConnectionsRepository(db),
				new McpDcrClient(),
			);

			const connector = await connectorsRepository.findEnabledBySlug(
				attempt.connectorSlug,
			);
			if (!connector?.mcpServerUrl) {
				throw new Error(
					`Connector ${attempt.connectorSlug} is not available on this server`,
				);
			}

			const accessToken = await connectionsService.getValidAccessToken(
				attempt.userId,
				attempt.connectorSlug,
			);

			// Fresh session per run — the API's in-memory session cache does not
			// exist here, and one cold handshake per generation is fine.
			client = await createMCPClient({
				transport: {
					headers: { Authorization: `Bearer ${accessToken}` },
					terminateSessionOnClose: false,
					type: "http",
					url: connector.mcpServerUrl,
				},
			});

			logger.info(
				`Calling ${attempt.connectorSlug}/${attempt.toolName} for attempt ${attempt.id}`,
			);

			// The blocking provider call — the whole reason this runs here.
			const result = await client.callTool({
				arguments: (attempt.args ?? {}) as Record<string, unknown>,
				name: attempt.toolName,
				options: { signal },
			});
			providerCompleted =
				(await captureConnectorGenerationResult(
					generationBilling,
					payload.billing,
					result,
				)) || providerCompleted;

			// MCP reports tool failures as a RESULT with isError, not a thrown
			// error — settling that as "succeeded" would show a dead card.
			if (isMcpToolError(result)) {
				throw new Error(
					mcpErrorText(result) ??
						`${attempt.connectorSlug}/${attempt.toolName} returned an MCP tool error`,
				);
			}

			const providerResults: unknown[] = [result];
			let media = extractMediaUrls(result);

			// Higgsfield's generate tools are SUBMIT-style: they return a job
			// receipt in ~1s while the provider renders for minutes — and that
			// receipt can embed catalog demo media that is NOT the render. So
			// whenever the receipt exposes a followable job id, the job's own
			// final payload is the only trusted media source; the immediate
			// result only counts for genuinely synchronous tools (nothing to
			// follow). Status checks stay server-side in this background run;
			// the browser stays push-only via Realtime.
			try {
				logger.info(
					`Following the provider job behind ${attempt.toolName} (immediate media: ${media.length})`,
					{ result: safeJsonPreview(result) },
				);

				const followed = await followProviderJob(
					client,
					result,
					signal,
					async (providerResult) => {
						providerCompleted =
							(await captureConnectorGenerationResult(
								generationBilling,
								payload.billing,
								providerResult,
							)) || providerCompleted;
					},
				);
				if (followed) {
					providerResults.push(followed);
					const followedMedia = extractMediaUrls(followed);
					media = followedMedia.length > 0 ? followedMedia : [];
				}
			} catch (error) {
				// A definitive provider outcome (job failed/nsfw, follow timed
				// out) or a cancellation must fail the run even when the receipt
				// carried media — that media is echo/garnish, not the render.
				if (
					media.length === 0 ||
					error instanceof ProviderJobFailedError ||
					signal.aborted
				) {
					throw error;
				}
				// Infrastructure-style follow error (listTools hiccup, transient
				// status failure) on a receipt that DID have media: fall back to
				// what the tool itself returned.
				logger.warn(
					`Following the provider job failed; keeping the immediate result media: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			providerCompleted = true;
			metadata.set("stage", "settling");

			// Reuse the existing media column as a provider-completion checkpoint.
			// The status remains running, so the card cannot publish these URLs until
			// billing settles. API/worker recovery can finish this exact output after
			// a process crash without invoking the provider again.
			const [checkpoint] = await db
				.update(connectorGenerationAttempts)
				.set({ media })
				.where(
					and(
						eq(connectorGenerationAttempts.id, attempt.id),
						eq(connectorGenerationAttempts.status, "running"),
						eq(connectorGenerationAttempts.triggerRunId, ctx.run.id),
					),
				)
				.returning({ id: connectorGenerationAttempts.id });

			if (!checkpoint) {
				throw new Error(
					`Connector attempt ${attempt.id} lost its completion checkpoint transition`,
				);
			}
			completionCheckpointed = true;

			await finalizeConnectorGenerationBilling(
				generationBilling,
				payload.billing,
				connectorGatewayCaptures(providerResults),
				{
					childUnits: deliveredConnectorChildUnits(
						payload.billing,
						media.length,
					),
				},
			);

			const [completed] = await db
				.update(connectorGenerationAttempts)
				.set({
					completedAt: new Date(),
					media,
					status: "succeeded",
				})
				.where(
					and(
						eq(connectorGenerationAttempts.id, attempt.id),
						eq(connectorGenerationAttempts.status, "running"),
						eq(connectorGenerationAttempts.triggerRunId, ctx.run.id),
					),
				)
				.returning({ id: connectorGenerationAttempts.id });

			if (!completed) {
				const [current] = await db
					.select({
						media: connectorGenerationAttempts.media,
						status: connectorGenerationAttempts.status,
					})
					.from(connectorGenerationAttempts)
					.where(eq(connectorGenerationAttempts.id, attempt.id))
					.limit(1);
				const replay = recoverSettledConnectorCompletion(
					attempt.id,
					current ?? null,
				);

				logger.warn(
					`Attempt ${attempt.id} was already finalized after billing settlement`,
				);
				return replay;
			}

			captureGenerationCompleted(
				triggerAnalytics,
				attempt.userId,
				"connector",
				null,
				completed.id,
			);
			metadata.set("stage", "done");

			logger.info(
				`Attempt ${attempt.id} succeeded with ${media.length} media URL(s)`,
			);

			return { mediaCount: media.length };
		} catch (error) {
			if (claimed) {
				const message = error instanceof Error ? error.message : String(error);
				let durableCheckpoint = completionCheckpointed;

				if (!durableCheckpoint) {
					try {
						durableCheckpoint = await hasCompletionCheckpoint(
							db,
							payload.attemptId,
						);
					} catch (checkpointError) {
						logger.error(
							`Connector completion checkpoint lookup failed for ${payload.attemptId}`,
							{ error: checkpointError },
						);
					}
				}

				if (durableCheckpoint) {
					// Keep the row running: the metering sweep or the next card poll
					// replays settlement from the checkpoint and publishes it.
					logger.error(
						`Connector attempt ${payload.attemptId} failed after its completion checkpoint; recovery will finish it`,
						{ error },
					);
					throw error;
				}

				const [failed] = await db
					.update(connectorGenerationAttempts)
					.set({
						completedAt: new Date(),
						error: message,
						status: "failed",
					})
					.where(
						and(
							eq(connectorGenerationAttempts.id, payload.attemptId),
							eq(connectorGenerationAttempts.triggerRunId, ctx.run.id),
							inArray(connectorGenerationAttempts.status, [
								"queued",
								"running",
							]),
						),
					)
					.returning({ id: connectorGenerationAttempts.id });

				if (failed && claimedAttempt) {
					captureGenerationFailed(
						triggerAnalytics,
						claimedAttempt.userId,
						"connector",
						null,
						failed.id,
						machineFailureReason(error),
					);
				}

				if (!providerCompleted && claimedAttempt) {
					try {
						await generationBilling.refund(
							{
								actorUserId: claimedAttempt.userId,
								...(claimedAttempt.organizationId
									? { organizationId: claimedAttempt.organizationId }
									: {}),
							},
							payload.attemptId,
							payload.billing.child?.operation,
						);
					} catch (refundError) {
						logger.error(
							`Connector metering refund failed for attempt ${payload.attemptId}`,
							{ error: refundError },
						);
					}
				}
			}

			throw error;
		} finally {
			await client?.close().catch(() => undefined);
			await db.$client.end();
		}
	},
});

async function hasCompletionCheckpoint(
	db: ReturnType<typeof createDb>,
	attemptId: string,
): Promise<boolean> {
	const [attempt] = await db
		.select({
			media: connectorGenerationAttempts.media,
			status: connectorGenerationAttempts.status,
		})
		.from(connectorGenerationAttempts)
		.where(eq(connectorGenerationAttempts.id, attemptId))
		.limit(1);

	return (
		attempt?.media !== null &&
		(attempt?.status === "running" || attempt?.status === "succeeded")
	);
}

function deliveredConnectorChildUnits(
	billing: ConnectorGenerationReservations,
	mediaCount: number,
): number | undefined {
	if (!billing.child) {
		return undefined;
	}

	if (billing.child.operation === "video") {
		return 1;
	}

	return Math.min(billing.child.units, mediaCount);
}

function assertBillingPayload(
	billing: ConnectorGenerationReservations,
	billingMode: "enforce" | "off",
	attemptId: string,
): void {
	if (hasTerminalConnectorGenerationReplay(billing)) {
		throw new Error(
			`Connector billing for attempt ${attemptId} is already terminal`,
		);
	}

	if (
		billing.connector.operation !== "connector" ||
		billing.connector.referenceId !== attemptId ||
		billing.connector.units !== 1
	) {
		throw new Error(
			`Invalid connector billing payload for attempt ${attemptId}`,
		);
	}

	if (
		billing.child &&
		(billing.child.referenceId !== attemptId ||
			!(["image", "video"] as const).includes(billing.child.operation))
	) {
		throw new Error(`Invalid connector child billing for attempt ${attemptId}`);
	}

	if (
		billing.connector.eventId === null &&
		billing.child?.eventId !== null &&
		billing.child?.eventId !== undefined
	) {
		throw new Error(
			`Connector child billing cannot outlive its parent for attempt ${attemptId}`,
		);
	}

	if (
		billingMode === "enforce" &&
		(billing.connector.eventId === null || billing.child?.eventId === null)
	) {
		throw new Error(
			`Enforced connector billing is missing an event for attempt ${attemptId}`,
		);
	}

	if (
		billingMode === "off" &&
		(billing.connector.eventId !== null ||
			(billing.child !== undefined && billing.child.eventId !== null))
	) {
		throw new Error(
			`Billing-off connector attempt ${attemptId} unexpectedly has a hold`,
		);
	}
}

// How the provider job is followed. The status checks live INSIDE this
// background task — the chat stream, the model, and the browser never poll.
const STATUS_TOOL_NAME = "job_status";
const FOLLOW_POLL_INTERVAL_MS = 5_000;
// Below maxDuration (1800s) so a stuck provider fails THIS way, with a
// readable error, instead of via the duration kill.
const FOLLOW_DEADLINE_MS = 25 * 60 * 1000;
const ID_KEY_PATTERN =
	/(^|_)(job_set|jobset|job|generation|request|task)?_?ids?$/i;
const FAILED_STATE_PATTERN = /fail|error|cancel|nsfw|moderat/i;
const SETTLED_STATE_PATTERN = /complete|success|done|finish/i;
const IN_FLIGHT_STATE_PATTERN =
	/queue|pend|process|progress|run|generat|render|wait|start/i;
// A job set can read "completed" while a sibling item (the actual video) is
// still rendering, or before the media URL propagates into the payload —
// keep polling for this long after every state looks settled but no media
// has appeared, then settle honestly.
const SETTLE_GRACE_MS = 90_000;

/** The provider itself decided the job's fate (failed/moderated/timed out)
    — never masked by receipt-media fallbacks, unlike transient follow
    errors. */
class ProviderJobFailedError extends Error {}

/**
 * Follow a submit-style generation to completion via the connector's own
 * status tool. Heuristic by necessity (each provider names its ids freely):
 * id-looking strings from the submit receipt are matched against the status
 * tool's input schema properties. Returns the final status result, or null
 * when the receipt exposes nothing to follow (caller settles with whatever
 * the immediate result contained).
 */
async function followProviderJob(
	client: MCPClient,
	submitResult: unknown,
	signal: AbortSignal,
	onResult: (result: unknown) => Promise<void>,
): Promise<unknown | null> {
	const ids = collectIdCandidates(submitResult);
	if (ids.size === 0) return null;

	const definitions = await client.listTools();
	const statusTool = definitions.tools.find(
		(tool) => tool.name === STATUS_TOOL_NAME,
	);
	if (!statusTool) return null;

	const schemaProperties = Object.keys(
		(statusTool.inputSchema as { properties?: Record<string, unknown> })
			?.properties ?? {},
	);
	const argumentsValue: Record<string, unknown> = {};

	for (const property of schemaProperties) {
		const match = ids.get(property.toLowerCase());
		if (match !== undefined) argumentsValue[property] = match;
	}

	if (Object.keys(argumentsValue).length === 0) {
		// No exact key match: pair the first id with the first id-shaped prop.
		const fallbackProperty = schemaProperties.find((property) =>
			/ids?$/i.test(property),
		);
		const firstId = [...ids.values()][0];
		if (!fallbackProperty || firstId === undefined) return null;
		argumentsValue[fallbackProperty] = firstId;
	}

	logger.info(`Following provider job via ${STATUS_TOOL_NAME}`, {
		arguments: argumentsValue,
	});

	const deadline = Date.now() + FOLLOW_DEADLINE_MS;
	let settledSince: number | null = null;
	let lastSettledStatus: unknown = null;

	while (Date.now() < deadline) {
		await sleepMs(FOLLOW_POLL_INTERVAL_MS, signal);

		const status = await client.callTool({
			arguments: argumentsValue,
			name: STATUS_TOOL_NAME,
			options: { signal },
		});
		await onResult(status);

		if (isMcpToolError(status)) {
			throw new ProviderJobFailedError(
				mcpErrorText(status) ?? "The provider reported a job error",
			);
		}

		// A payload can carry SEVERAL states at once (a job set lists every
		// item) — deciding on the first one settles while a sibling item, the
		// actual video, is still rendering.
		const states = findStateStrings(status);
		const displayState =
			states.find((state) => IN_FLIGHT_STATE_PATTERN.test(state)) ?? states[0];
		if (displayState) metadata.set("stage", displayState);

		const media = extractMediaUrls(status);
		if (media.length > 0) return status;

		const anyInFlight = states.some((state) =>
			IN_FLIGHT_STATE_PATTERN.test(state),
		);

		// One failed auxiliary item must not sink a set whose main item is
		// still rendering — failure is terminal only once nothing is
		// in-flight (the media check above already caught partial successes).
		const failedState = states.find((state) =>
			FAILED_STATE_PATTERN.test(state),
		);
		if (failedState && !anyInFlight) {
			throw new ProviderJobFailedError(
				mcpErrorText(status) ?? `The provider job ended as "${failedState}"`,
			);
		}

		const allSettled =
			states.length > 0 &&
			!anyInFlight &&
			states.every((state) => SETTLED_STATE_PATTERN.test(state));

		// Every state reads settled but no media URL we recognize yet — grace
		// period first (URLs propagate late), then return what we have so the
		// caller honestly reports no preview.
		if (allSettled) {
			settledSince ??= Date.now();
			lastSettledStatus = status;
			if (Date.now() - settledSince >= SETTLE_GRACE_MS) return status;
		} else {
			settledSince = null;
			lastSettledStatus = null;
		}
	}

	// The deadline can expire mid-grace: a job that settled in the window's
	// final seconds is still a settled job, not a timeout.
	if (lastSettledStatus !== null) return lastSettledStatus;

	throw new ProviderJobFailedError(
		"Timed out waiting for the provider to finish generating",
	);
}

// MCP results usually carry the provider payload as JSON *stringified*
// inside content[].text — walkers must parse those strings to see the ids
// and states inside.
function tryParseJson(value: string): unknown | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

/** id-looking string values keyed by their lowercased property name. */
function collectIdCandidates(
	value: unknown,
	found = new Map<string, string>(),
	seen = new WeakSet<object>(),
): Map<string, string> {
	if (typeof value === "string") {
		return collectIdCandidates(tryParseJson(value), found, seen);
	}
	if (value === null || typeof value !== "object") return found;
	if (seen.has(value)) return found;
	seen.add(value);

	if (Array.isArray(value)) {
		for (const item of value) collectIdCandidates(item, found, seen);
		return found;
	}

	for (const [key, nested] of Object.entries(value)) {
		if (typeof nested === "string" && ID_KEY_PATTERN.test(key)) {
			if (!found.has(key.toLowerCase())) found.set(key.toLowerCase(), nested);
		} else {
			collectIdCandidates(nested, found, seen);
		}
	}

	return found;
}

/** Every status/state-named string anywhere in the result, in walk order. */
function findStateStrings(
	value: unknown,
	found: string[] = [],
	seen = new WeakSet<object>(),
): string[] {
	if (typeof value === "string") {
		return findStateStrings(tryParseJson(value), found, seen);
	}
	if (value === null || typeof value !== "object") return found;
	if (seen.has(value)) return found;
	seen.add(value);

	if (Array.isArray(value)) {
		for (const item of value) findStateStrings(item, found, seen);
		return found;
	}

	for (const [key, nested] of Object.entries(value)) {
		if (/^(status|state)$/i.test(key) && typeof nested === "string") {
			found.push(nested);
		} else {
			findStateStrings(nested, found, seen);
		}
	}

	return found;
}

function sleepMs(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(new Error("Aborted"));
			return;
		}
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new Error("Aborted"));
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

function safeJsonPreview(value: unknown): string {
	try {
		return JSON.stringify(value).slice(0, 2_000);
	} catch {
		return String(value).slice(0, 2_000);
	}
}

function isMcpToolError(result: unknown): boolean {
	return (
		result !== null &&
		typeof result === "object" &&
		(result as { isError?: unknown }).isError === true
	);
}

function mcpErrorText(result: unknown): string | null {
	const content = (result as { content?: unknown }).content;
	if (!Array.isArray(content)) return null;

	const text = content
		.filter(
			(item): item is { text: string; type: string } =>
				item !== null &&
				typeof item === "object" &&
				(item as { type?: unknown }).type === "text" &&
				typeof (item as { text?: unknown }).text === "string",
		)
		.map((item) => item.text)
		.join("\n")
		.trim();

	return text.length > 0 ? text : null;
}
