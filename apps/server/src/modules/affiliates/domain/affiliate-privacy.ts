import type { AffiliatePortalReversalReason } from "@wandit/contracts";

export function maskAffiliateEmail(email: string): string {
	const normalized = email.trim().toLowerCase();
	const separator = normalized.lastIndexOf("@");

	if (separator <= 0 || separator === normalized.length - 1) {
		return "***";
	}

	const local = normalized.slice(0, separator);
	const domain = normalized.slice(separator + 1);
	const localCharacters = Array.from(local);

	if (localCharacters.length === 1) {
		return `***@${domain}`;
	}

	return `${localCharacters[0]}***@${domain}`;
}

export function toPortalReversalReason(
	raw: string | null,
): AffiliatePortalReversalReason | null {
	if (raw === null) {
		return null;
	}

	const [reason] = raw.split(":", 1);

	switch (reason) {
		case "charge_refunded":
		case "charge_dispute_created":
		case "dispute_won":
			return reason;
		default:
			return reason?.startsWith("dispute_") ? "dispute_closed" : null;
	}
}
