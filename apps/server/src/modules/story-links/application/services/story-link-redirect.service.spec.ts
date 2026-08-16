import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	CORS_ORIGIN: "https://web.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import type { AffiliateTokenService } from "../../../affiliates/application/services/affiliate-token.service";
import type { UtmAttributionTokenService } from "../../../attribution/application/services/utm-attribution-token.service";
import type {
	StoryLinkClickRepository,
	StoryLinkRedirectTerms,
} from "../../infrastructure/persistence/story-link-click.repository";
import type { StoryLinkClickThrottle } from "./story-link-click-throttle";
import { StoryLinkRedirectService } from "./story-link-redirect.service";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const REQUEST = {
	ip: "203.0.113.10",
	userAgent: "story-link-test-agent",
};

function linkTerms(
	overrides: Partial<StoryLinkRedirectTerms> = {},
): StoryLinkRedirectTerms {
	return {
		archivedAt: null,
		destinationPath: "/pricing",
		id: "link_1",
		utmCampaign: "summer launch",
		utmContent: "hero cta",
		utmMedium: "story",
		utmSource: "instagram",
		...overrides,
	};
}

function setup() {
	const repository = {
		findBySlug: vi.fn(
			async (_slug: string): Promise<StoryLinkRedirectTerms | null> =>
				linkTerms(),
		),
		insertClick: vi.fn(async (): Promise<void> => undefined),
	};
	const throttle = {
		allow: vi.fn((_ip: string, _now: number): boolean => true),
	};
	const affiliateTokenService = {
		hashIp: vi.fn((_ip: string): string => "hashed-ip"),
	};
	const utmAttributionTokenService = {
		sign: vi.fn((): string => "signed-utm-token"),
	};
	const service = new StoryLinkRedirectService(
		repository as unknown as StoryLinkClickRepository,
		throttle as unknown as StoryLinkClickThrottle,
		affiliateTokenService as unknown as AffiliateTokenService,
		utmAttributionTokenService as unknown as UtmAttributionTokenService,
	);

	return {
		affiliateTokenService,
		repository,
		service,
		throttle,
		utmAttributionTokenService,
	};
}

describe("StoryLinkRedirectService", () => {
	beforeEach(() => {
		mockEnv.CORS_ORIGIN = "https://web.test";
	});

	it("returns the web root without a lookup for an invalid slug", async () => {
		const { repository, service, throttle } = setup();

		await expect(
			service.resolve("invalid_slug", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: null,
			destination: "https://web.test/",
		});

		expect(repository.findBySlug).not.toHaveBeenCalled();
		expect(repository.insertClick).not.toHaveBeenCalled();
		expect(throttle.allow).not.toHaveBeenCalled();
	});

	it("returns the web root and records nothing for an archived link", async () => {
		const { affiliateTokenService, repository, service } = setup();
		repository.findBySlug.mockResolvedValueOnce(
			linkTerms({ archivedAt: new Date("2026-08-01T00:00:00.000Z") }),
		);

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: null,
			destination: "https://web.test/",
		});

		expect(repository.insertClick).not.toHaveBeenCalled();
		expect(affiliateTokenService.hashIp).not.toHaveBeenCalled();
	});

	it("returns the web root and records nothing for an unknown link", async () => {
		const { repository, service, throttle } = setup();
		repository.findBySlug.mockResolvedValueOnce(null);

		await expect(
			service.resolve("missing-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: null,
			destination: "https://web.test/",
		});

		expect(throttle.allow).not.toHaveBeenCalled();
		expect(repository.insertClick).not.toHaveBeenCalled();
	});

	it("returns the destination when the click insert fails", async () => {
		const { repository, service } = setup();
		repository.insertClick.mockRejectedValueOnce(new Error("database offline"));

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: "signed-utm-token",
			destination:
				"https://web.test/pricing?utm_source=instagram&utm_medium=story&utm_campaign=summer+launch&utm_content=hero+cta",
		});
	});

	it("skips click recording when the IP is over budget", async () => {
		const { affiliateTokenService, repository, service, throttle } = setup();
		throttle.allow.mockReturnValueOnce(false);

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: "signed-utm-token",
			destination:
				"https://web.test/pricing?utm_source=instagram&utm_medium=story&utm_campaign=summer+launch&utm_content=hero+cta",
		});

		expect(throttle.allow).toHaveBeenCalledWith(REQUEST.ip, NOW.getTime());
		expect(affiliateTokenService.hashIp).not.toHaveBeenCalled();
		expect(repository.insertClick).not.toHaveBeenCalled();
	});

	it("lowercases the slug and preserves destination query parameters", async () => {
		const { repository, service } = setup();
		repository.findBySlug.mockResolvedValueOnce(
			linkTerms({
				destinationPath:
					"/pricing?plan=pro&utm_source=old&utm_content=old#plans",
				utmContent: null,
			}),
		);

		const result = await service.resolve("SUMMER-STORY", REQUEST, NOW);

		expect(repository.findBySlug).toHaveBeenCalledWith("summer-story");
		expect(result).toEqual({
			attributionToken: "signed-utm-token",
			destination:
				"https://web.test/pricing?plan=pro&utm_source=instagram&utm_medium=story&utm_campaign=summer+launch#plans",
		});
	});

	it("signs the exact story-link attribution payload", async () => {
		const { service, utmAttributionTokenService } = setup();

		await service.resolve("Summer-Story", REQUEST, NOW);

		expect(utmAttributionTokenService.sign).toHaveBeenCalledWith({
			issuedAt: 1_786_795_200,
			landingPath: "/pricing",
			storyLinkSlug: "summer-story",
			utmCampaign: "summer launch",
			utmContent: "hero cta",
			utmMedium: "story",
			utmSource: "instagram",
		});
	});

	it("truncates the user agent and hashes the IP with AffiliateTokenService", async () => {
		const { affiliateTokenService, repository, service } = setup();
		const userAgent = "a".repeat(1_100);

		await service.resolve("summer-story", { ...REQUEST, userAgent }, NOW);

		expect(affiliateTokenService.hashIp).toHaveBeenCalledWith(REQUEST.ip);
		expect(repository.insertClick).toHaveBeenCalledWith({
			ipHash: "hashed-ip",
			storyLinkId: "link_1",
			userAgent: "a".repeat(1_024),
		});
	});

	it("returns the web root when link lookup fails", async () => {
		const { repository, service, throttle } = setup();
		repository.findBySlug.mockRejectedValueOnce(new Error("database offline"));

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: null,
			destination: "https://web.test/",
		});

		expect(throttle.allow).not.toHaveBeenCalled();
		expect(repository.insertClick).not.toHaveBeenCalled();
	});

	it("returns the destination when IP hashing fails", async () => {
		const { affiliateTokenService, repository, service } = setup();
		affiliateTokenService.hashIp.mockImplementationOnce(() => {
			throw new Error("hashing unavailable");
		});

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: "signed-utm-token",
			destination:
				"https://web.test/pricing?utm_source=instagram&utm_medium=story&utm_campaign=summer+launch&utm_content=hero+cta",
		});

		expect(repository.insertClick).not.toHaveBeenCalled();
	});

	it("returns the destination without attribution when token signing fails", async () => {
		const { service, utmAttributionTokenService } = setup();
		utmAttributionTokenService.sign.mockImplementationOnce(() => {
			throw new Error("signing unavailable");
		});

		await expect(
			service.resolve("summer-story", REQUEST, NOW),
		).resolves.toEqual({
			attributionToken: null,
			destination:
				"https://web.test/pricing?utm_source=instagram&utm_medium=story&utm_campaign=summer+launch&utm_content=hero+cta",
		});
	});
});
