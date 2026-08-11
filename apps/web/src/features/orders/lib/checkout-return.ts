export type DomainCheckoutReturn =
	| { kind: "cancel" }
	| { kind: "success"; sessionId: string };

const CHECKOUT_RETURN_PARAMS = ["checkout", "purpose", "session_id"] as const;

export function currentCheckoutReturnPath(): string {
	return `${window.location.pathname}${window.location.search}`;
}

export function domainCheckoutReturnFromSearch(
	search: string,
): DomainCheckoutReturn | null {
	const params = new URLSearchParams(search);
	const checkout = params.get("checkout");

	if (checkout === "cancel") {
		return { kind: "cancel" };
	}

	if (checkout !== "success") {
		return null;
	}

	const sessionId = params.get("session_id")?.trim();
	return sessionId ? { kind: "success", sessionId } : null;
}

export function withoutCheckoutReturnParams(search: string): string {
	const params = new URLSearchParams(search);

	for (const param of CHECKOUT_RETURN_PARAMS) {
		params.delete(param);
	}

	const nextSearch = params.toString();
	return nextSearch ? `?${nextSearch}` : "";
}
