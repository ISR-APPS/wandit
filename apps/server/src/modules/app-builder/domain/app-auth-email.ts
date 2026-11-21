/**
 * The sign-up code email of a generated app: the sender name, the HTML
 * body, the fixed sender settings, and the template version gate. Also the
 * body with no link of the other auth emails.
 * `provision-backend.runtime.ts` and `BackendAuthUrlsService` call the
 * functions. `SupabaseManagementClient` sends the constants. Pure code, no IO.
 */
import {
	findPhishingTerm,
	holdsPlatformName,
} from "./publish-gate/phishing-rules";

/**
 * SMTP host of Resend, the shared sender. `BackendAuthUrlsService` reads it
 * in the auth config to find a backend that sends the code email.
 */
export const APP_AUTH_SMTP_HOST = "smtp.resend.com";

/** A string in the Management API. Supabase Auth uses implicit TLS only on port 465. */
export const APP_AUTH_SMTP_PORT = "465";

/** Resend takes this fixed user name. The API key is the password. */
export const APP_AUTH_SMTP_USER = "resend";

/** Subject of the sign-up code email. It holds no app name, so no user text. */
export const APP_AUTH_CONFIRMATION_SUBJECT = "Confirm your email";

/**
 * Emails per hour for one app backend. Supabase gives 30 with custom SMTP,
 * which stops sign-up on a launch day.
 */
export const APP_AUTH_EMAILS_PER_HOUR = 100;

/** 3600 s. The email body says that the code works for 1 hour. */
export const APP_AUTH_CODE_TTL_SEC = 3600;

/** Digits of the code. The login page of the templates takes 6 digits. */
export const APP_AUTH_CODE_LENGTH = 6;

// The From name must stay short in an inbox list.
const SENDER_NAME_MAX_LENGTH = 60;

// The name of an app whose project name is empty or fails the name checks.
const FALLBACK_SENDER_NAME = "Your app";

// Control characters and the bidirectional controls (U+202A to U+202E, U+2066
// to U+2069), which can reorder the shown text. Then the characters that can
// break the HTML or start a Go template action. Then "=?", the start of a
// MIME encoded word. A mail client can decode such a word and show a
// different name.
const UNSAFE_NAME_TEXT = /[\p{Cc}\u202a-\u202e\u2066-\u2069<>"{}]|=\?/gu;

/**
 * The From name of the code email, made from `projects.name`. Security
 * check: the name is user text in an email from a Wandit domain. It answers
 * "Your app" for an empty name, a phishing term, and the platform name.
 */
export function appEmailSenderName(projectName: string): string {
	const cleanName = projectName
		.replace(UNSAFE_NAME_TEXT, " ")
		.replace(/\s+/g, " ")
		.trim();
	// Cut by code point: a cut by UTF-16 unit can split one emoji in two.
	const name = Array.from(cleanName)
		.slice(0, SENDER_NAME_MAX_LENGTH)
		.join("")
		.trim();
	// Security check: the email has the DKIM signature of Wandit. A sender with
	// the platform name looks like a message from Wandit itself.
	// `findPhishingTerm` reads a dot as a domain separator and drops the last
	// label. A project name is free text, so each dot becomes a space first.
	// LIMIT: a term or the platform name that two adjacent words make also gives the fallback ("Design Inc" holds "signin"). Upgrade: match each word alone for free text.
	if (
		isInvisible(name) ||
		holdsPlatformName(name) ||
		findPhishingTerm(name.replaceAll(".", " ")) !== null
	) {
		return FALLBACK_SENDER_NAME;
	}
	return name;
}

// True for an empty name and for a name that shows no glyph, such as a
// zero-width space, a soft hyphen, a Hangul filler, or a blank braille cell
// (U+2800). The check does not remove these characters from other names:
// Persian text and emoji sequences need the zero-width joiners.
function isInvisible(name: string): boolean {
	return (
		name.replace(/[\p{Default_Ignorable_Code_Point}\s\u2800]/gu, "") === ""
	);
}

// LIMIT: English only. Upgrade: one text per app language.
/**
 * The HTML of the sign-up code email, a Go template that Supabase Auth
 * fills. `{{ .Token }}` is the code and `{{ .Email }}` is the address of the
 * new user. It holds no link, no image, and no tracking.
 */
export function confirmationEmailHtml(senderName: string): string {
	const name = escapeHtml(senderName);
	return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#000000;">
<tr><td style="padding-bottom:24px;"><h1 style="margin:0;font-size:28px;line-height:36px;font-weight:700;">Confirm your email</h1></td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#333333;padding-bottom:16px;">Thanks for signing up for <b>${name}</b>!</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#333333;padding-bottom:24px;">Enter this code in the app to confirm your email address ({{ .Email }}):</td></tr>
<tr><td style="padding-bottom:24px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#000000;color:#ffffff;border-radius:8px;padding:16px 28px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;">{{ .Token }}</td></tr></table></td></tr>
<tr><td style="font-size:14px;line-height:20px;color:#333333;padding-bottom:32px;">The code works for 1 hour.</td></tr>
<tr><td style="font-size:12px;line-height:18px;color:#999999;">If you didn't create an account, you can safely ignore this email.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Subject of the recovery email, the magic link email, and the email change
 * email. It holds no Go template action, so no code leaves the backend.
 */
export const APP_AUTH_NO_LINK_SUBJECT = "No action is needed";

// LIMIT: English only. Upgrade: one text per app language.
/**
 * One body for the recovery email, the magic link email, and the email
 * change email. Security: it holds no Go template action. The default body
 * of Supabase holds a link, and one GET of that link confirms the account.
 */
export const APP_AUTH_NO_LINK_HTML = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#000000;">
<tr><td style="padding-bottom:24px;"><h1 style="margin:0;font-size:28px;line-height:36px;font-weight:700;">No action is needed</h1></td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#333333;padding-bottom:16px;">Someone asked for a sign-in link, a password reset link, or an email change link for this email address.</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#333333;padding-bottom:32px;">This app does not send these links by email.</td></tr>
<tr><td style="font-size:12px;line-height:18px;color:#999999;">You can safely ignore this email.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

/**
 * True when the login page of the project has the code step: "web-app@1.2.0"
 * and later, "mobile-app@1.3.0" and later. A null version, "desktop-app",
 * and any other text answer false. Provisioning reads it to choose the mode.
 */
export function supportsEmailCode(templateVersion: string | null): boolean {
	const version =
		/^(?<template>web-app|mobile-app)@(?<major>\d+)\.(?<minor>\d+)\.\d+$/.exec(
			templateVersion ?? "",
		)?.groups;
	if (version === undefined) {
		return false;
	}
	// The first minor version of major 1 that has the code step.
	const firstCodeMinor = version.template === "mobile-app" ? 3 : 2;
	const major = Number(version.major);
	// Compare numbers, not text: "1.10.0" is later than "1.2.0".
	return major > 1 || (major === 1 && Number(version.minor) >= firstCodeMinor);
}

// Security check: the name is user text. A brace becomes an entity, so no
// name can start a Go template action in the email body.
function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
		.replaceAll("{", "&#123;")
		.replaceAll("}", "&#125;");
}
