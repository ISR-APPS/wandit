/**
 * Easy import file for auth helpers.
 *
 * Other modules can import from `modules/auth` instead of knowing the deep file
 * paths inside the auth folder.
 */
// Tokens Nest uses to find the isolated Better Auth instances.
export { ADMIN_AUTH_INSTANCE, AUTH_INSTANCE } from "./auth.constants";
// The ban rule of AuthGuard. McpTokenGuard applies it to the user of an MCP access token.
export { isBanActive } from "./domain/ban";
// Lets a write route accept any browser origin (public lead capture only).
export { AllowCrossSiteWrite } from "./presentation/http/decorators/allow-cross-site-write.decorator";
// Lets controllers write `@CurrentUser()` to get the logged-in user.
export { CurrentUser } from "./presentation/http/decorators/current-user.decorator";
// Lets a route skip the global auth guard on purpose.
export { Public } from "./presentation/http/decorators/public.decorator";
// main.ts rules for the OAuth provider: the form-body paths and the metadata CORS.
export {
	isOAuthFormBodyPath,
	OAUTH_FORM_BODY_LIMIT_BYTES,
	oauthMetadataCorsOptions,
} from "./presentation/http/oauth-http-boundary";
// Request types used by the guard/decorator.
export type {
	AuthenticatedRequest,
	MaybeAuthenticatedRequest,
} from "./presentation/http/types/authenticated-request";
