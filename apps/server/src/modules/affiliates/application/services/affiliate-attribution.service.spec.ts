import { Logger } from "@nestjs/common";
import {
	AFFILIATE_ATTRIBUTION_COOKIE_NAME,
	AFFILIATE_SIGNUP_TOKEN_FIELD,
} from "@wandit/contracts";
import type { GenericEndpointContext } from "better-auth";
import { describe, expect, it, vi } from "vitest";

import type { AffiliateAttributionTokenPayload } from "../../domain/affiliate-token";
import type {
	AffiliateAttributionRow,
	AffiliateLinkTerms,
	AffiliatesRepository,
	AffiliateTransaction,
	InsertAttributionInput,
} from "../../infrastructure/persistence/affiliates.repository";
import type { TriggerAffiliateAttributionDispatcherService } from "../../infrastructure/trigger/trigger-affiliate-attribution-dispatcher.service";
import { AffiliateAttributionService } from "./affiliate-attribution.service";
import type { AffiliateCommissionService } from "./affiliate-commission.service";
import type { AffiliateTokenService } from "./affiliate-token.service";

const NOW = new Date("2026-08-02T12:00:00.000Z");
const CLICKED_AT = new Date("2026-08-02T11:00:00.000Z");
const USER = { email: "customer@example.com", id: "user_1" };
const PAYLOAD: AffiliateAttributionTokenPayload = {
	issuedAt: Math.floor(CLICKED_AT.getTime() / 1_000),
	linkCode: "partner_123",
};

function linkTerms(
	overrides: Partial<AffiliateLinkTerms> = {},
): AffiliateLinkTerms {
	return {
		active: true,
		affiliateEmail: "partner@example.com",
		affiliateId: "affiliate_1",
		affiliateStatus: "active",
		affiliateUserId: null,
		code: PAYLOAD.linkCode,
		cookieWindowDays: 60,
		durationMonths: 12,
		expiresAt: new Date("2026-08-03T12:00:00.000Z"),
		fixedAmountCents: null,
		fixedCurrency: null,
		holdDays: 30,
		id: "link_1",
		programId: "program_1",
		programKind: "percentage_recurring",
		programStatus: "active",
		rateBps: 1_500,
		...overrides,
	};
}

function attributionRow(
	overrides: Partial<AffiliateAttributionRow> = {},
): AffiliateAttributionRow {
	return {
		affiliateId: "affiliate_1",
		clickedAt: CLICKED_AT,
		commissionDurationMonths: 12,
		commissionRateBps: 1_500,
		createdAt: NOW,
		fixedAmountCents: null,
		fixedCurrency: null,
		fraudFlags: [],
		id: "attribution_1",
		linkId: "link_1",
		lockedAt: NOW,
		programId: "program_1",
		programKind: "percentage_recurring",
		source: "signup_cookie",
		status: "active",
		updatedAt: NOW,
		userId: USER.id,
		...overrides,
	};
}

function signupContext(input: { bodyToken?: unknown; cookieToken?: string }) {
	const getCookie = vi.fn((name: string) =>
		name === AFFILIATE_ATTRIBUTION_COOKIE_NAME ? input.cookieToken : undefined,
	);
	const body =
		input.bodyToken === undefined
			? {}
			: { [AFFILIATE_SIGNUP_TOKEN_FIELD]: input.bodyToken };

	return {
		ctx: { body, getCookie } as unknown as GenericEndpointContext,
		getCookie,
	};
}

function setup(options: { dispatcherEnabled?: boolean } = {}) {
	const order: string[] = [];
	const tx = {
		kind: "affiliate-transaction",
	} as unknown as AffiliateTransaction;
	const existingAttribution = attributionRow();
	const affiliatesRepository = {
		findUserIdentity: vi.fn(
			async (_userId: string): Promise<typeof USER | null> => USER,
		),
		findAttributionByUserId: vi.fn(
			async (
				_userId: string,
				_client?: AffiliateTransaction,
			): Promise<AffiliateAttributionRow | null> => existingAttribution,
		),
		findLinkTerms: vi.fn(
			async (
				_code: string,
				_client?: AffiliateTransaction,
				_lockForUpdate?: boolean,
			): Promise<AffiliateLinkTerms | null> => linkTerms(),
		),
		insertAttributionFirstWins: vi.fn(
			async (
				_input: InsertAttributionInput,
				_client: AffiliateTransaction,
			): Promise<AffiliateAttributionRow | null> => existingAttribution,
		),
		lockAttributionByUserId: vi.fn(
			async (
				_userId: string,
				_client: AffiliateTransaction,
			): Promise<AffiliateAttributionRow | null> => null,
		),
		lockAffiliate: vi.fn(
			async (
				_affiliateId: string,
				_client: AffiliateTransaction,
			): Promise<void> => undefined,
		),
		withAttributionLock: vi.fn(
			async (
				_userId: string,
				operation: (
					tx: AffiliateTransaction,
				) => Promise<AffiliateAttributionRow | null>,
			): Promise<AffiliateAttributionRow | null> => {
				order.push("attribution-lock");
				return operation(tx);
			},
		),
	};
	const tokenService = {
		verify: vi.fn(
			(_token: string): AffiliateAttributionTokenPayload | null => PAYLOAD,
		),
	};
	const commissionService = {
		reconcileCandidatesForUser: vi.fn(
			async (_userId: string): Promise<number> => 0,
		),
	};
	const dispatcher = {
		triggerRetry: vi.fn(async () => {
			order.push("trigger");
		}),
	};
	const service = new AffiliateAttributionService(
		affiliatesRepository as unknown as AffiliatesRepository,
		tokenService as unknown as AffiliateTokenService,
		commissionService as unknown as AffiliateCommissionService,
		options.dispatcherEnabled === false
			? undefined
			: (dispatcher as unknown as TriggerAffiliateAttributionDispatcherService),
	);

	return {
		affiliatesRepository,
		commissionService,
		existingAttribution,
		order,
		dispatcher,
		service,
		tokenService,
		tx,
	};
}

describe("AffiliateAttributionService", () => {
	it("ignores a tampered token before taking the attribution lock", async () => {
		const { affiliatesRepository, commissionService, service, tokenService } =
			setup();
		const { ctx } = signupContext({ cookieToken: "tampered-token" });
		tokenService.verify.mockReturnValueOnce(null);

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();

		expect(tokenService.verify).toHaveBeenCalledWith("tampered-token");
		expect(affiliatesRepository.withAttributionLock).not.toHaveBeenCalled();
		expect(commissionService.reconcileCandidatesForUser).not.toHaveBeenCalled();
	});

	it.each([
		{
			expiresAt: new Date("2026-08-02T10:59:59.999Z"),
			name: "was already expired when clicked",
		},
		{
			expiresAt: new Date("2026-08-02T11:30:00.000Z"),
			name: "expired after the click but before signup",
		},
	])("rejects a link that $name", async ({ expiresAt }) => {
		const { affiliatesRepository, commissionService, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		affiliatesRepository.findLinkTerms.mockResolvedValue(
			linkTerms({ expiresAt }),
		);

		await expect(
			service.lockForCreatedUser(USER, ctx, NOW),
		).resolves.toBeNull();

		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).not.toHaveBeenCalled();
		expect(commissionService.reconcileCandidatesForUser).not.toHaveBeenCalled();
	});

	it("samples expiry after acquiring the affiliate lock", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-08-02T11:59:00.000Z"));
			const { affiliatesRepository, service } = setup();
			const { ctx } = signupContext({ cookieToken: "valid-token" });
			affiliatesRepository.findLinkTerms.mockResolvedValue(
				linkTerms({ expiresAt: new Date("2026-08-02T12:00:00.000Z") }),
			);
			affiliatesRepository.lockAffiliate.mockImplementationOnce(async () => {
				vi.setSystemTime(new Date("2026-08-02T12:01:00.000Z"));
			});

			await expect(service.lockForCreatedUser(USER, ctx)).resolves.toBeNull();
			expect(
				affiliatesRepository.insertAttributionFirstWins,
			).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("prefers the API-origin cookie over the signup-body fallback", async () => {
		const { affiliatesRepository, service, tokenService, tx } = setup();
		const cookiePayload = { ...PAYLOAD, linkCode: "cookie_123" };
		const bodyPayload = { ...PAYLOAD, linkCode: "body_123" };
		const { ctx, getCookie } = signupContext({
			bodyToken: "body-token",
			cookieToken: "cookie-token",
		});
		tokenService.verify.mockImplementation((token) =>
			token === "cookie-token" ? cookiePayload : bodyPayload,
		);
		affiliatesRepository.findLinkTerms.mockResolvedValue(
			linkTerms({ code: cookiePayload.linkCode }),
		);

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(getCookie).toHaveBeenCalledWith(AFFILIATE_ATTRIBUTION_COOKIE_NAME);
		expect(tokenService.verify).toHaveBeenCalledWith("cookie-token");
		expect(affiliatesRepository.findLinkTerms).toHaveBeenCalledWith(
			cookiePayload.linkCode,
			tx,
		);
		expect(affiliatesRepository.lockAffiliate).toHaveBeenCalledWith(
			"affiliate_1",
			tx,
		);
		expect(affiliatesRepository.findLinkTerms).toHaveBeenLastCalledWith(
			cookiePayload.linkCode,
			tx,
			true,
		);
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(
			expect.objectContaining({ source: "signup_cookie" }),
			tx,
		);
	});

	it("falls back to the signed signup-body token when the cookie is invalid", async () => {
		const { affiliatesRepository, service, tokenService, tx } = setup();
		const { ctx } = signupContext({
			bodyToken: "body-token",
			cookieToken: "tampered-cookie",
		});
		tokenService.verify.mockImplementation((token) =>
			token === "tampered-cookie" ? null : PAYLOAD,
		);

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(tokenService.verify).toHaveBeenCalledWith("body-token");
		expect(affiliatesRepository.findLinkTerms).toHaveBeenCalledWith(
			PAYLOAD.linkCode,
			tx,
		);
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(
			expect.objectContaining({ source: "signup_body" }),
			tx,
		);
	});

	it("uses the signed signup-body token when the cookie is absent", async () => {
		const { affiliatesRepository, service, tokenService, tx } = setup();
		const { ctx } = signupContext({ bodyToken: "body-token" });

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(tokenService.verify).toHaveBeenCalledWith("body-token");
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(
			expect.objectContaining({ source: "signup_body" }),
			tx,
		);
	});

	it("rereads the first-wins attribution inside the per-user lock", async () => {
		const {
			affiliatesRepository,
			commissionService,
			existingAttribution,
			service,
			tx,
		} = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		affiliatesRepository.insertAttributionFirstWins.mockResolvedValueOnce(null);

		await expect(service.lockForCreatedUser(USER, ctx, NOW)).resolves.toBe(
			existingAttribution,
		);

		expect(affiliatesRepository.withAttributionLock).toHaveBeenCalledWith(
			USER.id,
			expect.any(Function),
		);
		expect(affiliatesRepository.lockAttributionByUserId).toHaveBeenCalledWith(
			USER.id,
			tx,
		);
		expect(affiliatesRepository.findLinkTerms).toHaveBeenCalledWith(
			PAYLOAD.linkCode,
			tx,
		);
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(expect.objectContaining({ userId: USER.id }), tx);
		expect(affiliatesRepository.findAttributionByUserId).toHaveBeenCalledWith(
			USER.id,
			tx,
		);
		expect(commissionService.reconcileCandidatesForUser).toHaveBeenCalledWith(
			USER.id,
		);
	});

	it("records user-id and normalized-email self-referral flags", async () => {
		const { affiliatesRepository, service, tx } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		affiliatesRepository.findLinkTerms.mockResolvedValue(
			linkTerms({
				affiliateEmail: " Partner@Example.COM ",
				affiliateUserId: USER.id,
			}),
		);

		await service.lockForCreatedUser(
			{ email: "partner+signup@example.com", id: USER.id },
			ctx,
			NOW,
		);

		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				fraudFlags: [
					{
						code: "self_referral_user_id",
						detectedAt: NOW.toISOString(),
						resolvedAt: null,
						resolvedByUserId: null,
					},
					{
						code: "self_referral_email",
						detectedAt: NOW.toISOString(),
						resolvedAt: null,
						resolvedByUserId: null,
					},
				],
			}),
			tx,
		);
	});

	it("re-reads affiliate identity after taking the shared affiliate lock", async () => {
		const { affiliatesRepository, service, tx } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		affiliatesRepository.findLinkTerms
			.mockResolvedValueOnce(linkTerms())
			.mockResolvedValueOnce(
				linkTerms({
					affiliateEmail: "customer+partner@example.com",
					affiliateUserId: USER.id,
				}),
			);

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(affiliatesRepository.lockAffiliate).toHaveBeenCalledWith(
			"affiliate_1",
			tx,
		);
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				fraudFlags: expect.arrayContaining([
					expect.objectContaining({ code: "self_referral_user_id" }),
					expect.objectContaining({ code: "self_referral_email" }),
				]),
			}),
			tx,
		);
	});

	it("triggers a signed durable retry before attempting the inline attribution lock", async () => {
		const { dispatcher, order, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });

		await service.lockForCreatedUser(USER, ctx, NOW);

		expect(order.slice(0, 2)).toEqual(["trigger", "attribution-lock"]);
		expect(dispatcher.triggerRetry).toHaveBeenCalledWith({
			source: "signup_cookie",
			token: "valid-token",
			userId: USER.id,
		});
	});

	it("warns and continues inline when the dispatcher is unavailable", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		try {
			const { affiliatesRepository, dispatcher, service } = setup({
				dispatcherEnabled: false,
			});
			const { ctx } = signupContext({ cookieToken: "valid-token" });

			await expect(service.lockForCreatedUser(USER, ctx, NOW)).resolves.toEqual(
				expect.objectContaining({ id: "attribution_1" }),
			);

			expect(warn).toHaveBeenCalledWith(
				"Affiliate attribution retry skipped for user user_1: Trigger dispatcher is unavailable",
			);
			expect(dispatcher.triggerRetry).not.toHaveBeenCalled();
			expect(affiliatesRepository.withAttributionLock).toHaveBeenCalledOnce();
		} finally {
			warn.mockRestore();
		}
	});

	it("replays a signed token without triggering another task", async () => {
		const { affiliatesRepository, dispatcher, service } = setup();

		await expect(
			service.retryLock(
				{
					source: "signup_body",
					token: "queued-token",
					userId: USER.id,
				},
				NOW,
			),
		).resolves.toEqual(expect.objectContaining({ id: "attribution_1" }));

		expect(affiliatesRepository.findUserIdentity).toHaveBeenCalledWith(USER.id);
		expect(dispatcher.triggerRetry).not.toHaveBeenCalled();
	});

	it("reports when neither the inline lock nor durable retry is available", async () => {
		const { affiliatesRepository, dispatcher, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		dispatcher.triggerRetry.mockRejectedValueOnce(
			new Error("Trigger unavailable"),
		);
		affiliatesRepository.withAttributionLock.mockRejectedValueOnce(
			new Error("Postgres unavailable"),
		);

		await expect(service.lockForCreatedUser(USER, ctx, NOW)).rejects.toThrow(
			"Affiliate attribution lock and durable retry both failed",
		);
	});

	it("reconciles pending candidates after inserting an attribution", async () => {
		const { commissionService, existingAttribution, service } = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });

		await expect(service.lockForCreatedUser(USER, ctx, NOW)).resolves.toBe(
			existingAttribution,
		);
		expect(commissionService.reconcileCandidatesForUser).toHaveBeenCalledWith(
			USER.id,
		);
	});

	it("returns the previous first-wins attribution and still reconciles candidates", async () => {
		const {
			affiliatesRepository,
			commissionService,
			existingAttribution,
			service,
		} = setup();
		const { ctx } = signupContext({ cookieToken: "valid-token" });
		affiliatesRepository.lockAttributionByUserId.mockResolvedValueOnce(
			existingAttribution,
		);

		await expect(service.lockForCreatedUser(USER, ctx, NOW)).resolves.toBe(
			existingAttribution,
		);
		expect(affiliatesRepository.findLinkTerms).not.toHaveBeenCalled();
		expect(
			affiliatesRepository.insertAttributionFirstWins,
		).not.toHaveBeenCalled();
		expect(commissionService.reconcileCandidatesForUser).toHaveBeenCalledWith(
			USER.id,
		);
	});
});
