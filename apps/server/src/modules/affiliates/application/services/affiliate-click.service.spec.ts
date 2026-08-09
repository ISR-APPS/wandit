import { HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import type { AffiliateClickBody } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	AffiliateLinkTerms,
	AffiliatesRepository,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateClickService } from "./affiliate-click.service";
import type { AffiliateClickThrottle } from "./affiliate-click-throttle";
import type { AffiliateTokenService } from "./affiliate-token.service";

const DAY_MS = 24 * 60 * 60 * 1_000;
const DAY_SECONDS = 24 * 60 * 60;
const NOW = new Date("2026-08-02T12:00:00.000Z");
const BODY = {
	code: "partner_123",
	landingUrl: "https://app.test/pricing?ref=partner_123",
} satisfies AffiliateClickBody;
const REQUEST = {
	ip: "203.0.113.10",
	userAgent: "affiliate-click-test-agent",
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
		code: BODY.code,
		cookieWindowDays: 60,
		durationMonths: 12,
		expiresAt: new Date(NOW.getTime() + 3 * DAY_MS),
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

function setup() {
	const affiliatesRepository = {
		findLinkTerms: vi.fn(
			async (_code: string): Promise<AffiliateLinkTerms | null> => linkTerms(),
		),
		insertClick: vi.fn(async (): Promise<void> => undefined),
	};
	const throttle = {
		allow: vi.fn((_ip: string, _now: number): boolean => true),
	};
	const tokenService = {
		hashIp: vi.fn((_ip: string): string => "hashed-ip"),
		sign: vi.fn((): string => "signed-attribution-token"),
	};
	const service = new AffiliateClickService(
		affiliatesRepository as unknown as AffiliatesRepository,
		throttle as unknown as AffiliateClickThrottle,
		tokenService as unknown as AffiliateTokenService,
	);

	return { affiliatesRepository, service, throttle, tokenService };
}

describe("AffiliateClickService", () => {
	it("captures an active unexpired link with a hashed IP", async () => {
		const { affiliatesRepository, service, throttle, tokenService } = setup();

		const result = await service.capture(BODY, REQUEST, NOW);

		expect(throttle.allow).toHaveBeenCalledWith(REQUEST.ip, NOW.getTime());
		expect(affiliatesRepository.findLinkTerms).toHaveBeenCalledWith(BODY.code);
		expect(tokenService.sign).toHaveBeenCalledWith({
			issuedAt: Math.floor(NOW.getTime() / 1_000),
			linkCode: BODY.code,
		});
		expect(tokenService.hashIp).toHaveBeenCalledWith(REQUEST.ip);
		expect(affiliatesRepository.insertClick).toHaveBeenCalledWith({
			ipHash: "hashed-ip",
			landingUrl: BODY.landingUrl,
			linkId: "link_1",
			userAgent: REQUEST.userAgent,
		});
		expect(result).toEqual({
			attributionToken: "signed-attribution-token",
			expiresAt: new Date(NOW.getTime() + 3 * DAY_MS).toISOString(),
			maxAgeSeconds: 3 * DAY_SECONDS,
		});
	});

	it.each([
		{
			cookieWindowDays: 2,
			expectedMaxAgeSeconds: 2 * DAY_SECONDS,
			expiresAt: new Date(NOW.getTime() + 10 * DAY_MS),
			name: "the cookie window when it is shorter",
		},
		{
			cookieWindowDays: 60,
			expectedMaxAgeSeconds: 90 * 60,
			expiresAt: new Date(NOW.getTime() + 90 * 60 * 1_000),
			name: "the link expiry window when it is shorter",
		},
	])("sets Max-Age from $name", async ({
		cookieWindowDays,
		expectedMaxAgeSeconds,
		expiresAt,
	}) => {
		const { affiliatesRepository, service } = setup();
		affiliatesRepository.findLinkTerms.mockResolvedValueOnce(
			linkTerms({ cookieWindowDays, expiresAt }),
		);

		const result = await service.capture(BODY, REQUEST, NOW);

		expect(result.maxAgeSeconds).toBe(expectedMaxAgeSeconds);
		expect(result.expiresAt).toBe(
			new Date(NOW.getTime() + expectedMaxAgeSeconds * 1_000).toISOString(),
		);
	});

	it.each([
		{ link: null, name: "does not exist" },
		{ link: linkTerms({ active: false }), name: "is inactive" },
		{
			link: linkTerms({ affiliateStatus: "paused" }),
			name: "belongs to a paused affiliate",
		},
		{
			link: linkTerms({ programStatus: "archived" }),
			name: "belongs to an archived program",
		},
		{
			link: linkTerms({ expiresAt: NOW }),
			name: "has expired",
		},
	])("rejects a link that $name", async ({ link }) => {
		const { affiliatesRepository, service, tokenService } = setup();
		affiliatesRepository.findLinkTerms.mockResolvedValueOnce(link);

		await expect(service.capture(BODY, REQUEST, NOW)).rejects.toBeInstanceOf(
			NotFoundException,
		);

		expect(tokenService.sign).not.toHaveBeenCalled();
		expect(affiliatesRepository.insertClick).not.toHaveBeenCalled();
	});

	it("returns 429 before repository work when the IP is over budget", async () => {
		const { affiliatesRepository, service, throttle } = setup();
		throttle.allow.mockReturnValueOnce(false);

		const error = await service.capture(BODY, REQUEST, NOW).then(
			() => null,
			(reason: unknown) => reason,
		);

		expect(error).toBeInstanceOf(HttpException);
		expect((error as HttpException).getStatus()).toBe(
			HttpStatus.TOO_MANY_REQUESTS,
		);
		expect(affiliatesRepository.findLinkTerms).not.toHaveBeenCalled();
		expect(affiliatesRepository.insertClick).not.toHaveBeenCalled();
	});
});
