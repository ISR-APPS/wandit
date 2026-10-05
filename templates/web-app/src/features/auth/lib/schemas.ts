// Zod schemas of the sign-in and sign-up forms.
// The login page parses its FormData with them before it calls a mutation.
import { z } from "zod";

/** Supabase Auth refuses a password shorter than 6 characters by default. */
export const MIN_PASSWORD_LENGTH = 6;

/** Sign-in fields. Any non-empty password passes; only sign-up applies the minimum length. */
export const signInSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

/** Sign-up fields. The refine stops the call when the two passwords differ. */
export const signUpSchema = signInSchema
	.extend({
		password: z.string().min(MIN_PASSWORD_LENGTH),
		confirmPassword: z.string(),
	})
	.refine((fields) => fields.password === fields.confirmPassword, {
		path: ["confirmPassword"],
	});

/** Email and password, in the shape that Supabase Auth takes. */
export type Credentials = z.infer<typeof signInSchema>;
