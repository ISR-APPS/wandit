/**
 * The credit hold of one desktop or mobile build run: lease, heartbeat,
 * refund, settle, and release. `desktop-build.runtime.ts` and
 * `mobile-build.runtime.ts` call `createBuildCreditHold`. It calls the
 * metering service. The API reserves the hold before it queues the run.
 */
import { randomUUID } from "node:crypto";

import { getErrorMessage } from "@wandit/observability/error";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type {
	AiUsageEvent,
	MeteringSettlement,
} from "../modules/metering/domain/metering";

// 40 min, the window of the stale-hold sweep. The sweep refunds a 40-minute-old
// hold only when no live lease covers it. The longest steps between two
// heartbeats are these. The desktop sandbox build takes about 8 min. The mobile
// `prepareWorkspace` takes up to 35 min. The mobile `runner.start` takes 18 min.
const LEASE_TTL_MS = 40 * 60_000;

/** The refund reasons of the build runs. The API cancel routes also write the `_canceled` ones. */
export type BuildHoldRefundReason =
	| "desktop_build_failed"
	| "desktop_build_blocked"
	| "desktop_build_canceled"
	| "mobile_build_failed"
	| "mobile_build_canceled";

/** What `createBuildCreditHold` needs. Each runtime passes its own deps and its row. */
export type BuildCreditHoldInput = {
	metering: Pick<
		MeteringService,
		| "acquireExecutionLease"
		| "findByIdempotencyKeyAnyPayer"
		| "heartbeatExecutionLease"
		| "refund"
		| "releaseExecutionLease"
		| "settle"
	>;
	logger: SandboxLogger;
	/** `GENERATION_BILLING_MODE === "off"`: the API made no hold, so the build runs without one. */
	billingDisabled: boolean;
	/** The idempotency key of the API hold, from `desktopBuildHoldKey` or `mobileBuildHoldKey`. */
	holdKey: string;
	/** The `operation` that the API wrote on the hold row. A hold of another operation never pays for this build. */
	operation: "desktop_build" | "mobile_build";
	/**
	 * The owner columns of the `desktop_builds` or `mobile_builds` row. `userId`
	 * is the actor and `organizationId` the team org or null. The hold must name
	 * the same ones.
	 */
	build: { projectId: string; userId: string; organizationId: string | null };
	/** The first part of each log message. The specs and the log alerts read these names. */
	logPrefix: "desktop-build" | "mobile-build";
	/** The ids on each log line. */
	logFields: { buildId: string; projectId: string };
};

/** The hold of one run. Every call does nothing until `lease` finds and leases a hold. */
export type BuildCreditHold = {
	/**
	 * Finds the API hold and leases it, so the stale-hold sweep skips it.
	 * "hold_mismatch": billing is on, and no hold or a hold of another build
	 * has the key. "not_reserved": the hold left `reserved` before the run.
	 * The caller fails the build on both. "no_hold": billing is off and the
	 * key has no hold of this build. A throw (a DB error) goes to the caller.
	 */
	lease: () => Promise<"leased" | "no_hold" | "not_reserved" | "hold_mismatch">;
	/** Renews the lease. Throws when the hold left `reserved`: no unpaid build. */
	heartbeat: () => Promise<void>;
	/** Refunds a still-reserved hold. A failure only logs: the stale-hold sweep refunds it later. */
	refund: (reason: BuildHoldRefundReason) => Promise<void>;
	/** Settles a still-reserved hold. A failure throws: the caller logs it and captures it. */
	settle: (settlement: MeteringSettlement) => Promise<void>;
	/** Ends the lease of this run. Never throws: the service logs its own failure. */
	release: () => Promise<void>;
};

/**
 * True when `hold` is the hold that the API reserved for this row: the same
 * operation, project, actor, and team org. The hold row names the payer
 * (workspaces-sharing.md 4), so the run needs no payer of its own.
 */
function isHoldOfBuild(
	hold: AiUsageEvent,
	input: BuildCreditHoldInput,
): boolean {
	return (
		hold.operation === input.operation &&
		hold.projectId === input.build.projectId &&
		hold.userId === input.build.userId &&
		hold.organizationId === input.build.organizationId
	);
}

/** Makes the hold handle of one run. Call it once per run, before the first `lease`. */
export function createBuildCreditHold(
	input: BuildCreditHoldInput,
): BuildCreditHold {
	const { logFields, logger, logPrefix, metering } = input;
	// The hold's lease column is a uuid. One token per run: the heartbeat
	// renews only the lease of this run.
	const leaseToken = randomUUID();
	// The id of the hold this run leased; null without a hold.
	let holdId: string | null = null;

	/**
	 * The hold when it is still `reserved`, else null (logged). The callers
	 * run only after `lease` matched this hold to the row.
	 */
	const findReservedHold = async (action: "settle" | "refund") => {
		const hold = await metering.findByIdempotencyKeyAnyPayer(input.holdKey);
		if (hold?.status !== "reserved") {
			logger.info(`${logPrefix}.hold-not-reserved`, {
				...logFields,
				action,
				status: hold?.status ?? "missing",
			});
			return null;
		}
		return hold;
	};

	return {
		lease: async () => {
			const hold = await metering.findByIdempotencyKeyAnyPayer(input.holdKey);
			if (hold === null || !isHoldOfBuild(hold, input)) {
				// Money check, same rule as builder-turn: with billing on, the
				// build runs only on the hold that the API reserved for this row.
				// Else it runs free or bills the wrong pool.
				if (!input.billingDisabled) {
					return "hold_mismatch";
				}
				// With billing off the API made no hold. A foreign hold stays untouched.
				logger.info("billing.off", logFields);
				return "no_hold";
			}
			// The sweep refunds a hold that waited too long in the queue. A
			// build without its hold would run for free, so the caller fails it.
			if (hold.status !== "reserved") {
				return "not_reserved";
			}
			// The lease marks the hold as live, so the sweep skips it.
			const leased = await metering.acquireExecutionLease(
				hold.id,
				leaseToken,
				LEASE_TTL_MS,
			);
			if (leased === null) {
				return "not_reserved";
			}
			holdId = hold.id;
			return "leased";
		},

		// "lost" means the hold left `reserved`, or another token holds the
		// lease; a fresh acquire tells which.
		heartbeat: async () => {
			if (holdId === null) {
				return;
			}
			// `heartbeatExecutionLease` never throws; "error" keeps the lease.
			const lease = await metering.heartbeatExecutionLease(
				holdId,
				leaseToken,
				LEASE_TTL_MS,
			);
			if (lease !== "lost") {
				return;
			}
			let leased: boolean;
			try {
				leased =
					(await metering.acquireExecutionLease(
						holdId,
						leaseToken,
						LEASE_TTL_MS,
					)) !== null;
			} catch (error) {
				// A failed DB call does not prove a lost hold. The next heartbeat
				// tries again.
				logger.warn(`${logPrefix}.lease-renew-failed`, {
					...logFields,
					error: getErrorMessage(error),
				});
				return;
			}
			if (!leased) {
				// Like builder-turn: the sweep or an API cancel refunded the hold,
				// so the caller stops the build and fails the row.
				throw new Error("the credit hold left reserved during the build");
			}
		},

		refund: async (reason) => {
			if (holdId === null) {
				return;
			}
			try {
				const hold = await findReservedHold("refund");
				if (hold !== null) {
					await metering.refund(hold.id, reason);
				}
			} catch (error) {
				logger.error(`${logPrefix}.refund-failed`, {
					...logFields,
					error: getErrorMessage(error),
				});
			}
		},

		settle: async (settlement) => {
			if (holdId === null) {
				return;
			}
			const hold = await findReservedHold("settle");
			if (hold !== null) {
				await metering.settle(hold.id, settlement);
			}
		},

		release: async () => {
			if (holdId !== null) {
				await metering.releaseExecutionLease(holdId, leaseToken);
			}
		},
	};
}
