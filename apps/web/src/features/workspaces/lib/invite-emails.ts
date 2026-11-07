/**
 * Parses the email box of the People invite form. People paste lists from
 * mail clients and spreadsheets, so commas, semicolons, spaces, and new lines
 * all separate addresses. The server checks each address again.
 */
import { z } from "zod";

const emailSchema = z.email();

/** Most emails one invite batch sends. Each email is one Better Auth call; 20 matches the project invite cap. */
export const WORKSPACE_INVITE_EMAILS_MAX = 20;

/** Lower-case unique addresses in paste order, and the entries that are not addresses. */
export function parseInviteEmails(text: string): {
	emails: string[];
	invalid: string[];
} {
	const emails: string[] = [];
	const invalid: string[] = [];

	for (const entry of text.split(/[\s,;]+/)) {
		if (entry === "") {
			continue;
		}

		// Email matching is case-insensitive on the server, so "A@x.com" and "a@x.com" are one invite.
		const email = entry.toLowerCase();

		if (!emailSchema.safeParse(email).success) {
			invalid.push(entry);
		} else if (!emails.includes(email)) {
			emails.push(email);
		}
	}

	return { emails, invalid };
}
