import { runs } from "@trigger.dev/sdk";
import { LEAD_SCRAPE_FAILED_REFUNDED_TEXT } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeteringService } from "../../../metering/application/services/metering.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	type LeadScrapeAttemptRow,
	LeadScrapesRepository,
} from "../../infrastructure/persistence/lead-scrapes.repository";
import { LeadScrapesService } from "./lead-scrapes.service";

// The run lookup is the only external boundary: Trigger.dev is a
// third-party SDK, so a module fake is allowed here. Repository and
// metering are repo modules — they arrive as fakes through the constructor.
vi.mock("@trigger.dev/sdk", () => ({
	runs: { retrieve: vi.fn() },
}));

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };

function attemptRow(
	over: Partial<LeadScrapeAttemptRow> = {},
): LeadScrapeAttemptRow {
	return {
		columnCount: null,
		completedAt: null,
		createdAt: new Date("2026-09-01T00:00:00Z"),
		error: null,
		fileName: null,
		fileSize: null,
		foundCount: 0,
		id: "attempt-1",
		previewRows: null,
		progress: 40,
		projectId: "project-1",
		r2Key: null,
		rowCount: null,
		spec: null,
		stage: "searching",
		status: "running",
		triggerRunId: "run-1",
		...over,
	};
}

/** A run object carrying only the flags the service reads. */
function runFlags(flags: {
	isCancelled?: boolean;
	isCompleted?: boolean;
	isFailed?: boolean;
	isSuccess?: boolean;
}): Awaited<ReturnType<typeof runs.retrieve>> {
	const run = {
		isCancelled: false,
		isCompleted: false,
		isFailed: false,
		isSuccess: false,
		...flags,
	};

	// SAFETY: settleDeadRun reads only these four flags off the run response.
	return run as Awaited<ReturnType<typeof runs.retrieve>>;
}

// `reads` answers findAccessibleAttempt in call order; a single entry is
// returned for every call (the row re-read after a settle uses it too).
function setup(reads: Array<LeadScrapeAttemptRow | null>) {
	const findAccessibleAttempt = vi
		.fn()
		.mockImplementation(async () =>
			reads.length > 1 ? reads.shift() : (reads[0] ?? null),
		);
	const settleDeadRun = vi.fn().mockResolvedValue(true);
	const leadScrapesRepository = Object.assign(
		Object.create(LeadScrapesRepository.prototype),
		{ findAccessibleAttempt, settleDeadRun },
	);
	const usageEvent = { id: "usage-event-1", status: "reserved" };
	const meteringService = Object.assign(
		Object.create(MeteringService.prototype),
		{
			findByIdempotencyKey: vi.fn(async () => usageEvent),
			listProviderCallEvidence: vi.fn(async () => [
				{ idempotencyKey: "serper:attempt-1", units: 2 },
			]),
			refundWithProviderCost: vi.fn(async () => ({
				...usageEvent,
				status: "refunded",
			})),
		},
	);
	const service = new LeadScrapesService(
		leadScrapesRepository,
		meteringService,
	);

	return { meteringService, service, settleDeadRun };
}

beforeEach(() => {
	vi.mocked(runs.retrieve).mockReset();
	Object.assign(env, { TRIGGER_SECRET_KEY: "tr_dev_test" });
});

describe("LeadScrapesService dead-run settlement", () => {
	it("fails a running row whose run died and refunds its hold once", async () => {
		const { meteringService, service, settleDeadRun } = setup([
			attemptRow(),
			attemptRow({ status: "failed" }),
		]);
		vi.mocked(runs.retrieve).mockResolvedValue(runFlags({ isFailed: true }));

		const attempt = await service.attempt(SCOPE, "attempt-1");

		expect(settleDeadRun).toHaveBeenCalledOnce();
		expect(settleDeadRun).toHaveBeenCalledWith(
			"attempt-1",
			"run-1",
			LEAD_SCRAPE_FAILED_REFUNDED_TEXT,
		);
		// 2 Serper pages on the durable receipt = 2000 USD micros of cost.
		expect(meteringService.refundWithProviderCost).toHaveBeenCalledOnce();
		expect(meteringService.refundWithProviderCost).toHaveBeenCalledWith(
			"usage-event-1",
			2_000,
			"lead_scrape_failed",
		);
		expect(attempt.status).toBe("failed");
	});

	it("returns the failed row when the refund itself fails", async () => {
		const { meteringService, service, settleDeadRun } = setup([
			attemptRow(),
			attemptRow({ status: "failed" }),
		]);
		vi.mocked(runs.retrieve).mockResolvedValue(runFlags({ isFailed: true }));
		meteringService.refundWithProviderCost.mockRejectedValueOnce(
			new Error("ledger unavailable"),
		);

		const attempt = await service.attempt(SCOPE, "attempt-1");

		expect(settleDeadRun).toHaveBeenCalledOnce();
		expect(attempt.status).toBe("failed");
	});

	it("does not refund again when a second read loses the settle CAS", async () => {
		const { meteringService, service, settleDeadRun } = setup([
			attemptRow(),
			attemptRow({ status: "failed" }),
			attemptRow(),
			attemptRow({ status: "failed" }),
		]);
		settleDeadRun.mockResolvedValueOnce(true).mockResolvedValue(false);
		vi.mocked(runs.retrieve).mockResolvedValue(runFlags({ isFailed: true }));

		const first = await service.attempt(SCOPE, "attempt-1");
		const second = await service.attempt(SCOPE, "attempt-1");

		expect(settleDeadRun).toHaveBeenCalledTimes(2);
		expect(meteringService.refundWithProviderCost).toHaveBeenCalledOnce();
		expect(first.status).toBe("failed");
		expect(second.status).toBe("failed");
	});

	it("leaves a running row alone while its run is still alive", async () => {
		const { meteringService, service, settleDeadRun } = setup([attemptRow()]);
		vi.mocked(runs.retrieve).mockResolvedValue(runFlags({}));

		const attempt = await service.attempt(SCOPE, "attempt-1");

		expect(runs.retrieve).toHaveBeenCalledWith("run-1");
		expect(settleDeadRun).not.toHaveBeenCalled();
		expect(meteringService.refundWithProviderCost).not.toHaveBeenCalled();
		expect(attempt.status).toBe("running");
	});

	it("leaves the row unchanged when the run lookup throws", async () => {
		const { meteringService, service, settleDeadRun } = setup([attemptRow()]);
		vi.mocked(runs.retrieve).mockRejectedValue(
			new Error("Trigger.dev is unreachable"),
		);

		const attempt = await service.attempt(SCOPE, "attempt-1");

		expect(settleDeadRun).not.toHaveBeenCalled();
		expect(meteringService.refundWithProviderCost).not.toHaveBeenCalled();
		expect(attempt.status).toBe("running");
	});

	it("skips the run lookup entirely for a row without a run id", async () => {
		const { service, settleDeadRun } = setup([
			attemptRow({ triggerRunId: null }),
		]);

		const attempt = await service.attempt(SCOPE, "attempt-1");

		expect(runs.retrieve).not.toHaveBeenCalled();
		expect(settleDeadRun).not.toHaveBeenCalled();
		expect(attempt.status).toBe("running");
	});
});
