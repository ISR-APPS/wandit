import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	EMAIL_FROM: "Wandit <onboarding@resend.dev>",
	NODE_ENV: "test" as string,
	RESEND_API_KEY: undefined as string | undefined,
}));

const transactionalSendMock = vi.hoisted(() =>
	vi.fn(
		async (
			_payload: unknown,
		): Promise<{ error: { name: string; message: string } | null }> => ({
			error: null,
		}),
	),
);

const lifecycleSendMock = vi.hoisted(() =>
	vi.fn(
		async (
			_payload: unknown,
		): Promise<{ error: { name: string; message: string } | null }> => ({
			error: null,
		}),
	),
);

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("resend", () => ({
	Resend: class {
		emails = { send: transactionalSendMock };
		events = { send: lifecycleSendMock };
	},
}));

import { EmailService } from "./email.service";

describe("EmailService", () => {
	beforeEach(() => {
		transactionalSendMock.mockClear();
		transactionalSendMock.mockResolvedValue({ error: null });
		lifecycleSendMock.mockClear();
		lifecycleSendMock.mockResolvedValue({ error: null });
		mockEnv.RESEND_API_KEY = undefined;
		mockEnv.NODE_ENV = "test";
	});

	it("logs instead of sending when no key is set outside production", async () => {
		const service = new EmailService();
		await expect(
			service.sendMagicLinkEmail("user@example.com", "https://x/verify?t=1"),
		).resolves.toBeUndefined();
		expect(transactionalSendMock).not.toHaveBeenCalled();
	});

	it("refuses loudly in production without a key", async () => {
		mockEnv.NODE_ENV = "production";
		const service = new EmailService();
		await expect(
			service.sendOtpEmail("user@example.com", "123456"),
		).rejects.toMatchObject({
			body: { code: "EMAIL_DELIVERY_UNAVAILABLE" },
		});
	});

	it("sends through resend when configured", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();
		await service.sendOtpEmail("user@example.com", "123456");
		expect(transactionalSendMock).toHaveBeenCalledTimes(1);
		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			from: string;
			to: string;
			subject: string;
			html: string;
			text: string;
		};
		expect(payload.to).toBe("user@example.com");
		expect(payload.from).toBe("Wandit <onboarding@resend.dev>");
		expect(payload.subject).toContain("123456");
		expect(payload.html).toContain("123456");
		expect(payload.text).toContain("123456");
	});

	it("sends an idempotent external-domain delegation reminder", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();
		await service.sendExternalDomainDelegationReminder({
			dashboardUrl:
				"https://app.example.com/p/project_1?tab=settings&view=domains",
			domainId: "domain_1",
			domainName: "example.com",
			idempotencyKey: "external-domain-delegation-reminder:domain_1",
			nameServers: ["abby.ns.cloudflare.com", "bob.ns.cloudflare.com"],
			to: "owner@example.com",
		});

		expect(transactionalSendMock).toHaveBeenCalledExactlyOnceWith(
			{
				from: "Wandit <onboarding@resend.dev>",
				html: expect.stringContaining("abby.ns.cloudflare.com"),
				subject: "Finish connecting example.com to Wandit",
				text: expect.stringContaining("bob.ns.cloudflare.com"),
				to: "owner@example.com",
			},
			{
				idempotencyKey: "external-domain-delegation-reminder:domain_1",
			},
		);
		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			html: string;
			text: string;
		};
		expect(payload.html).toContain(
			"https://app.example.com/p/project_1?tab=settings&amp;view=domains",
		);
		expect(payload.text).toContain(
			"https://app.example.com/p/project_1?tab=settings&view=domains",
		);
		expect(payload.text).toContain(
			"If you no longer want this domain connected, you can remove it in settings.",
		);
	});

	it("escapes external-domain reminder values in html", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();
		await service.sendExternalDomainDelegationReminder({
			dashboardUrl: "https://app.example.com/p/project_1?tab=settings&x=1",
			domainId: "domain_unsafe",
			domainName: "example.com<script>",
			idempotencyKey: "external-domain-delegation-reminder:domain_unsafe",
			nameServers: [
				'abby.ns.cloudflare.com"><script>',
				"bob.ns.cloudflare.com&more",
			],
			to: "owner@example.com",
		});

		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			html: string;
		};
		expect(payload.html).not.toContain("<script>");
		expect(payload.html).toContain("example.com&lt;script&gt;");
		expect(payload.html).toContain(
			"abby.ns.cloudflare.com&quot;&gt;&lt;script&gt;",
		);
		expect(payload.html).toContain("bob.ns.cloudflare.com&amp;more");
	});

	it("surfaces provider failures as retryable delivery errors", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		transactionalSendMock.mockResolvedValue({
			error: { message: "domain not verified", name: "validation_error" },
		});
		const service = new EmailService();
		await expect(
			service.sendMagicLinkEmail("user@example.com", "https://x/verify?t=1"),
		).rejects.toMatchObject({ body: { code: "EMAIL_DELIVERY_UNAVAILABLE" } });
	});

	it("escapes user-controlled names in invitation html", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();
		await service.sendInvitationEmail({
			inviteUrl: "https://app.example.com/invite/inv_1",
			inviterName: '<img src=x onerror=alert(1)>"Zack"',
			organizationName: "Acme & Sons <script>",
			to: "invitee@example.com",
		});
		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			html: string;
			subject: string;
		};
		expect(payload.html).not.toContain("<img src=x");
		expect(payload.html).not.toContain("<script>");
		expect(payload.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(payload.html).toContain("Acme &amp; Sons &lt;script&gt;");
		expect(payload.html).toContain("https://app.example.com/invite/inv_1");
	});

	it("sends one escaped offline-request notification to all admins", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();
		await service.sendManualRequestEmail(
			["admin-one@example.com", "admin-two@example.com"],
			{
				adminUrl: "https://admin.example.com/offline-billing",
				fullName: '<img src=x onerror=alert(1)>"Amina"',
				interval: "year",
				phone: "+213 661 22 33 44",
				plan: "pro",
				tierCredits: 175,
			},
		);

		expect(transactionalSendMock).toHaveBeenCalledTimes(1);
		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			html: string;
			subject: string;
			text: string;
			to: string[];
		};
		expect(payload.to).toEqual([
			"admin-one@example.com",
			"admin-two@example.com",
		]);
		expect(payload.subject).toContain("Amina");
		expect(payload.html).not.toContain("<img src=x");
		expect(payload.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(payload.text).toContain("Pro / 175 credits / yearly");
		expect(payload.text).toContain("https://admin.example.com/offline-billing");
	});

	it.each([
		["starter", "Starter", 50],
		["pro", "Pro", 175],
		["business", "Business", 175],
	] as const)("labels the %s plan in offline-request emails", async (plan, label, tierCredits) => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();

		await service.sendManualRequestEmail(["admin@example.com"], {
			adminUrl: "https://admin.example.com/offline-billing",
			fullName: "Amina",
			interval: "month",
			phone: "+213 661 22 33 44",
			plan,
			tierCredits,
		});

		const payload = transactionalSendMock.mock.calls[0]?.[0] as unknown as {
			text: string;
		};
		expect(payload.text).toContain(
			`${label} / ${tierCredits} credits / monthly`,
		);
	});

	it("sends lifecycle events through Resend Automations", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const service = new EmailService();

		await service.sendLifecycleEvent({
			email: "canonical@example.com",
			event: "website_generated",
			payload: {
				done_landing_page: false,
				first_name: "Amina",
				plan: "free",
			},
		});

		expect(lifecycleSendMock).toHaveBeenCalledExactlyOnceWith({
			email: "canonical@example.com",
			event: "website_generated",
			payload: {
				done_landing_page: false,
				first_name: "Amina",
				plan: "free",
			},
		});
		expect(transactionalSendMock).not.toHaveBeenCalled();
	});

	it("refuses lifecycle delivery without a Resend client even in development", async () => {
		mockEnv.NODE_ENV = "development";
		const service = new EmailService();

		await expect(
			service.sendLifecycleEvent({
				email: "canonical@example.com",
				event: "first_prompt_sent",
				payload: { plan: "free" },
			}),
		).rejects.toThrow("Lifecycle email delivery is unavailable");
		expect(lifecycleSendMock).not.toHaveBeenCalled();
	});

	it("surfaces lifecycle event provider failures for outbox retry", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		const providerError = {
			message: "automation unavailable",
			name: "application_error",
		};
		lifecycleSendMock.mockResolvedValue({ error: providerError });
		const service = new EmailService();

		await expect(
			service.sendLifecycleEvent({
				email: "canonical@example.com",
				event: "first_prompt_sent",
				payload: { plan: "free" },
			}),
		).rejects.toBe(providerError);
	});
});
