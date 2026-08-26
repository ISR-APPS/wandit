import "reflect-metadata";

import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";
import type { Auth, CreateAuthOptions } from "@wandit/auth";
import type { GenericEndpointContext, User } from "better-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_INSTANCE } from "./auth.constants";
import { AuthModule } from "./auth.module";

const { createAuthMock } = vi.hoisted(() => ({
	createAuthMock: vi.fn(),
}));

vi.mock("@wandit/auth", async (importOriginal) => {
	const original = await importOriginal<typeof import("@wandit/auth")>();
	return { ...original, createAuth: createAuthMock };
});

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function setupHook() {
	const affiliateAttribution = {
		lockForCreatedUser: vi.fn().mockResolvedValue(undefined),
	};
	const utmAttribution = {
		lockForCreatedUser: vi.fn().mockResolvedValue(undefined),
	};
	const signupGrants = {
		handleUserCreated: vi.fn().mockResolvedValue(undefined),
	};
	const lifecycleEvents = {
		enqueue: vi.fn().mockResolvedValue(null),
	};
	const analytics = { capture: vi.fn() };
	const providers = Reflect.getMetadata("providers", AuthModule) as Provider[];
	const provider = providers.find(
		(candidate) =>
			typeof candidate === "object" &&
			candidate !== null &&
			"provide" in candidate &&
			candidate.provide === AUTH_INSTANCE,
	) as FactoryProvider<Auth> | undefined;

	if (!provider) {
		throw new Error("Auth factory provider is missing");
	}

	provider.useFactory(
		affiliateAttribution,
		utmAttribution,
		signupGrants,
		lifecycleEvents,
		{},
		analytics,
		{ get: vi.fn() },
		{},
		{},
		{},
	);

	const options = createAuthMock.mock.calls.at(-1)?.[0] as
		| CreateAuthOptions
		| undefined;
	if (!options?.onUserCreated) {
		throw new Error("Auth user-created hook is missing");
	}

	return {
		analytics,
		lifecycleEvents,
		onUserCreated: options.onUserCreated,
		signupGrants,
	};
}

const user = {
	email: "new-user@example.com",
	id: "user_1",
} as User;
const context = null as GenericEndpointContext | null;

describe("AuthModule user-created hook", () => {
	it("enqueues signup_completed after analytics with a ten-minute hold", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-24T10:00:00.000Z"));
		const { analytics, lifecycleEvents, onUserCreated, signupGrants } =
			setupHook();

		await onUserCreated(user, context);

		expect(analytics.capture).toHaveBeenCalledWith("user_1", "user_signed_up");
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			dispatchAfter: new Date("2026-08-24T10:10:00.000Z"),
			event: "signup_completed",
			idempotencyKey: "signup_completed:user_1",
			userId: "user_1",
		});
		expect(analytics.capture.mock.invocationCallOrder[0]).toBeLessThan(
			lifecycleEvents.enqueue.mock.invocationCallOrder[0] ?? 0,
		);
		expect(signupGrants.handleUserCreated).toHaveBeenCalledWith("user_1");
	});

	it("continues signup when lifecycle enqueue fails", async () => {
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { lifecycleEvents, onUserCreated, signupGrants } = setupHook();
		const enqueueError = new Error("lifecycle unavailable");
		lifecycleEvents.enqueue.mockRejectedValueOnce(enqueueError);

		await expect(onUserCreated(user, context)).resolves.toBeUndefined();

		expect(logError).toHaveBeenCalledWith(
			"Signup lifecycle event enqueue failed",
			enqueueError,
		);
		expect(signupGrants.handleUserCreated).toHaveBeenCalledWith("user_1");
	});
});
