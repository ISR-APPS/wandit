import { z } from "zod";

// Live-chat (Chatwoot) identity for the signed-in user. The web widget calls
// `$chatwoot.setUser(identifier, { identifier_hash, ... })` with this payload
// so Chatwoot can verify the visitor really is this account.
export const supportChatIdentityResponseSchema = z.object({
	// Stable contact identifier: the Wandit user id.
	identifier: z.string().min(1),
	// HMAC-SHA256(identifier) with the inbox token, lowercase hex. null when
	// the server has no CHATWOOT_HMAC_TOKEN (local dev) — the widget then
	// identifies the user without verification.
	identifierHash: z.string().length(64).nullable(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	avatarUrl: z.string().nullable(),
});

export type SupportChatIdentityResponse = z.infer<
	typeof supportChatIdentityResponseSchema
>;

export const supportRoutes = {
	chatIdentity: "/api/v1/support/chat-identity",
} as const;
