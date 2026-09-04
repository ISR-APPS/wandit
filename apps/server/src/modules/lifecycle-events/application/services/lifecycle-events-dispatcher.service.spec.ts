import { Logger } from "@nestjs/common";
import type { ProductSettings } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailService } from "../../../email/application/services/email.service";
import type { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import type { LifecycleEventDropReason } from "../../domain/lifecycle-event";
import type {
	LifecycleDispatchContext,
	LifecycleEventRow,
} from "../../infrastructure/persistence/lifecycle-events.repository";
import { LifecycleEventsDispatcher } from "./lifecycle-events-dispatcher.service";

const NOW = new Date("2026-08-24T12:00:00.000Z");

describe("LifecycleEventsDispatcher", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("sweeps due rows sequentially and reports every outcome", async () => {
		const rows = [eventRow({ id: "evt-1" }), eventRow({ id: "evt-2" })];
		const harness = createHarness();
		harness.repository.listDue.mockResolvedValue(rows);
		const dispatch = vi
			.spyOn(harness.dispatcher, "dispatch")
			.mockResolvedValueOnce("dispatched")
			.mockResolvedValueOnce("failed");

		await expect(harness.dispatcher.sweep(17)).resolves.toEqual({
			dispatched: 1,
			dropped: 0,
			failed: 1,
		});
		expect(harness.repository.healMissingSignupEvents).toHaveBeenCalledOnce();
		expect(harness.repository.listDue).toHaveBeenCalledExactlyOnceWith(17);
		expect(
			harness.repository.healMissingSignupEvents.mock.invocationCallOrder[0],
		).toBeLessThan(
			harness.repository.listDue.mock.invocationCallOrder[0] ?? Number.NaN,
		);
		expect(dispatch.mock.calls.map(([row]) => row.id)).toEqual([
			"evt-1",
			"evt-2",
		]);
	});

	it("drops a pending row without loading user context when the switch is disabled", async () => {
		const row = eventRow();
		const harness = createHarness({ lifecycleEmailsEnabled: false });
		harness.track(row);

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("dropped");

		expect(harness.repository.markDropped).toHaveBeenCalledExactlyOnceWith(
			row.id,
			"disabled",
		);
		expect(row.droppedAt).toEqual(NOW);
		expect(row.dropReason).toBe("disabled");
		expect(harness.repository.loadDispatchContext).not.toHaveBeenCalled();
		expect(harness.email.sendLifecycleEvent).not.toHaveBeenCalled();
	});

	it.each([
		["missing user", null],
		[
			"blank canonical email",
			dispatchContext({ user: { email: "  ", name: "Amina" } }),
		],
	] as const)("drops rows with no deliverable email: %s", async (_label, context) => {
		const row = eventRow();
		const harness = createHarness({ context });

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("dropped");
		expect(harness.repository.markDropped).toHaveBeenCalledExactlyOnceWith(
			row.id,
			"no_email",
		);
		expect(harness.email.sendLifecycleEvent).not.toHaveBeenCalled();
	});

	it.each([
		[
			"personal entitlement",
			dispatchContext({
				entitledSubscription: {
					currentPeriodEnd: new Date("2026-09-24T12:00:00.000Z"),
					plan: "starter",
					provider: "stripe",
					status: "active",
				},
			}),
		],
		[
			"personal top-up history",
			dispatchContext({ hasPersonalTopupReceipt: true }),
		],
		[
			"open personal manual request",
			dispatchContext({ hasOpenPersonalManualRequest: true }),
		],
	] as const)("drops a free-only event for a user with %s", async (_label, context) => {
		const row = eventRow({ event: "credits_25_used" });
		const harness = createHarness({ context });

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("dropped");
		expect(harness.repository.markDropped).toHaveBeenCalledExactlyOnceWith(
			row.id,
			"not_free",
		);
		expect(harness.email.sendLifecycleEvent).not.toHaveBeenCalled();
	});

	it("still dispatches milestone events to a paid user", async () => {
		const row = eventRow({
			event: "website_generated",
			payload: {
				done_landing_page: false,
				first_name: "stale",
				plan: "free",
				surface: "capture-value",
			},
		});
		const harness = createHarness({
			context: dispatchContext({
				capturedEvents: ["landing_page_generated"],
				entitledSubscription: {
					currentPeriodEnd: new Date("2026-09-24T12:00:00.000Z"),
					plan: "business",
					provider: "manual",
					status: "trialing",
				},
				user: { email: "canonical@example.com", name: "  Amina Benali  " },
			}),
		});

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("dispatched");
		expect(harness.email.sendLifecycleEvent).toHaveBeenCalledExactlyOnceWith({
			email: "canonical@example.com",
			event: "website_generated",
			payload: {
				done_landing_page: true,
				first_name: "Amina",
				plan: "business",
				surface: "capture-value",
			},
		});
	});

	it.each([
		["website_generated", "landing_page_generated", "done_landing_page"],
		["landing_page_generated", "image_generated", "done_image"],
		["image_generated", "marketing_strategy_generated", "done_strategy"],
		["marketing_strategy_generated", "ads_connected", "done_ads_connected"],
		["ads_connected", "ads_analysis_completed", "done_analysis"],
		["ads_analysis_completed", "campaign_launched", "done_campaign"],
	] as const)("computes the done flag for %s from captured %s history", async (event, doneEvent, payloadKey) => {
		const row = eventRow({ event, payload: { [payloadKey]: false } });
		const harness = createHarness({
			context: dispatchContext({ capturedEvents: [doneEvent] }),
		});

		await harness.dispatcher.dispatch(row);

		const call = harness.email.sendLifecycleEvent.mock.calls[0]?.[0];
		expect(call?.payload[payloadKey]).toBe(true);
	});

	it("writes a false done flag when the later milestone has not been captured", async () => {
		const row = eventRow({
			event: "image_generated",
			payload: { done_strategy: true },
		});
		const harness = createHarness({
			context: dispatchContext({ capturedEvents: [] }),
		});

		await harness.dispatcher.dispatch(row);

		const call = harness.email.sendLifecycleEvent.mock.calls[0]?.[0];
		expect(call?.payload.done_strategy).toBe(false);
	});

	it.each([
		[false, false, false],
		[true, false, true],
		[false, true, true],
	] as const)("computes skip_activation from any first-prompt row (%s) or an accepted invitation (%s)", async (hasFirstPromptEvent, acceptedInvitation, expected) => {
		const row = eventRow({ event: "signup_completed" });
		const harness = createHarness({
			context: dispatchContext({
				acceptedInvitation,
				capturedEvents: [],
				hasFirstPromptEvent,
			}),
		});

		await harness.dispatcher.dispatch(row);

		const call = harness.email.sendLifecycleEvent.mock.calls[0]?.[0];
		expect(call?.payload.skip_activation).toBe(expected);
		expect(call?.payload.FREE_CREDITS).toBe(20);
	});

	it("sends the current signup grant count in whole credits and ignores captured overrides", async () => {
		const row = eventRow({
			event: "signup_completed",
			payload: { FREE_CREDITS: 50 },
		});
		const harness = createHarness({ signupGrantCredits: 900 });

		await harness.dispatcher.dispatch(row);

		const call = harness.email.sendLifecycleEvent.mock.calls[0]?.[0];
		expect(call?.payload.FREE_CREDITS).toBe(9);
	});

	it("omits first_name when the canonical user name is empty", async () => {
		const row = eventRow({
			event: "first_prompt_sent",
			payload: { first_name: "captured name", plan: "business" },
		});
		const harness = createHarness({
			context: dispatchContext({
				user: { email: "user@example.com", name: "  " },
			}),
		});

		await harness.dispatcher.dispatch(row);

		expect(harness.email.sendLifecycleEvent).toHaveBeenCalledExactlyOnceWith({
			email: "user@example.com",
			event: "first_prompt_sent",
			payload: { plan: "free" },
		});
	});

	it("keeps a failed send pending and stores a truncated retry error", async () => {
		const row = eventRow({ attempts: 2 });
		const harness = createHarness();
		harness.track(row);
		harness.email.sendLifecycleEvent.mockRejectedValue(
			new Error(`provider failure: ${"x".repeat(2_100)}`),
		);

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("failed");

		expect(row.attempts).toBe(3);
		expect(row.lastError).toHaveLength(2_000);
		expect(row.lastError).toMatch(/^provider failure:/u);
		expect(row.dispatchedAt).toBeNull();
		expect(row.droppedAt).toBeNull();
	});

	it("marks a successful send dispatched only after Resend accepts it", async () => {
		const row = eventRow({ attempts: 3, lastError: "earlier failure" });
		const harness = createHarness();
		harness.track(row);

		await expect(harness.dispatcher.dispatch(row)).resolves.toBe("dispatched");

		expect(harness.email.sendLifecycleEvent).toHaveBeenCalledTimes(1);
		expect(harness.repository.markDispatched).toHaveBeenCalledExactlyOnceWith(
			row.id,
		);
		expect(row.attempts).toBe(4);
		expect(row.lastError).toBeNull();
		expect(row.dispatchedAt).toEqual(NOW);
	});
});

function eventRow(
	overrides: Partial<LifecycleEventRow> = {},
): LifecycleEventRow {
	return {
		attempts: 0,
		createdAt: new Date("2026-08-24T11:00:00.000Z"),
		dispatchAfter: new Date("2026-08-24T11:00:00.000Z"),
		dispatchedAt: null,
		dropReason: null,
		droppedAt: null,
		event: "first_prompt_sent",
		id: "event-id",
		idempotencyKey: "first_prompt_sent:user-id",
		lastError: null,
		payload: {},
		userId: "user-id",
		...overrides,
	};
}

function dispatchContext(
	overrides: Partial<LifecycleDispatchContext> = {},
): LifecycleDispatchContext {
	return {
		acceptedInvitation: false,
		capturedEvents: [],
		entitledSubscription: null,
		hasFirstPromptEvent: false,
		hasOpenPersonalManualRequest: false,
		hasPersonalTopupReceipt: false,
		user: { email: "canonical@example.com", name: "Amina Benali" },
		...overrides,
	};
}

function productSettings(
	lifecycleEmailsEnabled: boolean,
	signupGrantCredits = 2000,
): ProductSettings {
	return {
		dzdPerUsdRate: 27_000,
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled,
		manualGraceDays: 0,
		manualPaymentsEnabled: false,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: false,
		signupGrantCredits,
		signupGrantEnabled: false,
		topupsEnabled: false,
		updatedAt: NOW.toISOString(),
		updatedByUserId: null,
		version: 1,
	};
}

function createHarness(
	input: {
		context?: LifecycleDispatchContext | null;
		lifecycleEmailsEnabled?: boolean;
		signupGrantCredits?: number;
	} = {},
) {
	const trackedRows = new Map<string, LifecycleEventRow>();
	const context =
		input.context === undefined ? dispatchContext() : input.context;
	const repository = {
		healMissingSignupEvents: vi.fn(async (): Promise<number> => 0),
		listDue: vi.fn(
			async (_limit: number, _now?: Date): Promise<LifecycleEventRow[]> => [],
		),
		loadDispatchContext: vi.fn(
			async (
				_userId: string,
				_now?: Date,
			): Promise<LifecycleDispatchContext | null> => context,
		),
		markDispatched: vi.fn(
			async (id: string, at = new Date()): Promise<void> => {
				const row = trackedRows.get(id);

				if (row) {
					row.attempts += 1;
					row.dispatchedAt = at;
					row.lastError = null;
				}
			},
		),
		markDropped: vi.fn(
			async (
				id: string,
				reason: LifecycleEventDropReason,
				at = new Date(),
			): Promise<void> => {
				const row = trackedRows.get(id);

				if (row) {
					row.dropReason = reason;
					row.droppedAt = at;
				}
			},
		),
		markFailed: vi.fn(async (id: string, error: string): Promise<void> => {
			const row = trackedRows.get(id);

			if (row) {
				row.attempts += 1;
				row.lastError = error;
			}
		}),
	};
	const settings = {
		get: vi.fn(
			async (): Promise<ProductSettings> =>
				productSettings(
					input.lifecycleEmailsEnabled ?? true,
					input.signupGrantCredits,
				),
		),
	} satisfies Pick<ProductSettingsService, "get">;
	const email = {
		sendLifecycleEvent: vi.fn(
			async (
				_input: Parameters<EmailService["sendLifecycleEvent"]>[0],
			): Promise<void> => {},
		),
	} satisfies Pick<EmailService, "sendLifecycleEvent">;
	const dispatcher = new LifecycleEventsDispatcher(repository, settings, email);

	return {
		dispatcher,
		email,
		repository,
		track(row: LifecycleEventRow) {
			trackedRows.set(row.id, row);
		},
	};
}
