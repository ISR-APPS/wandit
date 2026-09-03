import { createAffiliateInputSchema } from "@wandit/contracts";

export function isValidAffiliateEmail(value: string): boolean {
	return createAffiliateInputSchema.shape.email.safeParse(value.trim()).success;
}

export function findExactEmailUser<T extends { email: string }>(
	users: readonly T[],
	email: string,
): T | undefined {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) {
		return undefined;
	}

	return users.find(
		(user) => user.email.trim().toLowerCase() === normalizedEmail,
	);
}
