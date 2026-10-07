/**
 * The checks of the sign-in and sign-up forms, before any network call.
 * `SignInScreen` parses the form values with them on submit.
 */
import { z } from "zod";

// 8 characters: stricter than the Supabase minimum of 6, and short enough to type on a phone.
const PASSWORD_MIN_LENGTH = 8;

// Phone keyboards and autofill often add a space after the address.
const emailSchema = z.string().trim().pipe(z.email());

/** The sign-in form: an email and any non-empty password. */
export const signInSchema = z.object({
	email: emailSchema,
	password: z.string().min(1),
});

/** The values of the sign-in form after the check. */
export type SignInInput = z.infer<typeof signInSchema>;

/** The sign-up form. The refine marks `confirmPassword` when the two passwords differ. */
export const signUpSchema = z
	.object({
		email: emailSchema,
		password: z.string().min(PASSWORD_MIN_LENGTH),
		// min(1): an empty field equals an empty password, so the refine below alone accepts it.
		confirmPassword: z.string().min(1),
	})
	.refine((values) => values.password === values.confirmPassword, {
		path: ["confirmPassword"],
	});

/** The values of the sign-up form after the check. */
export type SignUpInput = z.infer<typeof signUpSchema>;
