import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	recoverOrderRefundTask,
	TriggerOrderRefundDispatcherService,
	triggerOrderRefundTask,
} from "./trigger-order-refund-dispatcher.service";

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn(), reset: vi.fn() },
	runs: { retrieve: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const GLOBAL_KEY = "global-refund-key";
const PAYLOAD = {
	failureReason: "Domain registration failed",
	orderId: ORDER_ID,
};

function taskHandle(id: string) {
	return { id } as Awaited<ReturnType<typeof tasks.trigger>>;
}

function retrievedRun(status: string) {
	return { status } as Awaited<ReturnType<typeof runs.retrieve>>;
}

describe("TriggerOrderRefundDispatcherService", () => {
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

	it("fails with 503 before calling Trigger when refund delivery is unavailable", async () => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "");
		const dispatcher = new TriggerOrderRefundDispatcherService();

		expect(() => dispatcher.assertAvailable()).toThrowError(
			/temporarily unavailable/,
		);
		await expect(dispatcher.triggerRefund(PAYLOAD)).rejects.toMatchObject({
			status: 503,
		});
		expect(idempotencyKeys.create).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("triggers the exact refund payload with its global order key and tag", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_refund"));
		const dispatcher = new TriggerOrderRefundDispatcherService();

		await expect(dispatcher.triggerRefund(PAYLOAD)).resolves.toEqual({
			id: "run_refund",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`order-refund:${ORDER_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith("order-refund", PAYLOAD, {
			idempotencyKey: GLOBAL_KEY,
			tags: [`order:${ORDER_ID}`],
		});
	});

	it("returns the same duplicate refund handle under the same global key", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_original"));
		const dispatcher = new TriggerOrderRefundDispatcherService();

		await expect(dispatcher.triggerRefund(PAYLOAD)).resolves.toEqual({
			id: "run_original",
		});
		await expect(dispatcher.triggerRefund(PAYLOAD)).resolves.toEqual({
			id: "run_original",
		});
		expect(idempotencyKeys.create).toHaveBeenCalledTimes(2);
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
		expect(vi.mocked(tasks.trigger).mock.calls[0]?.[2]).toEqual(
			vi.mocked(tasks.trigger).mock.calls[1]?.[2],
		);
	});

	it("allows Trigger-context refund handoff without an API producer secret", async () => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "");
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_refund"));

		await expect(triggerOrderRefundTask(PAYLOAD)).resolves.toEqual({
			id: "run_refund",
		});
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("allows Trigger-context refund recovery without an API producer secret", async () => {
		vi.stubEnv("TRIGGER_SECRET_KEY", "");
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_live"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun("WAITING"));

		await expect(recoverOrderRefundTask(PAYLOAD)).resolves.toEqual({
			id: "run_live",
		});
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
		expect(idempotencyKeys.reset).not.toHaveBeenCalled();
	});

	it("returns a duplicate live refund handle without resetting it", async () => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_live"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun("EXECUTING"));
		const dispatcher = new TriggerOrderRefundDispatcherService();

		await expect(dispatcher.recoverRefund(PAYLOAD)).resolves.toEqual({
			id: "run_live",
		});
		expect(runs.retrieve).toHaveBeenCalledWith("run_live");
		expect(idempotencyKeys.reset).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});

	it("resets and retriggers a canceled refund from the reconciler path", async () => {
		vi.mocked(tasks.trigger)
			.mockResolvedValueOnce(taskHandle("run_canceled"))
			.mockResolvedValueOnce(taskHandle("run_recovered"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun("CANCELED"));
		const dispatcher = new TriggerOrderRefundDispatcherService();

		await expect(dispatcher.recoverRefund(PAYLOAD)).resolves.toEqual({
			id: "run_recovered",
		});
		expect(idempotencyKeys.reset).toHaveBeenCalledWith(
			"order-refund",
			GLOBAL_KEY,
		);
		expect(tasks.trigger).toHaveBeenCalledTimes(2);
	});

	it.each([
		"COMPLETED",
		"FAILED",
		"CRASHED",
		"SYSTEM_FAILURE",
	])("does not reset a %s refund run", async (status) => {
		vi.mocked(tasks.trigger).mockResolvedValue(taskHandle("run_terminal"));
		vi.mocked(runs.retrieve).mockResolvedValue(retrievedRun(status));
		const dispatcher = new TriggerOrderRefundDispatcherService();

		await dispatcher.recoverRefund(PAYLOAD);

		expect(idempotencyKeys.reset).not.toHaveBeenCalled();
		expect(tasks.trigger).toHaveBeenCalledTimes(1);
	});
});
