import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const sessionUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.email(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authRoutes = {
	me: "/api/v1/auth/me",
} as const;
