/**
 * The checks of the sign-in form, the sign-up form, and the email code, before any network call.
 * `SignInScreen` and its code view parse the typed values with them on submit.
 */
import { z } from "zod";

// 8 characters: stricter than the Supabase minimum of 6, and short enough to type on a phone.
const PASSWORD_MIN_LENGTH = 8;

/** 6 digits: the code length that the host sets on the backend for the sign-up email. */
export const EMAIL_CODE_LENGTH = 6;

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

// An Arabic or a Persian number pad can give the digits U+0660 to U+0669 or U+06F0 to U+06F9.
// Supabase compares ASCII text, so the check changes them to 0-9 first.
function toAsciiDigits(text: string) {
	// 16: the last hex digit of each of these code points is the digit itself.
	return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) =>
		String(digit.charCodeAt(0) % 16),
	);
}

/**
 * The code view: the address that waits for its code, and the digits from the email.
 * The parsed `code` holds ASCII digits only, also when the user types Arabic or Persian digits.
 */
export const emailCodeSchema = z.object({
	email: emailSchema,
	code: z
		.string()
		.transform(toAsciiDigits)
		.pipe(z.string().length(EMAIL_CODE_LENGTH).regex(/^\d+$/)),
});

/** The values of the code view after the check. */
export type EmailCodeInput = z.infer<typeof emailCodeSchema>;
