/**
 * Device-minutes runtime (WANDIT-196): bills the ended Appetize device
 * sessions. `device-minutes.task.ts` calls it every 5 minutes through
 * `createDeviceMinutesRuntime`; the spec calls `runDeviceMinutes` with
 * fakes. It reads the session times from Appetize and records one
 * zero-credit `mobile_preview` usage row per session through metering.
 */
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import {
	APPETIZE_USD_MICROS_PER_MINUTE,
	billableMinutes,
	DEVICE_SESSION_GRACE_MS,
	DEVICE_SESSION_TIME_LIMIT_SECONDS,
} from "../modules/app-builder/domain/device-minutes";
import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import { AppetizeClient } from "../modules/app-builder/infrastructure/appetize/appetize.client";
import {
	type DeviceSessionRow,
	DeviceSessionsRepository,
} from "../modules/app-builder/infrastructure/persistence/device-sessions.repository";
import type { MeteringService } from "../modules/metering/application/services/metering.service";

import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

/** Rows per run: 100 Appetize reads fit the 240 s task budget. */
export const DEVICE_MINUTES_BATCH_LIMIT = 100;

/**
 * An Appetize session log can land late. After one hour, a row whose token
 * Appetize does not list as closed bills its own clock instead.
 */
export const APPETIZE_LOG_WAIT_MS = 60 * 60_000;

const TIME_LIMIT_MS = DEVICE_SESSION_TIME_LIMIT_SECONDS * 1000;

/** The slice of the run the spec fakes. */
export type DeviceMinutesDeps = {
	sessions: Pick<DeviceSessionsRepository, "listUnbilled" | "markBilled">;
	/** Null when `APPETIZE_API_TOKEN` is unset: every row then waits. */
	appetize: Pick<AppetizeClient, "getSession"> | null;
	metering: Pick<MeteringService, "recordFreeUsage">;
	/** `Sentry.logger` in production; every field value is a string. */
	logger: SandboxLogger;
	/** Clock injection for specs; production reads `new Date()`. */
	now?: () => Date;
};

/** The measure of one row, or `wait` when Appetize has no closed log yet. */
type Measure =
	| { kind: "wait" }
	| {
			kind: "bill";
			minutes: number;
			/** End of the session; the row keeps the first end time it has. */
			closedAt: Date;
			/** `contract_rate` for Appetize times, `estimated` for the own clock. */
			costStatus: "contract_rate" | "estimated";
			costSource: "appetize_session_log" | "wandit_session_clock";
	  };

/**
 * Bills one page of unbilled rows, oldest first. The queue runs one task
 * at a time, and both writes are keyed on the row, so a repeat run bills
 * nothing twice.
 */
export async function runDeviceMinutes(deps: DeviceMinutesDeps): Promise<{
	billed: number;
	failed: number;
	scanned: number;
	waiting: number;
}> {
	const { appetize } = deps;
	if (appetize === null) {
		deps.logger.warn("device-minutes.appetize-token-missing", {});
		return { billed: 0, failed: 0, scanned: 0, waiting: 0 };
	}
	const now = deps.now?.() ?? new Date();
	const rows = await deps.sessions.listUnbilled(
		new Date(now.getTime() - TIME_LIMIT_MS - DEVICE_SESSION_GRACE_MS),
		DEVICE_MINUTES_BATCH_LIMIT,
	);
	let billed = 0;
	let failed = 0;
	let waiting = 0;
	for (const row of rows) {
		try {
			const measure = await measureRow(row, appetize, now, deps.logger);
			if (measure.kind === "wait") {
				waiting += 1;
				continue;
			}
			// Evidence needs at least one unit; a zero-minute row only closes.
			if (measure.minutes > 0) {
				await deps.metering.recordFreeUsage(
					"mobile_preview",
					{ actorUserId: row.userId, organizationId: row.organizationId },
					{
						attemptRef: row.id,
						evidence: {
							chargedUsdMicros:
								measure.minutes * APPETIZE_USD_MICROS_PER_MINUTE,
							costSource: measure.costSource,
							costStatus: measure.costStatus,
							// Product rule: the plan allowance holds the minutes, not credits.
							customerBillable: false,
							idempotencyKey: `appetize:${row.id}`,
							providerRequestId: row.appetizeSessionToken,
							rateUsdMicrosPerUnit: APPETIZE_USD_MICROS_PER_MINUTE,
							transport: "appetize",
							unitKind: "device_minute",
							units: measure.minutes,
						},
						idempotencyKey: `mobile-preview:${row.id}`,
						projectId: row.projectId,
					},
				);
			}
			await deps.sessions.markBilled(row.id, measure.minutes, measure.closedAt);
			billed += 1;
		} catch (error) {
			// One bad row must not stop the page; the next run tries it again.
			deps.logger.error("device-minutes.bill-failed", {
				deviceSessionId: row.id,
				error: getErrorMessage(error),
			});
			failed += 1;
		}
	}
	return { billed, failed, scanned: rows.length, waiting };
}

/**
 * Appetize times when the log is closed. The own clock (start to end,
 * capped at the time limit) when the browser sent no token, or when
 * Appetize has no closed log after one hour. So a client cannot skip the
 * bill by hiding or faking the token.
 */
async function measureRow(
	row: DeviceSessionRow,
	appetize: Pick<AppetizeClient, "getSession">,
	now: Date,
	logger: SandboxLogger,
): Promise<Measure> {
	const ownEnd = new Date(
		Math.min(
			row.endedAt?.getTime() ?? Number.POSITIVE_INFINITY,
			row.startedAt.getTime() + TIME_LIMIT_MS,
		),
	);
	const ownClock: Measure = {
		closedAt: ownEnd,
		costSource: "wandit_session_clock",
		costStatus: "estimated",
		kind: "bill",
		minutes: billableMinutes(row.startedAt, ownEnd),
	};
	if (row.appetizeSessionToken === null) {
		return ownClock;
	}
	const session = await appetize.getSession(
		row.appetizeSessionToken,
		// The UTC day of the start; Appetize searches from it to today.
		row.startedAt.toISOString().slice(0, 10),
	);
	if (session?.startTime && session.closeTime) {
		const closedAt = new Date(session.closeTime);
		return {
			closedAt,
			costSource: "appetize_session_log",
			costStatus: "contract_rate",
			kind: "bill",
			minutes: billableMinutes(new Date(session.startTime), closedAt),
		};
	}
	if (now.getTime() - ownEnd.getTime() < APPETIZE_LOG_WAIT_MS) {
		return { kind: "wait" };
	}
	logger.warn("device-minutes.appetize-log-missing", {
		deviceSessionId: row.id,
	});
	return ownClock;
}

/** Composes the repository, the Appetize client, and metering for the Trigger worker. */
export function createDeviceMinutesRuntime(db: TriggerDatabase) {
	const token = env.APPETIZE_API_TOKEN;
	return {
		run: () =>
			runDeviceMinutes({
				appetize: token === undefined ? null : new AppetizeClient({ token }),
				logger: Sentry.logger,
				metering: createTriggerMetering(db),
				sessions: new DeviceSessionsRepository(db),
			}),
	};
}
