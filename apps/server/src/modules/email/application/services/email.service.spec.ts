import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	EMAIL_FROM: "Wandit <onboarding@resend.dev>",
	NODE_ENV: "test" as string,
	RESEND_API_KEY: undefined as string | undefined,
}));

const sendMock = vi.hoisted(() =>
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
		emails = { send: sendMock };
	},
}));

import { EmailService } from "./email.service";

describe("EmailService", () => {
	beforeEach(() => {
		sendMock.mockClear();
		sendMock.mockResolvedValue({ error: null });
		mockEnv.RESEND_API_KEY = undefined;
		mockEnv.NODE_ENV = "test";
	});

	it("logs instead of sending when no key is set outside production", async () => {
		const service = new EmailService();
		await expect(
			service.sendMagicLinkEmail("user@example.com", "https://x/verify?t=1"),
		).resolves.toBeUndefined();
		expect(sendMock).not.toHaveBeenCalled();
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
		expect(sendMock).toHaveBeenCalledTimes(1);
		const payload = sendMock.mock.calls[0]?.[0] as unknown as {
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

	it("surfaces provider failures as retryable delivery errors", async () => {
		mockEnv.RESEND_API_KEY = "re_test_key";
		sendMock.mockResolvedValue({
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
		const payload = sendMock.mock.calls[0]?.[0] as unknown as {
			html: string;
			subject: string;
		};
		expect(payload.html).not.toContain("<img src=x");
		expect(payload.html).not.toContain("<script>");
		expect(payload.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(payload.html).toContain("Acme &amp; Sons &lt;script&gt;");
		expect(payload.html).toContain("https://app.example.com/invite/inv_1");
	});
});
