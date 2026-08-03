import { createHmac } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { APIError } from "better-auth/api";
import blocklist from "disposable-email-domains";
import wildcardBlocklist from "disposable-email-domains/wildcard.json";

import {
	AuthEmailSendsRepository,
	type AuthEmailSendCursor,
	type AuthEmailSendKind,
} from "../../infrastructure/persistence/auth-email-sends.repository";

// Sign-in sends (magic link + OTP) share one budget per recipient — the two
// kinds deliver the same capability, so separate budgets would just double
// the cap. Invitations are inviter-driven and budgeted separately.
const SIGN_IN_KINDS: AuthEmailSendKind[] = ["magic-link", "otp"];

const MIN_SECONDS_BETWEEN_SENDS = 30;
const MAX_SENDS_PER_EMAIL_PER_HOUR = 5;
const MAX_SENDS_PER_EMAIL_PER_DAY = 15;
const MAX_SENDS_PER_IP_PER_DAY = 30;
const MAX_INVITES_PER_EMAIL_PER_DAY = 5;
const MAX_INVITES_PER_INVITER_PER_DAY = 25;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const rateLimited = () =>
	APIError.from("TOO_MANY_REQUESTS", {
		code: "EMAIL_SEND_RATE_LIMITED",
		message: "Too many emails requested. Please wait before trying again.",
	});

/**
 * Anti-burner / anti-bombing gates for auth-related email sends. Layered on
 * top of Better Auth's IP-keyed limiter: this one caps sends per RECIPIENT
 * across IPs, and rejects disposable domains outright.
 */
@Injectable()
export class EmailSendPolicyService {
	private readonly logger = new Logger(EmailSendPolicyService.name);
	private readonly blockedDomains = new Set<string>(blocklist);
	private readonly blockedSuffixes: string[] = wildcardBlocklist.map(
		(domain) => `.${domain}`,
	);

	constructor(
		@Inject(AuthEmailSendsRepository)
		private readonly sends: AuthEmailSendsRepository,
	) {}

	/** Emails arrive canonicalized (packages/auth before-hook). */
	isDisposableDomain(email: string): boolean {
		const domain = email.slice(email.lastIndexOf("@") + 1);
		if (this.blockedDomains.has(domain)) {
			return true;
		}
		return this.blockedSuffixes.some(
			(suffix) => domain.endsWith(suffix) || `.${domain}` === suffix,
		);
	}

	assertDomainAllowed(email: string): void {
		if (this.isDisposableDomain(email)) {
			throw APIError.from("BAD_REQUEST", {
				code: "EMAIL_DOMAIN_BLOCKED",
				message: "This email domain is not supported.",
			});
		}
	}

	/**
	 * Gate for magic-link/OTP sends. Throws Better Auth APIErrors (the callers
	 * are Better Auth send callbacks, so the codes reach the web client
	 * verbatim). Records the send AFTER all gates pass — a vetoed request
	 * must not consume budget.
	 */
	async assertSignInSendAllowed(input: {
		email: string;
		ipAddress: string | null;
		kind: Extract<AuthEmailSendKind, "magic-link" | "otp">;
	}): Promise<void> {
		this.assertDomainAllowed(input.email);

		const now = Date.now();
		const ipHash = input.ipAddress ? this.hashIp(input.ipAddress) : null;

		// RECORD FIRST, then measure against the attempts that precede this
		// one. Checking before inserting is a TOCTOU — simultaneous requests
		// all read the same pre-insert counts and every one of them passes.
		// Writing first makes each attempt visible to its peers, and counting
		// only EARLIER rows (cursor order) resolves a burst to exactly one
		// winner instead of rejecting the whole batch. A refused attempt keeps
		// its row on purpose: spending budget on refused attempts is the
		// conservative direction for an abuse control, and rows expire in 2d.
		const cursor = await this.recordSend(input.email, ipHash, input.kind);

		// Min-gap is PER KIND: "email me a code instead" right after a magic
		// link is a legitimate first OTP send, not a resend. The hour/day
		// budgets stay pooled across both kinds.
		const [earlierSameKind, earlierHour, earlierDay] = await Promise.all([
			this.sends.countEarlierForEmail(
				input.email,
				new Date(now - MIN_SECONDS_BETWEEN_SENDS * 1000),
				[input.kind],
				cursor,
			),
			this.sends.countEarlierForEmail(
				input.email,
				new Date(now - HOUR_MS),
				SIGN_IN_KINDS,
				cursor,
			),
			this.sends.countEarlierForEmail(
				input.email,
				new Date(now - DAY_MS),
				SIGN_IN_KINDS,
				cursor,
			),
		]);

		if (
			earlierSameKind > 0 ||
			earlierHour >= MAX_SENDS_PER_EMAIL_PER_HOUR ||
			earlierDay >= MAX_SENDS_PER_EMAIL_PER_DAY
		) {
			throw rateLimited();
		}

		if (ipHash) {
			const earlierIp = await this.sends.countEarlierForIp(
				ipHash,
				new Date(now - DAY_MS),
				cursor,
			);
			if (earlierIp >= MAX_SENDS_PER_IP_PER_DAY) {
				throw rateLimited();
			}
		}
	}

	/**
	 * Gate for invitation emails. Domain veto happens earlier (invite-member
	 * before-hook) so a blocked invite fails CREATION with a clear error;
	 * this budgets delivery so re-invites cannot bomb a mailbox. Returns
	 * false instead of throwing — invitation delivery is best-effort and the
	 * invite itself (link + in-app banner) must survive a suppressed email.
	 */
	async allowInvitationSend(input: {
		email: string;
		inviterUserId: string;
	}): Promise<boolean> {
		if (this.isDisposableDomain(input.email)) {
			return false;
		}
		const since = new Date(Date.now() - DAY_MS);
		const [recipientCount, inviterCount] = await Promise.all([
			this.sends.countForEmailSince(input.email, since, ["invitation"]),
			// Per-INVITER budget, not just per-recipient: without it one
			// signed-in member can pump unlimited distinct addresses through
			// our verified sending domain, which is how a sender reputation
			// dies. Recipient cap alone only stops repeat-bombing one mailbox.
			this.sends.countForActorSince(input.inviterUserId, since, [
				"invitation",
			]),
		]);
		if (recipientCount >= MAX_INVITES_PER_EMAIL_PER_DAY) {
			this.logger.warn(
				`invitation_email_suppressed reason=recipient_cap cap=${MAX_INVITES_PER_EMAIL_PER_DAY}/day`,
			);
			return false;
		}
		if (inviterCount >= MAX_INVITES_PER_INVITER_PER_DAY) {
			this.logger.warn(
				`invitation_email_suppressed reason=inviter_cap inviter=${input.inviterUserId} cap=${MAX_INVITES_PER_INVITER_PER_DAY}/day`,
			);
			return false;
		}
		await this.recordSend(input.email, null, "invitation", input.inviterUserId);
		return true;
	}

	private async recordSend(
		emailCanonical: string,
		ipHash: string | null,
		kind: AuthEmailSendKind,
		actorId: string | null = null,
	): Promise<AuthEmailSendCursor> {
		const cursor = await this.sends.record({
			actorId,
			emailCanonical,
			ipHash,
			kind,
		});
		// Hygiene off the hot path; failures must never surface to the user.
		void this.sends
			.deleteOlderThan(new Date(Date.now() - 2 * DAY_MS))
			.catch((error: unknown) => {
				this.logger.warn(`auth_email_sends cleanup failed: ${String(error)}`);
			});

		return cursor;
	}

	/**
	 * Keyed with the app secret: the IPv4 space is small enough that a plain
	 * SHA-256 is reversible by brute force in seconds, which would make these
	 * rows raw addresses in all but name.
	 */
	private hashIp(ip: string): string {
		return createHmac("sha256", env.BETTER_AUTH_SECRET).update(ip).digest("hex");
	}
}
