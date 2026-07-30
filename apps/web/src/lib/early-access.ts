// Temporary launch gate for the YouTube announcement window: generation is
// visible only to these accounts until subscriptions open. UI-level only by
// design — it hides the prompt box, it is not a security boundary. Add or
// remove emails here; matching is case-insensitive.
const EARLY_ACCESS_EMAILS = ["zakisb97@gmail.com"];

export function isEarlyAccessUser(email: string | null | undefined): boolean {
	if (!email) {
		return false;
	}

	const normalized = email.trim().toLowerCase();
	return EARLY_ACCESS_EMAILS.some((allowed) => allowed === normalized);
}
