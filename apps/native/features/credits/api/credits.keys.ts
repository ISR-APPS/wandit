/** Shared cache keys for the authenticated credit balance. */
export const creditsKeys = {
	all: ["credits"] as const,
	balance: () => [...creditsKeys.all, "balance"] as const,
};
