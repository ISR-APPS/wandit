// Date helpers copied from the users table so both logs render timestamps
// identically.
export function formatPublicationDate(
	value: string | null,
	locale = "en-US",
	options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	},
) {
	if (!value) {
		return "—";
	}

	return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatPublicationDateTime(
	value: string | null,
	locale = "en-US",
) {
	return formatPublicationDate(value, locale, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

/**
 * Compact "how long ago" companion for the absolute timestamp. Falls back to
 * the short absolute date once a publish is older than a week.
 */
export function formatPublicationRelativeTime(
	value: string,
	nowMs = Date.now(),
): string {
	const elapsedMs = nowMs - Date.parse(value);
	const elapsedMinutes = Math.max(Math.floor(elapsedMs / 60_000), 0);

	if (elapsedMinutes < 1) {
		return "Just now";
	}

	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}

	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) {
		return `${elapsedDays}d ago`;
	}

	const elapsedWeeks = Math.floor(elapsedDays / 7);
	if (elapsedWeeks < 5) {
		return `${elapsedWeeks}w ago`;
	}

	return formatPublicationDate(value);
}

/** Hostname shown for a live link, e.g. "acme.wandit.site" or "acme.com". */
export function publicationLinkHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}
