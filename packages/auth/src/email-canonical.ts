// Canonical email identity for auth entry points.
//
// One human inbox must map to exactly ONE user row no matter how the address
// is spelled, or gmail dot/plus aliases become infinite burner accounts (each
// with its own signup grant) and the same person forks into duplicate
// accounts across Google vs magic-link sign-ins. Every boundary that accepts
// an email (magic-link send, OTP send + verify, Google profile mapping,
// invitation send) canonicalizes through this function, and migration 0020
// backfilled existing rows — so plain exact-match lookups unify identities.
//
// Rules (keep in lockstep with the SQL expression in 0020_moaning_whiplash):
// - trim + lowercase;
// - drop one "+suffix" from the local part, all domains (RFC subaddressing —
//   the canonical address delivers to the same mailbox on every mainstream
//   provider);
// - gmail.com/googlemail.com additionally: dots in the local part are
//   insignificant → dropped, and the domain normalizes to gmail.com.
//
// A leading "+" yields an empty local part; the endpoint's z.email()
// validation then rejects the request, which is the desired failure.

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function canonicalizeEmail(raw: string): string {
	const email = raw.trim().toLowerCase();
	const at = email.lastIndexOf("@");
	if (at === -1) {
		return email;
	}
	let local = email.slice(0, at).split("+")[0] ?? "";
	let domain = email.slice(at + 1);
	if (GMAIL_DOMAINS.has(domain)) {
		local = local.replaceAll(".", "");
		domain = "gmail.com";
	}
	return `${local}@${domain}`;
}
