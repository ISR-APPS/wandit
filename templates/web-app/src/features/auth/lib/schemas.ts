// Zod schemas of the sign-in form, the sign-up form, and the email code form.
// The login page and its code step parse their FormData with them before they call a mutation.
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

/** Replaces Arabic-Indic digits (U+0660 to U+0669) and Persian digits (U+06F0 to U+06F9) with 0 to 9. */
function toAsciiDigits(text: string): string {
	return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) =>
		// Each of the two blocks starts at a multiple of 16, so the remainder is the value of the digit.
		String(digit.charCodeAt(0) % 16),
	);
}

/**
 * The field of the email code step. A backend that sends the code email puts 6 digits in that email.
 * The provisioning of the backend sets that length. The parsed code holds ASCII digits only.
 */
export const emailCodeSchema = z.object({
	code: z
		.string()
		// An Arabic or Persian keypad types its own digits. Supabase compares the code as ASCII text.
		.transform(toAsciiDigits)
		.pipe(z.string().regex(/^\d{6}$/)),
});
