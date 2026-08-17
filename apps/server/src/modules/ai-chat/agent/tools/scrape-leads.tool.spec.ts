import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isR2Configured } from "../../../../infrastructure/storage/r2";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { isLeadSearchConfigured } from "../../../lead-scrapes/scraper/google-maps-search";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createScrapeLeadsTool } from "./scrape-leads.tool";

// Everything with side effects is replaced: env (credentials), storage
// (R2 check), the provider check, and the Trigger queue.
vi.mock("@wandit/env/server", () => ({
	env: {
		GENERATION_BILLING_MODE: "enforce",
		TRIGGER_SECRET_KEY: "tr_dev_test",
	},
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
}));

vi.mock("../../../lead-scrapes/scraper/google-maps-search", () => ({
	isLeadSearchConfigured: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
	auth: { createPublicToken: vi.fn() },
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

const INPUT = {
	limit: 150,
	location: "Alger",
	query: "salles de sport",
};

const INPUT_WITH_COUNTRY = { ...INPUT, country: "DZ" };

function setup(requestCountryCode: string | null = "DZ") {
	const leadScrapesRepository = {
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn().mockResolvedValue(true),
	};
	const usageEvent = {
		id: "usage-event-1",
		operation: "lead_scrape",
		status: "reserved",
		userId: "user-1",
	};
	const meteringService = {
		findByIdempotencyKey: vi.fn(async () => usageEvent),
		refund: vi.fn(async () => ({ ...usageEvent, status: "refunded" })),
		reserveWithReplay: vi.fn(async () => ({
			event: usageEvent,
			replay: "none",
			replayed: false,
		})),
		settle: vi.fn(),
	};
	const scrapeLeadsTool = createScrapeLeadsTool({
		chatId: "chat_1",
		leadScrapesRepository:
			leadScrapesRepository as unknown as LeadScrapesRepository,
		meteringService: meteringService as unknown as MeteringService,
		parentEventId: "chat-event-1",
		projectId: "project_1",
		requestCountryCode,
		subject: { actorUserId: "user-1" },
		userId: "user-1",
	});

	// The AI SDK calls execute with (input, callOptions); the tool ignores
	// the call options, so a stub second argument is enough here.
	const execute = (
		input: Partial<typeof INPUT_WITH_COUNTRY> & { query: string },
	) => {
		const run = scrapeLeadsTool.execute;

		if (!run) {
			throw new Error("scrape_leads tool must have execute");
		}

		return run(input, {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof run>[1]);
	};

	return { execute, leadScrapesRepository, meteringService };
}

beforeEach(() => {
	(
		env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = "enforce";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isLeadSearchConfigured).mockReset();
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-lead-scrape-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
});

describe("scrape_leads tool", () => {
	it("answers unavailable without touching the database when unconfigured", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(false);
		vi.mocked(isR2Configured).mockReturnValue(true);

		const output = await execute(INPUT);

		expect(output).toMatchObject({ status: "unavailable" });
		expect(leadScrapesRepository.insertAttempt).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("queues an attempt with a snapshotted spec including the IP country", async () => {
		const { execute, leadScrapesRepository } = setup("DZ");
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute(INPUT);

		expect(leadScrapesRepository.insertAttempt).toHaveBeenCalledWith({
			chatId: "chat_1",
			projectId: "project_1",
			spec: {
				countryCode: "dz",
				limit: 150,
				location: "Alger",
				query: "salles de sport",
				sources: ["google-maps"],
				version: 1,
			},
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			"lead-scrape:attempt_1",
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"scrape-leads",
			{
				actorUserId: "user-1",
				attemptId: "attempt_1",
				billingMode: "enforce",
				parentEventId: "chat-event-1",
			},
			{
				idempotencyKey: "global-lead-scrape-key",
				idempotencyKeyTTL: "14d",
				tags: ["lead-scrape-attempt:attempt_1", "project:project_1"],
				ttl: "5m",
			},
		);
		expect(leadScrapesRepository.markAttemptTriggered).toHaveBeenCalledWith(
			"attempt_1",
			"run_123",
		);
		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
	});

	it("snapshots billing-off into the queued task without creating a hold", async () => {
		const { execute, leadScrapesRepository, meteringService } = setup();
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "off";
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		await execute(INPUT);

		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledWith(
			"scrape-leads",
			expect.objectContaining({
				attemptId: "attempt_1",
				billingMode: "off",
			}),
			expect.any(Object),
		);
	});

	it("reserves before handoff and propagates the typed 402 without queueing", async () => {
		const { execute, leadScrapesRepository, meteringService } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		const paymentRequired = new InsufficientCreditsError(5, 2);
		meteringService.reserveWithReplay.mockRejectedValueOnce(paymentRequired);

		await expect(execute(INPUT)).rejects.toBe(paymentRequired);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"lead_scrape",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt_1",
				// 500 centi-credits = the 5.00-credit lead-scrape price.
				credits: 500,
				idempotencyKey: "lead-scrape:attempt_1",
				parentEventId: "chat-event-1",
			},
		);
		expect(leadScrapesRepository.markAttemptFailed).toHaveBeenCalledOnce();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("prefers the model-supplied country over the IP header", async () => {
		// IP says France (VPN, travel…) but the model knows "Alger" is Algeria.
		const { execute, leadScrapesRepository } = setup("FR");
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		await execute(INPUT_WITH_COUNTRY);

		expect(leadScrapesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({ countryCode: "dz" }),
			}),
		);
	});

	it("defaults the limit and tolerates a missing location/country", async () => {
		const { execute, leadScrapesRepository } = setup(null);
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		await execute({ query: "restaurants" });

		expect(leadScrapesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({
					countryCode: null,
					limit: 100,
					location: null,
					query: "restaurants",
				}),
			}),
		);
	});

	it("keeps an ambiguous handoff queued after bounded retries", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(new Error("trigger is down"));

		const output = await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledTimes(3);
		expect(leadScrapesRepository.markAttemptFailed).not.toHaveBeenCalled();
		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
	});

	it("retries an uncertain handoff with the same global key", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger)
			.mockRejectedValueOnce(new Error("response lost"))
			.mockResolvedValueOnce({
				id: "run_after_retry",
			} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledTimes(2);
		expect(vi.mocked(tasks.trigger).mock.calls[0]?.[2]).toMatchObject({
			idempotencyKey: "global-lead-scrape-key",
		});
		expect(vi.mocked(tasks.trigger).mock.calls[1]?.[2]).toMatchObject({
			idempotencyKey: "global-lead-scrape-key",
		});
		expect(leadScrapesRepository.markAttemptTriggered).toHaveBeenCalledWith(
			"attempt_1",
			"run_after_retry",
		);
		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
	});

	it("fails queued work immediately for a definitive Trigger rejection", async () => {
		const { execute, leadScrapesRepository, meteringService } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(
			Object.assign(new Error("invalid Trigger credentials"), {
				name: "TriggerApiError",
				status: 401,
			}),
		);

		const output = await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledTimes(1);
		expect(leadScrapesRepository.markAttemptFailed).toHaveBeenCalledWith(
			"attempt_1",
			"The background scraper rejected this request. Please try again.",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage-event-1",
			"lead_scrape_failed",
		);
		expect(output).toMatchObject({ status: "unavailable" });
	});

	it("preserves a live attempt when the definitive-rejection CAS loses", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		leadScrapesRepository.markAttemptFailed.mockResolvedValue(false);
		vi.mocked(tasks.trigger).mockRejectedValue(
			Object.assign(new Error("invalid request"), {
				name: "TriggerApiError",
				status: 422,
			}),
		);

		const output = await execute(INPUT);

		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
	});

	it("does not turn accepted work into a failure when run-id persistence fails", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		leadScrapesRepository.markAttemptTriggered.mockRejectedValue(
			new Error("attempt already running"),
		);
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute(INPUT);

		expect(leadScrapesRepository.markAttemptFailed).not.toHaveBeenCalled();
		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
	});
});
