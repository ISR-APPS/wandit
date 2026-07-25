import { tasks } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { isLeadSearchConfigured } from "../../../lead-scrapes/scraper/google-maps-search";
import { createScrapeLeadsTool } from "./scrape-leads.tool";

// Everything with side effects is replaced: env (credentials), storage
// (R2 check), the provider check, and the Trigger queue.
vi.mock("@wandit/env/server", () => ({
	env: {
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
		markAttemptFailed: vi.fn(),
		markAttemptTriggered: vi.fn(),
	};
	const scrapeLeadsTool = createScrapeLeadsTool({
		chatId: "chat_1",
		leadScrapesRepository:
			leadScrapesRepository as unknown as LeadScrapesRepository,
		projectId: "project_1",
		requestCountryCode,
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

	return { execute, leadScrapesRepository };
}

beforeEach(() => {
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isLeadSearchConfigured).mockReset();
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
		expect(tasks.trigger).toHaveBeenCalledWith("scrape-leads", {
			attemptId: "attempt_1",
		});
		expect(leadScrapesRepository.markAttemptTriggered).toHaveBeenCalledWith(
			"attempt_1",
			"run_123",
		);
		expect(output).toMatchObject({ attemptId: "attempt_1", status: "queued" });
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

	it("marks the attempt failed and answers unavailable when queueing throws", async () => {
		const { execute, leadScrapesRepository } = setup();
		vi.mocked(isLeadSearchConfigured).mockReturnValue(true);
		vi.mocked(isR2Configured).mockReturnValue(true);
		leadScrapesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(new Error("trigger is down"));

		const output = await execute(INPUT);

		expect(leadScrapesRepository.markAttemptFailed).toHaveBeenCalledWith(
			"attempt_1",
			"trigger is down",
		);
		expect(output).toMatchObject({ status: "unavailable" });
	});
});
