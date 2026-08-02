import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainsUnavailableError } from "../../domain/errors/domain.errors";
import {
	recoverDomainPurchaseTask,
	TriggerDomainTaskDispatcherService,
} from "./trigger-domain-task-dispatcher.service";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(), reset: vi.fn() },
	runs: { retrieve: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

const DOMAIN_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const GLOBAL_KEY = "global-domain-task-key";

function taskHandle(id: string) {
	return { id } as Awaited<ReturnType<typeof tasks.trigger>>;
}

function retrievedRun(status: string) {
	return { status } as Awaited<ReturnType<typeof runs.retrieve>>;
}

describe("TriggerDomainTaskDispatcherService", () => {
	beforeEach(() => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "tr_dev_test");
		vi.mocked(idempotencyKeys.create).mockReset();
		vi.mocked(idempotencyKeys.create).mockResolvedValue(
			GLOBAL_KEY as Awaited<ReturnType<typeof idempotencyKeys.create>>,
		);
		vi.mocked(idempotencyKeys.reset).mockReset();
		vi.mocked(idempotencyKeys.reset).mockResolvedValue({ id: "reset_1" });
		vi.mocked(runs.retrieve).mockReset();
		vi.mocked(tasks.trigger).mockReset();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("fails with the existing 503 contract before calling Trigger when unavailable", async () => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "   ");
		const dispatcher = new TriggerDomainTaskDispatcherService();

		expect(() => dispatcher.assertAvailable()).toThrow(DomainsUnavailableError);
		await expect(
			dispatcher.triggerPurchase({ domainId: DOMAIN_ID, orderId: ORDER_ID }),
		).rejects.toMatchObject({
			response: {
				code: "DOMAINS_TEMPORARILY_UNAVAILABLE",
				message: "Custom domains are temporarily unavailable",
			},
			status: 503,
		});
		expect(idempotencyKeys.create).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("triggers a purchase with the global order key and domain/order tags", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_purchase"));
		const dispatcher = new TriggerDomainTaskDispatcherService();
		const payload = { domainId: DOMAIN_ID, orderId: ORDER_ID };

		await expect(dispatcher.triggerPurchase(payload)).resolves.toEqual({
			id: "run_purchase",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`domain-purchase:${ORDER_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith("domain-purchase", payload, {
			idempotencyKey: GLOBAL_KEY,
			tags: [`domain:${DOMAIN_ID}`, `order:${ORDER_ID}`],
		});
	});

	it("returns the same duplicate purchase handle under the same global key", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_original"));
		const dispatcher = new TriggerDomainTaskDispatcherService();
		const payload = { domainId: DOMAIN_ID, orderId: ORDER_ID };

		await expect(dispatcher.triggerPurchase(payload)).resolves.toEqual({
			id: "run_original",
		});
		await expect(dispatcher.triggerPurchase(payload)).resolves.toEqual({
			id: "run_original",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledTimes(2);
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
		expect(vi.mocked(tasks.trigger).mock.calls[0]?.[2]).toEqual(
			vi.mocked(tasks.trigger).mock.calls[1]?.[2],
		);
	});

	it("triggers configuration with the global domain-and-nonce key", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_configuration"));
		const dispatcher = new TriggerDomainTaskDispatcherService();
		const payload = { domainId: DOMAIN_ID, nonce: "manual:nonce-1" };

		await expect(dispatcher.triggerConfiguration(payload)).resolves.toEqual({
			id: "run_configuration",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`domain-configure:${DOMAIN_ID}:manual:nonce-1`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith("domain-configure", payload, {
			idempotencyKey: GLOBAL_KEY,
			tags: [`domain:${DOMAIN_ID}`],
		});
	});

	it("returns the duplicate live handle without resetting or retriggering it", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_live"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun("WAITING"));
		const dispatcher = new TriggerDomainTaskDispatcherService();

		await expect(
			dispatcher.recoverPurchase({ domainId: DOMAIN_ID, orderId: ORDER_ID }),
		).resolves.toEqual({ id: "run_live" });
		expect(runs.retrieve).toHaveBeenCalledWith("run_live");
		expect(idempotencyKeys.reset).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("allows Trigger-context recovery without an API producer secret", async () => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "");
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_live"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun("QUEUED"));

		await expect(
			recoverDomainPurchaseTask({ domainId: DOMAIN_ID, orderId: ORDER_ID }),
		).resolves.toEqual({ id: "run_live" });
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it.each([
		"CANCELED",
		"COMPLETED",
	])("resets and retriggers a stale %s purchase only through recovery", async (status) => {
		vi.mocked(tasks.trigger)
			.mockResolvedValueOnce(taskHandle("run_terminal"))
			.mockResolvedValueOnce(taskHandle("run_recovered"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun(status));
		const dispatcher = new TriggerDomainTaskDispatcherService();
		const payload = { domainId: DOMAIN_ID, orderId: ORDER_ID };

		await expect(dispatcher.recoverPurchase(payload)).resolves.toEqual({
			id: "run_recovered",
		});
		expect(idempotencyKeys.reset).toHaveBeenCalledWith(
			"domain-purchase",
			GLOBAL_KEY,
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
		expect(tasks.trigger).toHaveBeenNthCalledWith(
			2,
			"domain-purchase",
			payload,
			{
				idempotencyKey: GLOBAL_KEY,
				tags: [`domain:${DOMAIN_ID}`, `order:${ORDER_ID}`],
			},
		);
	});

	it.each([
		"FAILED",
		"CRASHED",
		"SYSTEM_FAILURE",
		"EXPIRED",
		"TIMED_OUT",
	])("does not manually reset the automatically released %s failure key", async (status) => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_failed"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun(status));
		const dispatcher = new TriggerDomainTaskDispatcherService();

		await dispatcher.recoverPurchase({
			domainId: DOMAIN_ID,
			orderId: ORDER_ID,
		});

		expect(idempotencyKeys.reset).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});
});
