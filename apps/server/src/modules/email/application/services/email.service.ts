import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { APIError } from "better-auth/api";
import { Resend } from "resend";

import {
	type EmailContent,
	invitationEmail,
	type ManualRequestEmailData,
	magicLinkEmail,
	manualRequestEmail,
	otpEmail,
} from "../../templates/auth-email-templates";

/**
 * All outgoing product email. Sends are awaited by the auth flows so a
 * delivery failure surfaces to the user as a retryable error instead of a
 * silent black hole (there is no user-existence oracle to protect: email
 * sign-in is open to any address, so timing reveals nothing).
 *
 * Without RESEND_API_KEY, non-production logs the full email to the server
 * console — the local dev loop for magic links and OTPs — and production
 * refuses with a 503 so a misconfigured deploy is loud, not lossy.
 */
@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private readonly resend = env.RESEND_API_KEY
		? new Resend(env.RESEND_API_KEY)
		: null;

	/**
	 * Console delivery prints sign-in secrets, so it is opt-IN on an explicit
	 * local NODE_ENV. An unset or unexpected NODE_ENV must fail loudly rather
	 * than quietly logging magic links and OTPs into a production log sink.
	 */
	private readonly canLogToConsole =
		env.NODE_ENV === "development" || env.NODE_ENV === "test";

	/**
	 * True when a send can actually be delivered. The email-auth admission
	 * gate calls this BEFORE issuing a code: the OTP plugin runs its send
	 * callback through runInBackgroundOrAwait, which swallows errors into a
	 * `success: true` response, so an unconfigured provider would otherwise
	 * tell the user "code sent" forever.
	 */
	isDeliverable(): boolean {
		return this.resend !== null || this.canLogToConsole;
	}

	async sendMagicLinkEmail(to: string, url: string): Promise<void> {
		await this.deliver(to, magicLinkEmail(url), `magic link: ${url}`);
	}

	async sendOtpEmail(to: string, otp: string): Promise<void> {
		await this.deliver(to, otpEmail(otp), `sign-in code: ${otp}`);
	}

	async sendInvitationEmail(data: {
		to: string;
		inviterName: string;
		organizationName: string;
		inviteUrl: string;
	}): Promise<void> {
		await this.deliver(
			data.to,
			invitationEmail(data),
			`invitation: ${data.inviteUrl}`,
		);
	}

	async sendManualRequestEmail(
		to: readonly string[],
		data: ManualRequestEmailData,
	): Promise<void> {
		await this.deliver(
			[...to],
			manualRequestEmail(data),
			`offline subscription request: ${data.fullName}`,
		);
	}

	private async deliver(
		to: string | string[],
		content: EmailContent,
		devSummary: string,
	): Promise<void> {
		if (!this.resend) {
			if (!this.canLogToConsole) {
				this.logger.error(
					"RESEND_API_KEY is not set — refusing to pretend an email was sent",
				);
				throw APIError.from("SERVICE_UNAVAILABLE", {
					code: "EMAIL_DELIVERY_UNAVAILABLE",
					message: "Email delivery is not available right now.",
				});
			}
			this.logger.log(`[dev email] to=${to} ${devSummary}`);
			return;
		}

		const { error } = await this.resend.emails.send({
			from: env.EMAIL_FROM,
			to,
			subject: content.subject,
			html: content.html,
			text: content.text,
		});

		if (error) {
			this.logger.error(
				`email_send_failed to=${to} subject="${content.subject}" error=${error.name}: ${error.message}`,
			);
			throw APIError.from("SERVICE_UNAVAILABLE", {
				code: "EMAIL_DELIVERY_UNAVAILABLE",
				message: "We could not send the email. Please try again.",
			});
		}
	}
}
