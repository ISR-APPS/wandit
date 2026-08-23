import { z } from "zod";

export const pushTokenPlatforms = ["ios", "android"] as const;

export const pushTokenPlatformSchema = z.enum(pushTokenPlatforms);

export type PushTokenPlatform = z.infer<typeof pushTokenPlatformSchema>;

export const expoPushTokenSchema = z.string().trim().min(1).max(4_096);

export const registerPushTokenBodySchema = z.object({
	platform: pushTokenPlatformSchema,
	token: expoPushTokenSchema,
});

export type RegisterPushTokenBody = z.infer<typeof registerPushTokenBodySchema>;

export const unregisterPushTokenBodySchema = z.object({
	token: expoPushTokenSchema,
});

export type UnregisterPushTokenBody = z.infer<
	typeof unregisterPushTokenBodySchema
>;

export const pushTokenMutationResponseSchema = z.object({
	ok: z.literal(true),
});

export type PushTokenMutationResponse = z.infer<
	typeof pushTokenMutationResponseSchema
>;

export const registerPushTokenResponseSchema = pushTokenMutationResponseSchema;
export const unregisterPushTokenResponseSchema =
	pushTokenMutationResponseSchema;

export type RegisterPushTokenResponse = PushTokenMutationResponse;
export type UnregisterPushTokenResponse = PushTokenMutationResponse;

export const pushTokenRoutes = {
	register: "/api/v1/push-tokens",
	unregister: "/api/v1/push-tokens",
} as const;
