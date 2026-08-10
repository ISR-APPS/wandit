/**
 * Easy import file for auth helpers.
 *
 * Other modules can import from `modules/auth` instead of knowing the deep file
 * paths inside the auth folder.
 */
// Tokens Nest uses to find the isolated Better Auth instances.
export { ADMIN_AUTH_INSTANCE, AUTH_INSTANCE } from "./auth.constants";
// Lets controllers write `@CurrentUser()` to get the logged-in user.
export { CurrentUser } from "./presentation/http/decorators/current-user.decorator";
// Lets a route skip the global auth guard on purpose.
export { Public } from "./presentation/http/decorators/public.decorator";
// Gates product creation/generation/publishing/purchase routes during beta.
export { EarlyAccessGuard } from "./presentation/http/guards/early-access.guard";
// Request types used by the guard/decorator.
export type {
	AuthenticatedRequest,
	MaybeAuthenticatedRequest,
} from "./presentation/http/types/authenticated-request";
