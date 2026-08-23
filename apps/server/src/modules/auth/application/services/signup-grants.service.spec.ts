import { Logger } from "@nestjs/common";
import type { ProductSettings } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import type {
	SignupGrantOutboxRepository,
	SignupGrantOutboxRow,
} from "../../infrastructure/persistence/signup-grant-outbox.repository";
import type { TriggerSignupGrantDispatcherService } from "../../infrastructure/trigger/trigger-signup-grant-dispatcher.service";
import { SignupGrantOutboxService } from "./signup-grant-outbox.service";
import { SignupGrantsService } from "./signup-grants.service";

function settings(overrides: Partial<ProductSettings> = {}): ProductSettings {
	return {
		emailAuthEnabled: false,
		id: 1,
		manualGraceDays: 0,
		manualPaymentsEnabled: false,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: false,
		signupGrantCredits: 20,
		signupGrantEnabled: true,
		topupsEnabled: false,
		updatedAt: "2026-08-01T10:00:00.000Z",
		updatedByUserId: null,
		version: 1,
		...overrides,
	};
}

class InMemorySignupGrantOutboxRepository {
	readonly rows = new Map<string, SignupGrantOutboxRow>();
	createError: Error | null = null;
	failMarkDoneOnce = false;

	async create(input: {
		credits: number;
		settingsVersion: number;
		status: SignupGrantOutboxRow["status"];
		userId: string;
	}) {
		if (this.createError) {
			throw this.createError;
		}

		const existing = this.rows.get(input.userId);

		if (existing) {
			return existing;
		}

		const row = {
			attempts: 0,
			createdAt: new Date("2026-08-01T10:00:00.000Z"),
			credits: input.credits,
			doneAt: null,
			lastError: null,
			settingsVersion: input.settingsVersion,
			status: input.status,
			userId: input.userId,
		} satisfies SignupGrantOutboxRow;
		this.rows.set(input.userId, row);

		return row;
	}

	async listPending(input: { limit: number; userId?: string }) {
		return [...this.rows.values()]
			.filter(
				(row) =>
					row.status === "pending" &&
					(input.userId === undefined || row.userId === input.userId),
			)
			.slice(0, input.limit);
	}

	async markDone(userId: string) {
		if (this.failMarkDoneOnce) {
			this.failMarkDoneOnce = false;
			throw new Error("mark done failed");
		}

		const row = this.expectRow(userId);
		row.attempts += 1;
		row.doneAt = new Date();
		row.lastError = null;
		row.status = "done";
	}

	async markFailed(userId: string, error: string) {
		const row = this.expectRow(userId);
		row.attempts += 1;
		row.lastError = error;
	}

	usersWithoutRow: string[] = [];

	async findUsersWithoutOutboxRow(input: { limit: number }) {
		return this.usersWithoutRow
			.filter((userId) => !this.rows.has(userId))
			.slice(0, input.limit);
	}

	async countSkipped(createdAfter?: Date) {
		return [...this.rows.values()].filter(
			(row) =>
				row.status === "skipped" &&
				(createdAfter === undefined || row.createdAt > createdAfter),
		).length;
	}

	async requeueSkipped(input: {
		createdAfter?: Date;
		credits: number;
		limit: number;
		settingsVersion: number;
	}) {
		let requeued = 0;

		for (const row of this.rows.values()) {
			if (
				row.status !== "skipped" ||
				(input.createdAfter !== undefined &&
					row.createdAt <= input.createdAfter) ||
				requeued >= input.limit
			) {
				continue;
			}

			row.status = "pending";
			row.credits = input.credits;
			row.settingsVersion = input.settingsVersion;
			row.lastError = null;
			requeued += 1;
		}

		return requeued;
	}

	private expectRow(userId: string) {
		const row = this.rows.get(userId);

		if (!row) {
			throw new Error("missing outbox row");
		}

		return row;
	}
}

class InMemorySignupCreditsService {
	readonly ledger = new Map<string, { amount: number; userId: string }>();
	readonly grantSignupCredits = vi.fn(
		async (userId: string, amount: number) => {
			if (this.failuresRemaining > 0) {
				this.failuresRemaining -= 1;
				throw new Error("ledger unavailable");
			}

			const key = `signup:${userId}`;
			const existing = this.ledger.get(key);

			if (
				existing &&
				(existing.userId !== userId || existing.amount !== amount)
			) {
				throw new Error("Credit grant idempotency replay conflict");
			}

			this.ledger.set(key, { amount, userId });

			return {};
		},
	);

	constructor(public failuresRemaining = 0) {}
}

function setup(
	input: {
		creditsFailures?: number;
		dispatcher?: TriggerSignupGrantDispatcherService;
		settings?: ProductSettings;
	} = {},
) {
	const repository = new InMemorySignupGrantOutboxRepository();
	const credits = new InMemorySignupCreditsService(input.creditsFailures);
	const settingsService = {
		get: vi.fn(async () => input.settings ?? settings()),
	} as unknown as ProductSettingsService;
	const outbox = new SignupGrantOutboxService(
		repository as unknown as SignupGrantOutboxRepository,
		credits as unknown as CreditsService,
		settingsService,
	);
	const signup = new SignupGrantsService(
		settingsService,
		outbox,
		input.dispatcher,
	);

	return { credits, outbox, repository, signup };
}

describe("signup grant outbox", () => {
	it("persists the pending row before inline delivery and marks it done on success", async () => {
		const { credits, outbox, repository, signup } = setup();
		const createSpy = vi.spyOn(repository, "create");
		const deliverSpy = vi.spyOn(outbox, "deliver");

		await expect(signup.handleUserCreated("user_1")).resolves.toBeUndefined();

		expect(createSpy.mock.invocationCallOrder[0]).toBeLessThan(
			deliverSpy.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
		expect(repository.rows.get("user_1")).toMatchObject({
			attempts: 1,
			credits: 20,
			lastError: null,
			settingsVersion: 1,
			status: "done",
		});
		expect(credits.grantSignupCredits).toHaveBeenCalledOnce();
	});

	it("logs a distinctive error and does not abort signup when outbox insertion fails", async () => {
		const triggerDelivery = vi.fn().mockResolvedValue(undefined);
		const dispatcher = {
			triggerDelivery,
		} as unknown as TriggerSignupGrantDispatcherService;
		const { credits, repository, signup } = setup({ dispatcher });
		repository.createError = new Error("database unavailable");
		const errorSpy = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);

		await expect(signup.handleUserCreated("user_1")).resolves.toBeUndefined();

		expect(errorSpy).toHaveBeenCalledWith(
			"SIGNUP_GRANT_OUTBOX_INSERT_FAILED userId=user_1",
			expect.stringContaining("database unavailable"),
		);
		expect(repository.rows.size).toBe(0);
		expect(credits.grantSignupCredits).not.toHaveBeenCalled();
		expect(triggerDelivery).not.toHaveBeenCalled();

		errorSpy.mockRestore();
	});

	it("keeps a pending outbox row when the inline hook grant fails", async () => {
		const { credits, repository, signup } = setup({ creditsFailures: 1 });

		await expect(signup.handleUserCreated("user_1")).resolves.toBeUndefined();

		expect(repository.rows.get("user_1")).toMatchObject({
			attempts: 1,
			credits: 20,
			lastError: "ledger unavailable",
			settingsVersion: 1,
			status: "pending",
		});
		expect(credits.ledger.size).toBe(0);
	});

	it("triggers an on-demand retry when inline delivery fails", async () => {
		const triggerDelivery = vi.fn().mockResolvedValue(undefined);
		const dispatcher = {
			triggerDelivery,
		} as unknown as TriggerSignupGrantDispatcherService;
		const { signup } = setup({ creditsFailures: 1, dispatcher });

		await signup.handleUserCreated("user:1");

		expect(triggerDelivery).toHaveBeenCalledWith("user:1");
	});

	it("keeps the durable row pending when the optional Trigger handoff fails", async () => {
		const triggerDelivery = vi
			.fn()
			.mockRejectedValue(new Error("Trigger unavailable"));
		const dispatcher = {
			triggerDelivery,
		} as unknown as TriggerSignupGrantDispatcherService;
		const { repository, signup } = setup({ creditsFailures: 1, dispatcher });
		const warning = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		await expect(signup.handleUserCreated("user_1")).resolves.toBeUndefined();

		expect(repository.rows.get("user_1")?.status).toBe("pending");
		expect(warning).toHaveBeenCalledWith(
			expect.stringContaining("scheduled sweep remains authoritative"),
		);
	});

	it("sweeps grants idempotently after a crash between grant and outbox completion", async () => {
		const { credits, outbox, repository } = setup();
		await outbox.create({
			credits: 20,
			settingsVersion: 1,
			status: "pending",
			userId: "user_1",
		});
		repository.failMarkDoneOnce = true;

		await expect(outbox.sweep("user_1")).resolves.toEqual({
			done: 0,
			failed: 1,
			healed: 0,
		});
		await expect(outbox.sweep("user_1")).resolves.toEqual({
			done: 1,
			failed: 0,
			healed: 0,
		});
		await expect(outbox.sweep("user_1")).resolves.toEqual({
			done: 0,
			failed: 0,
			healed: 0,
		});

		expect(credits.ledger).toEqual(
			new Map([["signup:user_1", { amount: 20, userId: "user_1" }]]),
		);
		expect(repository.rows.get("user_1")).toMatchObject({
			lastError: null,
			status: "done",
		});
	});

	it("records a skipped row without granting when signup grants are disabled", async () => {
		const { credits, repository, signup } = setup({
			settings: settings({ signupGrantEnabled: false }),
		});

		await signup.handleUserCreated("user_1");

		expect(repository.rows.get("user_1")).toMatchObject({ status: "skipped" });
		expect(credits.grantSignupCredits).not.toHaveBeenCalled();
	});

	it("self-heals missing outbox rows on the scheduled sweep, then drains them", async () => {
		const { credits, outbox, repository } = setup();
		repository.usersWithoutRow = ["user_lost", "user_lost_2"];

		await expect(outbox.sweep()).resolves.toEqual({
			done: 2,
			failed: 0,
			healed: 2,
		});
		expect(repository.rows.get("user_lost")).toMatchObject({
			credits: 20,
			settingsVersion: 1,
			status: "done",
		});
		expect(credits.grantSignupCredits).toHaveBeenCalledTimes(2);

		// Healing is idempotent: the rows exist now.
		await expect(outbox.sweep()).resolves.toEqual({
			done: 0,
			failed: 0,
			healed: 0,
		});
	});

	it("requeues skipped rows with the current grant size only on an explicit non-dry backfill", async () => {
		const { credits, repository, signup } = setup({
			settings: settings({ signupGrantEnabled: false, version: 3 }),
		});
		await signup.handleUserCreated("user_skipped");
		expect(repository.rows.get("user_skipped")).toMatchObject({
			status: "skipped",
		});

		const enabled = setup({
			settings: settings({ signupGrantCredits: 50, version: 4 }),
		});
		enabled.repository.rows.set(
			"user_skipped",
			repository.rows.get("user_skipped") as SignupGrantOutboxRow,
		);

		await expect(
			enabled.outbox.backfillSkipped({ dryRun: true }),
		).resolves.toEqual({ requeued: 0, skipped: 1 });
		expect(enabled.repository.rows.get("user_skipped")).toMatchObject({
			credits: 20,
			settingsVersion: 3,
			status: "skipped",
		});

		await expect(
			enabled.outbox.backfillSkipped({
				createdAfter: new Date("2026-08-02T00:00:00.000Z"),
				dryRun: false,
			}),
		).resolves.toEqual({ requeued: 0, skipped: 0 });

		await expect(
			enabled.outbox.backfillSkipped({ dryRun: false }),
		).resolves.toEqual({ requeued: 1, skipped: 1 });
		expect(enabled.repository.rows.get("user_skipped")).toMatchObject({
			credits: 50,
			settingsVersion: 4,
			status: "pending",
		});
		expect(credits.grantSignupCredits).not.toHaveBeenCalled();

		await enabled.outbox.sweep();
		expect(enabled.credits.grantSignupCredits).toHaveBeenCalledWith(
			"user_skipped",
			50,
		);
	});

	it("refuses a live backfill while the signup grant is disabled", async () => {
		const { outbox, repository, signup } = setup({
			settings: settings({ signupGrantEnabled: false }),
		});
		await signup.handleUserCreated("user_skipped");
		expect(repository.rows.get("user_skipped")?.status).toBe("skipped");

		await expect(outbox.backfillSkipped({ dryRun: false })).rejects.toThrow(
			"requires the signup grant to be enabled",
		);
	});
});
