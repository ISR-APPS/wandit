/**
 * Helpers of the user referral program. They read the invite code from a URL and keep it in the browser storage.
 * They also keep the mark of the bonus toast there.
 * They also build the invite link and the share links.
 * They hold the claim and activation rules of the web.
 * The components of this feature call them. The sign-in forms and the route "/" call them through the barrel.
 */
import {
	USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
	USER_REFERRAL_INVITE_PARAM,
	userReferralCodeSchema,
} from "@wandit/contracts";

// Key of the invite code in localStorage. The code waits there from the first visit until the claim after sign-in.
const STORED_INVITE_CODE_KEY = "wandit_user_referral_code";

// Key of the bonus mark in localStorage. Its value is the id of the user who saw the bonus toast.
const BONUS_SHOWN_USER_ID_KEY = "wandit_user_referral_bonus_shown";

// The auth gate and the magic link keep the destination path in this URL parameter.
const DESTINATION_PARAM = "next";

// `new URL` needs a base to read a path. The code reads only the query, so the host has no effect.
const PATH_PARSE_BASE = "http://localhost";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Reads the invite code from a URL search string, for example `?invite=abcd1234`.
 * @returns The code, or null when the parameter is absent or is not a valid code.
 */
export function parseInviteCode(search: string): string | null {
	const parsed = userReferralCodeSchema.safeParse(
		new URLSearchParams(search).get(USER_REFERRAL_INVITE_PARAM),
	);
	return parsed.success ? parsed.data : null;
}

/**
 * Reads the invite code inside the `next` destination, for example `?next=%2Fdashboard%3Finvite%3Dabcd1234`.
 * The auth gate sends a new user to /onboarding and moves the invite link into `next`.
 * Only UserReferralCapture calls it. No code removes this nested parameter from the address.
 */
export function parseInviteCodeOfDestination(search: string): string | null {
	const destination = new URLSearchParams(search).get(DESTINATION_PARAM);
	if (destination === null) return null;
	try {
		return parseInviteCode(new URL(destination, PATH_PARSE_BASE).search);
	} catch (error) {
		// `new URL` throws a TypeError for text that is not a URL. Such a destination holds no code.
		if (error instanceof TypeError) return null;
		throw error;
	}
}

/**
 * Gives the address of a page without its `invite` parameter. The path, the other parameters, and the hash stay.
 * @param href Full address of the current page, from `window.location.href`.
 * @returns Null when the address has no `invite` parameter. The caller then leaves the address as it is.
 */
export function removeInviteParam(href: string): string | null {
	const url = new URL(href);
	if (!url.searchParams.has(USER_REFERRAL_INVITE_PARAM)) return null;
	url.searchParams.delete(USER_REFERRAL_INVITE_PARAM);
	return url.toString();
}

/** The invite code that an earlier visit stored. Null when there is none, or when the stored text is not a valid code. */
export function readStoredInviteCode(): string | null {
	try {
		const parsed = userReferralCodeSchema.safeParse(
			window.localStorage.getItem(STORED_INVITE_CODE_KEY),
		);
		return parsed.success ? parsed.data : null;
	} catch (error) {
		// Some private modes block the storage. The visitor then has no stored code.
		console.warn("Read of the stored invite code failed", error);
		return null;
	}
}

/** Keeps the invite code for the claim after sign-in. A later code replaces an earlier one. */
export function storeInviteCode(code: string): void {
	try {
		window.localStorage.setItem(STORED_INVITE_CODE_KEY, code);
	} catch (error) {
		// Some private modes block the storage. The code then lives only until the next page load.
		console.warn("Write of the invite code to the storage failed", error);
	}
}

/** Removes the stored invite code after the API gave a final answer for it. */
export function clearStoredInviteCode(): void {
	try {
		window.localStorage.removeItem(STORED_INVITE_CODE_KEY);
	} catch (error) {
		// The code stays. The next load posts the claim again, and the API gives the same answer.
		console.warn("Removal of the stored invite code failed", error);
	}
}

/** Id of the user who saw the bonus toast in this browser. Null when there is none, or when the browser blocks the storage. */
export function readBonusShownUserId(): string | null {
	try {
		return window.localStorage.getItem(BONUS_SHOWN_USER_ID_KEY);
	} catch (error) {
		// Some private modes block the storage. A repeat claim then shows the bonus toast again.
		console.warn("Read of the bonus mark failed", error);
		return null;
	}
}

// LIMIT: one mark for each browser. A second browser shows the toast one more time. Upgrade: a "first claim" field in the API answer.
/** Marks that this user saw the bonus toast. The API answers `claimed` again on each repeat claim of a code. */
export function storeBonusShownUserId(userId: string): void {
	try {
		window.localStorage.setItem(BONUS_SHOWN_USER_ID_KEY, userId);
	} catch (error) {
		// Some private modes block the storage. A repeat claim then shows the bonus toast again.
		console.warn("Write of the bonus mark failed", error);
	}
}

/**
 * True when the API refused a claim for good, so the stored code has no more use.
 * A 401 or a 429 can pass on a later try. A 5xx, and the status 0 of a network error, are not an answer.
 * @param statusCode HTTP status of the failed claim, from ApiClientError.
 */
export function isFinalClaimRefusal(statusCode: number): boolean {
	return (
		statusCode >= 400 &&
		statusCode < 500 &&
		statusCode !== 401 &&
		statusCode !== 429
	);
}

/** The invite link of a code on this web origin: `<origin>/?invite=<code>`. */
export function buildInviteUrl(code: string): string {
	const inviteUrl = new URL("/", window.location.origin);
	inviteUrl.searchParams.set(USER_REFERRAL_INVITE_PARAM, code);
	return inviteUrl.toString();
}

/** The share targets that have a link. The native share sheet of a phone is not a link. */
export type ShareTarget = "whatsapp" | "x" | "facebook" | "email";

/** The texts of one share. The translated strings already hold the reward amount. */
export type ShareContent = {
	/** Full message for WhatsApp, X, and the email body. It ends with the invite link. */
	text: string;
	/** The invite link alone. Facebook takes only a link and reads the page for the rest. */
	inviteUrl: string;
	/** Subject line of the email. */
	emailSubject: string;
};

/**
 * Builds the link that opens one share target with the invite message.
 * `encodeURIComponent` writes a space as `%20`. A `+` shows as a plus sign in a mail app.
 */
export function buildShareUrl(
	target: ShareTarget,
	content: ShareContent,
): string {
	switch (target) {
		case "whatsapp":
			return `https://wa.me/?text=${encodeURIComponent(content.text)}`;
		case "x":
			return `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.text)}`;
		case "facebook":
			return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.inviteUrl)}`;
		case "email":
			return `mailto:?subject=${encodeURIComponent(content.emailSubject)}&body=${encodeURIComponent(content.text)}`;
	}
}

/**
 * Writes text to the clipboard. False, with a console error, when the browser refuses.
 * A copy of the project-sharing helper: that feature barrel does not export it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		// The browser refuses the clipboard outside a user gesture or a secure origin.
		console.error("Copy to the clipboard failed", error);
		return false;
	}
}

/**
 * True while a friend can still give the activation reward.
 * @param joinedAt ISO time of the join, from the summary.
 * @param now The current time. A parameter, so a spec can set it.
 */
export function isActivationWindowOpen(joinedAt: string, now: Date): boolean {
	const windowEndMs =
		new Date(joinedAt).getTime() +
		USER_REFERRAL_ACTIVATION_WINDOW_DAYS * MS_PER_DAY;
	return now.getTime() < windowEndMs;
}
