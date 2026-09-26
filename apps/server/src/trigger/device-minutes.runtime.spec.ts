import { describe, expect, it, vi } from "vitest";

import type { AppetizeSessionLog } from "../modules/app-builder/infrastructure/appetize/appetize.client";
import type { DeviceSessionRow } from "../modules/app-builder/infrastructure/persistence/device-sessions.repository";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import {
	APPETIZE_LOG_WAIT_MS,
	type DeviceMinutesDeps,
	runDeviceMinutes,
} from "./device-minutes.runtime";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const MINUTE_MS = 60_000;

/** A row that started `startedMinutesAgo` before NOW and, when given, ended `endedMinutesAgo` before NOW. */
function row(
	id: string,
	options: {
		startedMinutesAgo: number;
		endedMinutesAgo?: number;
		token?: string;
	},
): DeviceSessionRow {
	return {
		appetizeSessionToken: options.token ?? null,
		billedAt: null,
		createdAt: NOW,
		endedAt:
			options.endedMinutesAgo === undefined
				? null
				: new Date(NOW.getTime() - options.endedMinutesAgo * MINUTE_MS),
		id,
		minutes: null,
		organizationId: null,
		platform: "ios",
		projectId: "11111111-1111-4111-8111-111111111111",
		startedAt: new Date(NOW.getTime() - options.startedMinutesAgo * MINUTE_MS),
		updatedAt: NOW,
		userId: "user-1",
	};
}

/** Fakes with the billed_at guard and the idempotency keys of the real writes. */
function setup(
	rows: DeviceSessionRow[],
	appetizeLogs: Record<string, AppetizeSessionLog>,
) {
	const billed = new Map<string, number>();
	const usageKeys = new Set<string>();
	const recordFreeUsage = vi.fn<MeteringService["recordFreeUsage"]>(
		async (_operation, _subject, usage) => {
			usageKeys.add(usage.idempotencyKey);
			// SAFETY: the runtime reads nothing from the answer.
			return {} as Awaited<ReturnType<MeteringService["recordFreeUsage"]>>;
		},
	);
	const deps: DeviceMinutesDeps = {
		appetize: {
			getSession: async (token) => appetizeLogs[token] ?? null,
		},
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		metering: { recordFreeUsage },
		now: () => NOW,
		sessions: {
			listUnbilled: async () =>
				rows.filter((candidate) => !billed.has(candidate.id)),
			markBilled: async (id, minutes) => {
				if (billed.has(id)) return false;
				billed.set(id, minutes);
				return true;
			},
		},
	};
	return { billed, deps, recordFreeUsage, usageKeys };
}

describe("runDeviceMinutes", () => {
	it("bills the Appetize times rounded up, as one zero-credit usage row at the contract rate", async () => {
		const { billed, deps, recordFreeUsage } = setup(
			[
				row("s1", {
					endedMinutesAgo: 5,
					startedMinutesAgo: 10,
					token: "tok_1",
				}),
			],
			{
				tok_1: {
					closeTime: "2026-09-26T11:54:10.000Z",
					sessionToken: "tok_1",
					startTime: "2026-09-26T11:52:00.000Z",
				},
			},
		);

		const result = await runDeviceMinutes(deps);

		expect(result).toEqual({ billed: 1, failed: 0, scanned: 1, waiting: 0 });
		// 2 min 10 s rounds up to 3 minutes.
		expect(billed.get("s1")).toBe(3);
		expect(recordFreeUsage).toHaveBeenCalledWith(
			"mobile_preview",
			{ actorUserId: "user-1", organizationId: null },
			expect.objectContaining({
				evidence: expect.objectContaining({
					chargedUsdMicros: 180_000,
					costStatus: "contract_rate",
					customerBillable: false,
					providerRequestId: "tok_1",
					units: 3,
				}),
				idempotencyKey: "mobile-preview:s1",
			}),
		);
	});

	it("bills nothing twice on a repeat run", async () => {
		const { deps, recordFreeUsage } = setup(
			[
				row("s1", {
					endedMinutesAgo: 5,
					startedMinutesAgo: 10,
					token: "tok_1",
				}),
			],
			{
				tok_1: {
					closeTime: "2026-09-26T11:55:00.000Z",
					sessionToken: "tok_1",
					startTime: "2026-09-26T11:50:00.000Z",
				},
			},
		);

		await runDeviceMinutes(deps);
		const repeat = await runDeviceMinutes(deps);

		expect(repeat.scanned).toBe(0);
		expect(recordFreeUsage).toHaveBeenCalledTimes(1);
	});

	it("waits for a missing Appetize log, then bills the own clock after one hour", async () => {
		const recent = row("recent", {
			endedMinutesAgo: 5,
			startedMinutesAgo: 10,
			token: "tok_missing",
		});
		const old = row("old", {
			endedMinutesAgo: APPETIZE_LOG_WAIT_MS / MINUTE_MS + 5,
			startedMinutesAgo: APPETIZE_LOG_WAIT_MS / MINUTE_MS + 9,
			token: "tok_lost",
		});
		const { billed, deps } = setup([recent, old], {});

		const result = await runDeviceMinutes(deps);

		expect(result).toMatchObject({ billed: 1, waiting: 1 });
		expect(billed.has("recent")).toBe(false);
		// Own clock: 4 minutes from start to end.
		expect(billed.get("old")).toBe(4);
	});

	it("bills the own clock, capped at the time limit, for a row without a token", async () => {
		// The browser never ended it: the stale row counts to the 15-minute cap.
		const { billed, deps, recordFreeUsage } = setup(
			[row("s1", { startedMinutesAgo: 40 })],
			{},
		);

		await runDeviceMinutes(deps);

		expect(billed.get("s1")).toBe(15);
		expect(recordFreeUsage).toHaveBeenCalledWith(
			"mobile_preview",
			expect.anything(),
			expect.objectContaining({
				evidence: expect.objectContaining({
					costStatus: "estimated",
					providerRequestId: null,
					units: 15,
				}),
			}),
		);
	});

	it("closes a zero-minute row without a usage row", async () => {
		const zero = row("s1", { endedMinutesAgo: 20, startedMinutesAgo: 20 });
		const { billed, deps, recordFreeUsage } = setup([zero], {});

		await runDeviceMinutes(deps);

		expect(billed.get("s1")).toBe(0);
		expect(recordFreeUsage).not.toHaveBeenCalled();
	});

	it("keeps billing the page after one row fails, and does nothing without a token", async () => {
		const { billed, deps, recordFreeUsage } = setup(
			[
				row("bad", { endedMinutesAgo: 5, startedMinutesAgo: 10 }),
				row("good", { endedMinutesAgo: 5, startedMinutesAgo: 10 }),
			],
			{},
		);
		recordFreeUsage.mockRejectedValueOnce(new Error("db down"));

		const result = await runDeviceMinutes(deps);
		const unconfigured = await runDeviceMinutes({ ...deps, appetize: null });

		expect(result).toMatchObject({ billed: 1, failed: 1 });
		expect(billed.has("good")).toBe(true);
		expect(unconfigured).toEqual({
			billed: 0,
			failed: 0,
			scanned: 0,
			waiting: 0,
		});
	});
});
