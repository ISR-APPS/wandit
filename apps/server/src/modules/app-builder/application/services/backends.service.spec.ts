import type { BillingPlanId } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../../billing/infrastructure/persistence/subscriptions.repository";
import { BackendLimitReachedError } from "../../domain/errors/backend-limit-reached.error";
import type { ProvisionBackendTaskStarter } from "../../domain/ports/provision-backend-task-starter";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type {
	AppBackendRow,
	AppBackendsRepository,
} from "../../infrastructure/persistence/app-backends.repository";
import { BackendsService } from "./backends.service";

const INPUT = {
	countryCode: "DE",
	organizationId: null,
	userId: "user-1",
} as const;

function backendRow(overrides: Partial<AppBackendRow> = {}): AppBackendRow {
	return {
		anonKey: null,
		dbHost: null,
		failureCode: null,
		id: "backend-1",
		orgId: null,
		organizationId: null,
		projectId: "project-1",
		ref: null,
		region: "eu-west-3",
		requestKey: "request-1",
		status: "creating",
		triggerRunId: null,
		userId: "user-1",
		...overrides,
	};
}

const NOW = new Date("2026-09-25T00:00:00.000Z");

// Copy of the fixture in `resolve-billing-plan.spec.ts`: a spec must not
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

function setup(envOverrides: Partial<V2EnvSource> = {}) {
	// The payer's owned backends the locked insert counts; a spec sets it.
	const owned = { count: 0 };
	const backends = {
		findByProjectId: vi.fn<AppBackendsRepository["findByProjectId"]>(
			async () => null,
		),
		// Like the repository: runs the plan rule on the count, then inserts.
		insertCreatingWithinLimit: vi.fn<
			AppBackendsRepository["insertCreatingWithinLimit"]
		>(async (input, _owner, check) => {
			const entitlement = check(owned.count);
			return entitlement.allowed
				? { kind: "inserted", row: backendRow({ ...input }) }
				: { kind: "refused", refusal: entitlement };
		}),
		markError: vi.fn<AppBackendsRepository["markError"]>(async () => undefined),
		setTriggerRunId: vi.fn<AppBackendsRepository["setTriggerRunId"]>(
			async () => undefined,
		),
	};
	const starter = {
		start: vi.fn<ProvisionBackendTaskStarter["start"]>(async () => ({
			runId: "run-1",
		})),
	};
	const v2Env: V2EnvSource = {
		SUPABASE_PLATFORM_ORG_ID: "org-slug",
		SUPABASE_PLATFORM_TOKEN: "token",
		V2_HARNESS: "claude-code",
		...envOverrides,
	};

	// Default: a Pro payer, so the first backend passes the D3 entitlement.
	const subscriptions = {
		findActiveByOwner: vi.fn<SubscriptionsRepository["findActiveByOwner"]>(
			async () => subscriptionRow("pro"),
		),
	};

	const service = new BackendsService(backends, starter, v2Env, subscriptions);

	return { backends, owned, service, starter, subscriptions };
}

describe("BackendsService.provisionBackend", () => {
	it("answers null and writes nothing when the platform token is unset", async () => {
		const { backends, service, starter } = setup({
			SUPABASE_PLATFORM_TOKEN: undefined,
		});

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBeNull();
		expect(backends.findByProjectId).not.toHaveBeenCalled();
		expect(backends.insertCreatingWithinLimit).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers null when the platform org id is unset", async () => {
		const { backends, service, starter } = setup({
			SUPABASE_PLATFORM_ORG_ID: undefined,
		});

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBeNull();
		expect(backends.insertCreatingWithinLimit).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers the existing row and starts nothing on a second call", async () => {
		const { backends, service, starter } = setup();
		const existing = backendRow({ status: "active" });
		backends.findByProjectId.mockResolvedValue(existing);

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(existing);
		expect(backends.insertCreatingWithinLimit).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("provisions when the owner is under the plan limit", async () => {
		const { backends, service, starter } = setup();

		await service.provisionBackend("project-1", INPUT);

		expect(backends.insertCreatingWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: "project-1" }),
			{ type: "user", userId: "user-1" },
			expect.any(Function),
		);
		expect(starter.start).toHaveBeenCalledTimes(1);
	});

	it("refuses at the plan limit with BACKEND_LIMIT_REACHED and starts nothing", async () => {
		const { owned, service, starter } = setup();
		owned.count = 1;

		const failure = await service
			.provisionBackend("project-1", INPUT)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(BackendLimitReachedError);
		// SAFETY: toBeInstanceOf above proves the type.
		const refusal = failure as BackendLimitReachedError;
		expect(refusal.getStatus()).toBe(403);
		expect(refusal.getResponse()).toEqual({
			code: "BACKEND_LIMIT_REACHED",
			message: "Backend limit reached: the pro plan allows 1",
		});
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("refuses a starter payer and admits a business payer with the same count", async () => {
		const starterPayer = setup();
		starterPayer.subscriptions.findActiveByOwner.mockResolvedValue(null);
		starterPayer.owned.count = 2;

		await expect(
			starterPayer.service.provisionBackend("project-1", INPUT),
		).rejects.toBeInstanceOf(BackendLimitReachedError);
		expect(starterPayer.starter.start).not.toHaveBeenCalled();

		const businessPayer = setup();
		businessPayer.subscriptions.findActiveByOwner.mockResolvedValue(
			subscriptionRow("business"),
		);
		businessPayer.owned.count = 2;

		await businessPayer.service.provisionBackend("project-1", INPUT);

		expect(businessPayer.starter.start).toHaveBeenCalledTimes(1);
	});

	it("counts and reads the plan of the org for an org project", async () => {
		const { backends, service, subscriptions } = setup();

		await service.provisionBackend("project-1", {
			...INPUT,
			organizationId: "org-1",
		});

		expect(backends.insertCreatingWithinLimit.mock.calls[0]?.[1]).toEqual({
			organizationId: "org-1",
			type: "org",
		});
		expect(subscriptions.findActiveByOwner).toHaveBeenCalledWith({
			organizationId: "org-1",
			type: "org",
		});
	});

	it("inserts eu-central-1 for a German user and starts the task", async () => {
		const { backends, service, starter } = setup();

		const row = await service.provisionBackend("project-1", INPUT);

		const inserted = backends.insertCreatingWithinLimit.mock.calls[0]?.[0];
		if (!inserted) {
			throw new Error("insertCreatingWithinLimit was not called");
		}
		expect(inserted).toMatchObject({
			organizationId: null,
			projectId: "project-1",
			region: "eu-central-1",
			userId: "user-1",
		});
		expect(inserted.requestKey).toMatch(/^[0-9a-f-]{36}$/u);
		expect(starter.start).toHaveBeenCalledWith({
			projectId: "project-1",
			requestKey: inserted.requestKey,
		});
		expect(backends.setTriggerRunId).toHaveBeenCalledWith("project-1", "run-1");
		expect(row).toMatchObject({ requestKey: inserted.requestKey });
	});

	it("lets SUPABASE_PLATFORM_REGION override the picked region", async () => {
		const { backends, service } = setup({
			SUPABASE_PLATFORM_REGION: "eu-west-1",
		});

		await service.provisionBackend("project-1", INPUT);

		expect(backends.insertCreatingWithinLimit.mock.calls[0]?.[0]).toMatchObject(
			{
				region: "eu-west-1",
			},
		);
	});

	it("inserts the picked region when the override is invalid", async () => {
		const { backends, service } = setup({
			SUPABASE_PLATFORM_REGION: "moon-1",
		});

		await service.provisionBackend("project-1", INPUT);

		expect(backends.insertCreatingWithinLimit.mock.calls[0]?.[0]).toMatchObject(
			{
				region: "eu-central-1",
			},
		);
	});

	it("answers the winner's row and starts nothing when a concurrent create won", async () => {
		const { backends, service, starter } = setup();
		const winner = backendRow({ requestKey: "other-key" });
		backends.insertCreatingWithinLimit.mockResolvedValue({
			kind: "exists",
			row: winner,
		});

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(winner);
		expect(starter.start).not.toHaveBeenCalled();
		expect(backends.setTriggerRunId).not.toHaveBeenCalled();
	});

	it("throws and starts nothing when the insert throws", async () => {
		const { backends, service, starter } = setup();
		backends.insertCreatingWithinLimit.mockRejectedValue(
			new Error("app_backends insert returned no row for project project-1"),
		);

		await expect(service.provisionBackend("project-1", INPUT)).rejects.toThrow(
			"app_backends insert returned no row for project project-1",
		);
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("marks the row backend_provision_start_failed and answers it when the start throws", async () => {
		const { backends, service, starter } = setup();
		const failed = backendRow({
			failureCode: "backend_provision_start_failed",
			status: "error",
		});
		backends.findByProjectId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(failed);
		starter.start.mockRejectedValue(new Error("trigger down"));

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(failed);
		expect(backends.markError).toHaveBeenCalledWith("project-1", {
			error: "trigger down",
			failureCode: "backend_provision_start_failed",
			failureKind: "internal",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "task",
			sentryEventId: null,
		});
		expect(backends.setTriggerRunId).not.toHaveBeenCalled();
	});
});
