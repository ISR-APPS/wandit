import { ConflictException, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type {
	CreateManualSubscriptionRequestBody,
	ProductSettings,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	ADMIN_EMAILS: undefined as string | undefined,
	ADMIN_ORIGIN: "https://admin.example.com" as string | undefined,
	CORS_ORIGIN: "https://app.example.com",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type { EmailService } from "../../../email/application/services/email.service";
import type { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import {
	ManualRequestPendingError,
	NoActiveManualRequestError,
} from "../../domain/errors/manual-billing.errors";
import type {
	ManualSubscriptionRequestRow,
	ManualSubscriptionRequestsRepository,
} from "../../infrastructure/persistence/manual-subscription-requests.repository";
import type { SubscriptionCreditsRepository } from "../../infrastructure/persistence/subscription-credits.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { ManualSubscriptionRequestsService } from "./manual-subscription-requests.service";

const NOW = new Date("2026-08-21T10:30:00.000Z");
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const user = { id: "user_1" } as AuthUser;
const personalWorkspace = { kind: "personal" } satisfies WorkspaceContext;

const body: CreateManualSubscriptionRequestBody = {
	city: "Algiers",
	company: "Example SARL",
	country: "DZ",
	fullName: "Amina Example",
	interval: "month",
	notes: "Call after 4 PM",
	phone: "+213 661 22 33 44",
	plan: "pro",
	preferredPaymentMethod: "ccp",
	tierCredits: 500,
};

function requestRow(
	overrides: Partial<ManualSubscriptionRequestRow> = {},
): ManualSubscriptionRequestRow {
	return {
		adminNotes: null,
		city: body.city ?? null,
		company: body.company ?? null,
		country: body.country,
		createdAt: NOW,
		fullName: body.fullName,
		handledAt: null,
		handledByUserId: null,
		id: REQUEST_ID,
		interval: body.interval,
		notes: body.notes ?? null,
		organizationId: null,
		phone: body.phone,
		plan: body.plan,
		preferredPaymentMethod: body.preferredPaymentMethod ?? null,
		status: "pending",
		subscriptionId: null,
		tierCredits: body.tierCredits,
		updatedAt: NOW,
		userId: user.id,
		...overrides,
	};
}

function subscriptionRow(provider: "manual" | "stripe"): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: NOW,
		currentPeriodEnd: new Date("2026-09-21T10:30:00.000Z"),
		currentPeriodStart: NOW,
		id: "22222222-2222-4222-8222-222222222222",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_500_month",
		provider,
		providerSubscriptionId: `${provider}_subscription_1`,
		status: "active",
		tierCredits: 500,
		updatedAt: NOW,
		userId: user.id,
	};
}

function productSettings(
	overrides: Partial<ProductSettings> = {},
): ProductSettings {
	return {
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: true,
		organizationsEnabled: true,
		paidSubscriptionsEnabled: true,
		signupGrantCredits: 50,
		signupGrantEnabled: true,
		topupsEnabled: true,
		updatedAt: NOW.toISOString(),
		updatedByUserId: null,
		version: 1,
		...overrides,
	};
}

function setup(
	options: {
		openRequest?: ManualSubscriptionRequestRow | null;
		settings?: ProductSettings;
		subscription?: SubscriptionRow | null;
	} = {},
) {
	let openRequest = options.openRequest ?? null;
	const transaction = { kind: "manual-request-transaction" };
	const requests = {
		cancelOpenByOwner: vi.fn(async () => {
			if (!openRequest) {
				return null;
			}

			openRequest = { ...openRequest, status: "canceled", updatedAt: NOW };
			return openRequest;
		}),
		findOpenByOwner: vi.fn(async () => openRequest),
		insert: vi.fn(async (input: Record<string, unknown>) => {
			openRequest = requestRow(input as Partial<ManualSubscriptionRequestRow>);
			return openRequest;
		}),
	};
	const subscriptions = {
		findActiveByOwner: vi.fn(async () => options.subscription ?? null),
	};
	const ownerLock = {
		withOwnerLock: vi.fn(
			async <T>(
				_owner: CreditOwner,
				operation: (tx: unknown) => Promise<T>,
			): Promise<T> => operation(transaction),
		),
	};
	const settings = {
		get: vi.fn(async () => options.settings ?? productSettings()),
	};
	const email = {
		isDeliverable: vi.fn(() => false),
		sendManualRequestEmail: vi.fn(async () => undefined),
	};
	const analytics = { capture: vi.fn() };
	const service = new ManualSubscriptionRequestsService(
		requests as unknown as ManualSubscriptionRequestsRepository,
		subscriptions as unknown as SubscriptionsRepository,
		ownerLock as unknown as SubscriptionCreditsRepository,
		settings as unknown as ProductSettingsService,
		email as unknown as EmailService,
		analytics as unknown as AnalyticsService,
	);

	return {
		analytics,
		email,
		ownerLock,
		requests,
		service,
		settings,
		subscriptions,
		transaction,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockEnv.ADMIN_EMAILS = undefined;
	mockEnv.ADMIN_ORIGIN = "https://admin.example.com";
});

describe("ManualSubscriptionRequestsService", () => {
	it("rejects creation when offline payments are disabled", async () => {
		const { ownerLock, service } = setup({
			settings: productSettings({ manualPaymentsEnabled: false }),
		});

		await expect(
			service.create(user, body, personalWorkspace),
		).rejects.toMatchObject({
			response: { code: "MANUAL_PAYMENTS_DISABLED" },
			status: 409,
		});
		expect(ownerLock.withOwnerLock).not.toHaveBeenCalled();
	});

	it("enforces the plan pairing for personal and organization scopes", async () => {
		const { service } = setup();

		await expect(
			service.create(user, { ...body, plan: "business" }, personalWorkspace),
		).rejects.toMatchObject({
			response: { code: "WORKSPACE_NOT_SUPPORTED" },
			status: 400,
		});

		await expect(
			service.create(user, body, {
				kind: "org",
				organizationId: "org_1",
				role: "owner",
				roles: ["owner"],
			}),
		).rejects.toMatchObject({
			response: { code: "WORKSPACE_NOT_SUPPORTED" },
			status: 400,
		});
	});

	it("blocks a request when the owner has a Stripe subscription", async () => {
		const { requests, service } = setup({
			subscription: subscriptionRow("stripe"),
		});

		await expect(
			service.create(user, body, personalWorkspace),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(requests.findOpenByOwner).not.toHaveBeenCalled();
		expect(requests.insert).not.toHaveBeenCalled();
	});

	it("allows a request when the live subscription is managed manually", async () => {
		const { requests, service } = setup({
			subscription: subscriptionRow("manual"),
		});

		await expect(
			service.create(user, body, personalWorkspace),
		).resolves.toMatchObject({
			request: { id: REQUEST_ID, status: "pending" },
		});
		expect(requests.insert).toHaveBeenCalledTimes(1);
	});

	it("returns a typed conflict for an existing open request", async () => {
		const { requests, service } = setup({ openRequest: requestRow() });

		await expect(
			service.create(user, body, personalWorkspace),
		).rejects.toBeInstanceOf(ManualRequestPendingError);
		expect(requests.insert).not.toHaveBeenCalled();
	});

	it("maps a raced unique violation to the same typed conflict", async () => {
		const { requests, service } = setup();
		requests.insert.mockRejectedValueOnce(
			Object.assign(new Error("insert failed"), {
				cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
			}),
		);

		await expect(
			service.create(user, body, personalWorkspace),
		).rejects.toBeInstanceOf(ManualRequestPendingError);
	});

	it("creates under the owner lock, captures analytics, and notifies admins", async () => {
		mockEnv.ADMIN_EMAILS =
			"first-admin@example.com, second-admin@example.com, first-admin@example.com";
		const { analytics, email, requests, service, transaction } = setup();
		email.isDeliverable.mockReturnValue(true);

		await expect(
			service.create(user, body, personalWorkspace),
		).resolves.toEqual({
			request: {
				city: "Algiers",
				company: "Example SARL",
				country: "DZ",
				createdAt: NOW.toISOString(),
				fullName: "Amina Example",
				handledAt: null,
				id: REQUEST_ID,
				interval: "month",
				notes: "Call after 4 PM",
				organizationId: null,
				phone: "+213 661 22 33 44",
				plan: "pro",
				preferredPaymentMethod: "ccp",
				status: "pending",
				subscriptionId: null,
				tierCredits: 500,
				updatedAt: NOW.toISOString(),
			},
		});

		expect(requests.insert).toHaveBeenCalledWith(
			{
				city: "Algiers",
				company: "Example SARL",
				country: "DZ",
				fullName: "Amina Example",
				interval: "month",
				notes: "Call after 4 PM",
				organizationId: null,
				phone: "+213 661 22 33 44",
				plan: "pro",
				preferredPaymentMethod: "ccp",
				status: "pending",
				tierCredits: 500,
				userId: "user_1",
			},
			transaction,
		);
		expect(analytics.capture).toHaveBeenCalledWith(
			"user_1",
			"manual_subscription_requested",
			{
				country: "DZ",
				interval: "month",
				plan: "pro",
				tierCredits: 500,
			},
		);
		expect(email.sendManualRequestEmail).toHaveBeenCalledWith(
			["first-admin@example.com", "second-admin@example.com"],
			{
				adminUrl: "https://admin.example.com/offline-billing",
				fullName: "Amina Example",
				interval: "month",
				phone: "+213 661 22 33 44",
				plan: "pro",
				tierCredits: 500,
			},
		);
	});

	it("returns the current open request for the selected workspace", async () => {
		const { requests, service } = setup({ openRequest: requestRow() });

		await expect(
			service.getCurrent(user, personalWorkspace),
		).resolves.toMatchObject({ request: { id: REQUEST_ID } });
		expect(requests.findOpenByOwner).toHaveBeenCalledWith({
			type: "user",
			userId: "user_1",
		});
	});

	it("cancels the open request and returns null", async () => {
		const { requests, service, transaction } = setup({
			openRequest: requestRow(),
		});

		await expect(service.cancel(user, personalWorkspace)).resolves.toEqual({
			request: null,
		});
		expect(requests.cancelOpenByOwner).toHaveBeenCalledWith(
			{ type: "user", userId: "user_1" },
			transaction,
		);
	});

	it("returns a typed 404 when there is no open request to cancel", async () => {
		const { service } = setup();

		await expect(
			service.cancel(user, personalWorkspace),
		).rejects.toBeInstanceOf(NoActiveManualRequestError);
		await expect(
			service.cancel(user, personalWorkspace),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("preserves the inserted request when analytics throws", async () => {
		const { analytics, service } = setup();
		analytics.capture.mockImplementation(() => {
			throw new Error("analytics unavailable");
		});

		await expect(
			service.create(user, body, personalWorkspace),
		).resolves.toMatchObject({ request: { id: REQUEST_ID } });
	});

	it("preserves the inserted request when notification delivery rejects", async () => {
		mockEnv.ADMIN_EMAILS = "admin@example.com";
		const { email, service } = setup();
		email.isDeliverable.mockReturnValue(true);
		email.sendManualRequestEmail.mockRejectedValueOnce(
			new Error("email unavailable"),
		);

		await expect(
			service.create(user, body, personalWorkspace),
		).resolves.toMatchObject({ request: { id: REQUEST_ID } });
		await Promise.resolve();
	});

	it("uses organization ownership and enforces the organizations switch", async () => {
		const workspace = {
			kind: "org",
			organizationId: "org_1",
			role: "owner",
			roles: ["owner"],
		} satisfies WorkspaceContext;
		const disabled = setup({
			settings: productSettings({ organizationsEnabled: false }),
		});

		await expect(
			disabled.service.create(user, { ...body, plan: "business" }, workspace),
		).rejects.toMatchObject({
			response: { code: "ORGANIZATIONS_DISABLED" },
		});

		const enabled = setup();
		await enabled.service.create(
			user,
			{ ...body, plan: "business" },
			workspace,
		);
		expect(enabled.ownerLock.withOwnerLock).toHaveBeenCalledWith(
			{ organizationId: "org_1", type: "org" },
			expect.any(Function),
		);
		expect(enabled.requests.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org_1",
				plan: "business",
				userId: "user_1",
			}),
			expect.anything(),
		);
	});

	it("uses 409 conflicts for duplicate and disabled errors", async () => {
		const duplicate = setup({ openRequest: requestRow() });
		const disabled = setup({
			settings: productSettings({ manualPaymentsEnabled: false }),
		});

		await expect(
			duplicate.service.create(user, body, personalWorkspace),
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			disabled.service.create(user, body, personalWorkspace),
		).rejects.toBeInstanceOf(ConflictException);
	});
});
