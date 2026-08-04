/**
 * Normalizes an address for self-referral comparison.
 *
 * The affiliate rules intentionally collapse plus-address aliases for every
 * domain. Dot folding is not applied because it is provider-specific and can
 * merge distinct mailboxes on non-Gmail domains.
 */
export function normalizeAffiliateEmail(email: string): string {
	const normalized = email.trim().toLowerCase();
	const separator = normalized.lastIndexOf("@");

	if (separator <= 0 || separator === normalized.length - 1) {
		return normalized;
	}

	const local = normalized.slice(0, separator);
	const domain = normalized.slice(separator + 1);
	const plus = local.indexOf("+");
	const baseLocal = plus >= 0 ? local.slice(0, plus) : local;

	return `${baseLocal}@${domain}`;
}
