import type { GenericEndpointContext, User } from "better-auth";

export type OnUserCreated = (
	user: User,
	ctx: GenericEndpointContext | null,
) => void | Promise<void>;

export function createUserCreatedHook(onUserCreated?: OnUserCreated) {
	return async (
		user: User,
		ctx: GenericEndpointContext | null,
	): Promise<void> => {
		await onUserCreated?.(user, ctx);
	};
}
