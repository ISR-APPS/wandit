import {
	ConflictException,
	HttpException,
	NotFoundException,
} from "@nestjs/common";
import {
	type BillingPlanId,
	startDeviceSessionResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../../billing/infrastructure/persistence/subscriptions.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { DeviceSessionLock } from "../../domain/ports/device-session-lock";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import type {
	DeviceSessionRow,
	DeviceSessionsRepository,
} from "../../infrastructure/persistence/device-sessions.repository";
import type { PreviewProxyClient } from "../../infrastructure/preview-proxy/preview-proxy.client";
import { DeviceSessionsService } from "./device-sessions.service";
import type { PreviewTokenService } from "./preview-token.service";

const PROJECT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const EXPO_URL = `exps://m-abcdefghijklmnopqrs27--p-${PROJECT_ID}.wanditpreview.app`;
const NOW = new Date("2026-09-25T00:00:00.000Z");

const MOBILE_PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "mobile-app",
	id: PROJECT_ID,
	organizationId: null,
	templateVersion: "mobile-app@1.0.0",
	userId: "user-1",
};

// Copy of the fixture in `backends.service.spec.ts`: a spec must not
// import from another spec file.
function subscriptionRow(plan: BillingPlanId): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: NOW,
		currentPeriodEnd: NOW,
		currentPeriodStart: NOW,
		id: "sub_1",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan,
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_stripe_1",
		status: "active",
		tierCredits: 250,
		updatedAt: NOW,
		userId: "user-1",
	};
}

/** An in-memory lock with the SET NX and compare-and-delete rules. */
function fakeLock() {
	const holders = new Map<string, string>();
	const lock: DeviceSessionLock = {
		acquire: async (userId, deviceSessionId) => {
			if (holders.has(userId)) return false;
			holders.set(userId, deviceSessionId);
			return true;
		},
		release: async (userId, deviceSessionId) => {
			if (holders.get(userId) !== deviceSessionId) return false;
			holders.delete(userId);
			return true;
		},
	};
	return { holders, lock };
}

function setup(options?: {
	project?: ScopedAppProject | null;
	plan?: BillingPlanId | null;
	usedMinutes?: number;
	metroRunning?: boolean;
}) {
	const rows = new Map<string, DeviceSessionRow>();
	const sessions = {
		insertOpen: vi.fn<DeviceSessionsRepository["insertOpen"]>(async (input) => {
			const row: DeviceSessionRow = {
				...input,
				appetizeSessionToken: null,
				billedAt: null,
				createdAt: NOW,
				endedAt: null,
				minutes: null,
				startedAt: NOW,
				updatedAt: NOW,
			};
			rows.set(row.id, row);
			return row;
		}),
		findStartedBy: vi.fn<DeviceSessionsRepository["findStartedBy"]>(
			async (id, userId, projectId) => {
				const row = rows.get(id);
				return row?.userId === userId && row.projectId === projectId
					? row
					: null;
			},
		),
		end: vi.fn<DeviceSessionsRepository["end"]>(async () => undefined),
		usedMinutesSince: vi.fn<DeviceSessionsRepository["usedMinutesSince"]>(
			async () => options?.usedMinutes ?? 0,
		),
	};
	const { holders, lock } = fakeLock();
	const previewTokens = {
		mint: vi.fn<PreviewTokenService["mint"]>(async () => ({
			expiresAt: "2026-09-25T00:15:00.000Z",
			previewUrl: `https://r-111111111111--p-${PROJECT_ID}.wanditpreview.app/?wt=tok`,
			token: "tok",
		})),
	};
	const previewProxy = {
		mintPhoneLink: vi.fn<PreviewProxyClient["mintPhoneLink"]>(async () => ({
			expiresAt: "2026-09-25T01:00:00.000Z",
			expoUrl: EXPO_URL,
		})),
		isMetroRunning: vi.fn<PreviewProxyClient["isMetroRunning"]>(
			async () => options?.metroRunning ?? true,
		),
	};
	const plan = options?.plan === undefined ? "pro" : options.plan;
	const subscriptions = {
		findActiveByOwner: vi.fn<SubscriptionsRepository["findActiveByOwner"]>(
			async () => (plan === null ? null : subscriptionRow(plan)),
		),
	};
	const env: V2EnvSource = {
		APPETIZE_ANDROID_PUBLIC_KEY: "pk-android",
		APPETIZE_IOS_PUBLIC_KEY: "pk-ios",
		V2_HARNESS: "claude-code",
	};
	const service = new DeviceSessionsService(
		{
			findScopedProject: async () =>
				options?.project === undefined ? MOBILE_PROJECT : options.project,
		},
		sessions,
		lock,
		previewTokens,
		previewProxy,
		subscriptions,
		env,
	);
	return { holders, previewProxy, previewTokens, rows, service, sessions };
}

/** The `code` of the body of a Nest HTTP exception. */
function codeOf(error: unknown): unknown {
	if (!(error instanceof HttpException)) return undefined;
	const body = error.getResponse();
	return typeof body === "object" && "code" in body ? body.code : undefined;
}

describe("DeviceSessionsService.start", () => {
	it("mints a phone link, locks the user, inserts the row, and answers the Appetize config", async () => {
		const { holders, previewTokens, rows, service } = setup();

		const answer = startDeviceSessionResponseSchema.parse(
			await service.start(SCOPE, PROJECT_ID, "android"),
		);

		expect(answer).toMatchObject({
			device: "pixel8",
			launchUrl: EXPO_URL,
			osVersion: "14.0",
			publicKey: "pk-android",
			timeLimitSeconds: 900,
		});
		expect(previewTokens.mint).toHaveBeenCalledWith(SCOPE, PROJECT_ID, {
			client: "phone",
		});
		expect(rows.get(answer.deviceSessionId)).toMatchObject({
			platform: "android",
			projectId: PROJECT_ID,
			userId: "user-1",
		});
		expect(holders.get("user-1")).toBe(answer.deviceSessionId);
	});

	it("answers 402 DEVICE_MINUTES_EXHAUSTED for a free payer and for a spent Pro month", async () => {
		const free = setup({ plan: null });
		const spent = setup({ plan: "pro", usedMinutes: 60 });

		const freeFailure = await free.service
			.start(SCOPE, PROJECT_ID, "ios")
			.catch((error: unknown) => error);
		const spentFailure = await spent.service
			.start(SCOPE, PROJECT_ID, "ios")
			.catch((error: unknown) => error);

		for (const failure of [freeFailure, spentFailure]) {
			expect(failure).toBeInstanceOf(HttpException);
			expect(failure).toMatchObject({ status: 402 });
			expect(codeOf(failure)).toBe("DEVICE_MINUTES_EXHAUSTED");
		}
		expect(free.holders.size).toBe(0);
		expect(spent.rows.size).toBe(0);
	});

	it("refuses a second open session of the same user with 409 DEVICE_SESSION_OPEN", async () => {
		const { service } = setup();
		await service.start(SCOPE, PROJECT_ID, "ios");

		const failure = await service
			.start(SCOPE, PROJECT_ID, "android")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		expect(codeOf(failure)).toBe("DEVICE_SESSION_OPEN");
	});

	it("answers 409 METRO_NOT_READY, inserts no row, and frees the lock", async () => {
		const { holders, rows, service } = setup({ metroRunning: false });

		const failure = await service
			.start(SCOPE, PROJECT_ID, "ios")
			.catch((error: unknown) => error);

		expect(codeOf(failure)).toBe("METRO_NOT_READY");
		expect(rows.size).toBe(0);
		expect(holders.size).toBe(0);
	});

	it("answers 404 for a web project, before any minute or lock work", async () => {
		const { holders, service, sessions } = setup({
			project: { ...MOBILE_PROJECT, framework: "web-app" },
		});

		await expect(
			service.start(SCOPE, PROJECT_ID, "ios"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(sessions.usedMinutesSince).not.toHaveBeenCalled();
		expect(holders.size).toBe(0);
	});
});

describe("DeviceSessionsService.end", () => {
	it("stores the Appetize token, frees the lock, and lets the user start again", async () => {
		const { holders, service, sessions } = setup();
		const started = await service.start(SCOPE, PROJECT_ID, "ios");

		await expect(
			service.end(SCOPE, PROJECT_ID, started.deviceSessionId, "tok_1"),
		).resolves.toEqual({ ended: true });

		expect(sessions.end).toHaveBeenCalledWith(
			started.deviceSessionId,
			"tok_1",
			expect.any(Date),
		);
		expect(holders.size).toBe(0);
		await expect(service.start(SCOPE, PROJECT_ID, "ios")).resolves.toBeTruthy();
	});

	it("answers 404 for a session of another user", async () => {
		const { service } = setup();
		const started = await service.start(SCOPE, PROJECT_ID, "ios");

		await expect(
			service.end(
				{ kind: "personal", userId: "user-2" },
				PROJECT_ID,
				started.deviceSessionId,
				undefined,
			),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("answers 409 APPETIZE_SESSION_TAKEN when another row holds the token", async () => {
		const { service, sessions } = setup();
		const started = await service.start(SCOPE, PROJECT_ID, "ios");
		sessions.end.mockRejectedValueOnce(
			Object.assign(new Error("duplicate key"), { code: "23505" }),
		);

		const failure = await service
			.end(SCOPE, PROJECT_ID, started.deviceSessionId, "tok_taken")
			.catch((error: unknown) => error);

		expect(codeOf(failure)).toBe("APPETIZE_SESSION_TAKEN");
	});
});
