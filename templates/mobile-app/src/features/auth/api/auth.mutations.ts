/**
 * Write hooks of the auth feature, with Supabase email and password. They sign in,
 * sign up, confirm the email with a code, send a new code, and sign out. Each hook
 * throws the Supabase error, so the screen reads `mutation.error`. `useSession`
 * sees the new session at once. After a code check, it sees the session only when
 * the account holds the password of the form.
 */
import { isAuthError } from "@supabase/supabase-js";
import { useMutation } from "@tanstack/react-query";
import { successFeedback } from "@/shared/lib/haptics";
import { signUpAuth, supabase } from "@/shared/lib/supabase";
import type {
	EmailCodeInput,
	SignInInput,
	SignUpInput,
} from "../lib/auth.schemas";

/**
 * The answer of a sign-up. The app cannot know the mode of the backend before this answer.
 * `signed-in`: a backend that sends no email gives a session at once.
 * `confirm-email`: a backend that sends the code email gives no session. The code has 6 digits.
 */
type SignUpResult =
	| { kind: "signed-in" }
	| {
			kind: "confirm-email";
			/** The address that gets the code: the email of the form, after its check. */
			email: string;
	  };

/**
 * Signs in with email and password. Throws the Supabase AuthError, for example
 * `invalid_credentials`, or `email_not_confirmed` while the account waits for its code.
 */
export function useSignIn() {
	return useMutation({
		mutationKey: ["auth", "sign-in"],
		// Here, not in mutate(): the sign-in modal closes before a mutate() callback runs.
		onSuccess: successFeedback,
		mutationFn: async ({ email, password }: SignInInput) => {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (error) {
				throw error;
			}
		},
	});
}

/**
 * Creates the account. Resolves to `signed-in`, or to `confirm-email` when the
 * backend gives no session. The screen then shows the code view.
 */
export function useSignUp() {
	return useMutation({
		mutationKey: ["auth", "sign-up"],
		// Here, not in mutate(): the sign-in modal closes before a mutate() callback runs.
		onSuccess: (result) => {
			if (result.kind === "signed-in") {
				successFeedback();
			}
		},
		mutationFn: async ({
			email,
			password,
		}: SignUpInput): Promise<SignUpResult> => {
			const { data, error } = await supabase.auth.signUp({ email, password });
			if (error) {
				throw error;
			}
			// A backend that sends the code email confirms the address first, and gives no session.
			// It answers the same for an address with a confirmed account, and then sends nothing.
			if (data.session === null) {
				return { kind: "confirm-email", email };
			}
			return { kind: "signed-in" };
		},
	});
}

/**
 * The two calls of the code view. `formPassword` is the password of the form that opened the view.
 * Supabase accepted it at the sign-up, or checked it before it refused the sign-in.
 * `verifyCode` confirms the email. Supabase accepts a code one time.
 * `finishSignUp` runs by itself after a right code. Call it again only when it fails.
 */
export function useEmailCodeConfirmation(formPassword: string) {
	const finishSignUp = useFinishSignUp();
	const verifyCode = useMutation({
		mutationKey: ["auth", "verify-email-code"],
		// Here, not in mutate(): a mutate() callback does not run after the modal closes.
		// A user can close the modal during the check. The password save must run also then.
		onSuccess: () => finishSignUp.mutate(formPassword),
		// Throws `otp_expired` for a wrong code and for an old code.
		mutationFn: async ({ email, code }: EmailCodeInput) => {
			// Security: a session in `supabase` opens the app. The account can still hold the
			// password of an older sign-up, or no password, so the session stays apart.
			const { data, error } = await signUpAuth.verifyOtp({
				email,
				token: code,
				// "email" is the type for a typed code. Supabase finds the sign-up code of the account.
				type: "email",
			});
			if (error) {
				throw error;
			}
			// A right code always gives a session. Without one the user cannot go on.
			if (data.session === null) {
				throw new Error("The email code check returned no session");
			}
		},
	});
	return { verifyCode, finishSignUp };
}

/**
 * The last step after a right code. It saves the password of the form on the confirmed
 * account, then gives the session of `signUpAuth` to the app. The modal then closes.
 * A second sign-up before the confirmation keeps the first password, and another person can own it.
 * A direct call to Supabase can also clear the password of an account that waits for its code.
 * A failed call can run again: an equal password counts as saved.
 * It throws when the app already has a session, and that session stays.
 */
function useFinishSignUp() {
	return useMutation({
		mutationKey: ["auth", "finish-sign-up"],
		// Here, not in mutate(): the sign-in modal closes before a mutate() callback runs.
		onSuccess: successFeedback,
		mutationFn: async (password: string) => {
			// Open risk: from the code check until this answer, the account holds the first password. No client code closes it.
			const { error: saveError } = await signUpAuth.updateUser({ password });
			// The usual case: the account already has this password, and Supabase refuses an equal one.
			if (saveError && saveError.code !== "same_password") {
				throw saveError;
			}
			// The password change keeps this session. It closes the other sessions of the account.
			const { data, error: sessionError } = await signUpAuth.getSession();
			if (sessionError) {
				throw sessionError;
			}
			if (data.session === null) {
				throw new Error("The sign-up client holds no session");
			}
			// Security: this answer can come late, after the user signed in with another account.
			// The app then keeps its session. The account is confirmed, and a sign-in opens it later.
			// LIMIT: the check and the hand-over are two calls. A sign-in that ends between them loses its session.
			// Upgrade: one server call that checks the code and saves the password. The app then signs in as usual.
			const { data: appData, error: appError } =
				await supabase.auth.getSession();
			if (appError) {
				throw appError;
			}
			if (appData.session !== null) {
				throw new Error("The app already has a session");
			}
			// `useSession` sees the session only here, after the password save.
			const { error } = await supabase.auth.setSession({
				access_token: data.session.access_token,
				refresh_token: data.session.refresh_token,
			});
			if (error) {
				throw error;
			}
		},
	});
}

/**
 * Sends the sign-up code again. The new code replaces the old one. Supabase answers
 * success also when it sends nothing: an unknown address, or a confirmed account.
 * Throws `over_email_send_rate_limit` when the last email is too recent. The old code then stays valid.
 */
export function useResendEmailCode() {
	return useMutation({
		mutationKey: ["auth", "resend-email-code"],
		mutationFn: async (email: string) => {
			const { error } = await supabase.auth.resend({ type: "signup", email });
			if (error) {
				throw error;
			}
		},
	});
}

/** Signs out. The session store then clears the React Query cache. */
export function useSignOut() {
	return useMutation({
		mutationKey: ["auth", "sign-out"],
		mutationFn: async () => {
			const { error } = await supabase.auth.signOut();
			if (error) {
				throw error;
			}
		},
	});
}

/** True when a sign-in failed only because the account still waits for its email code. */
export function isEmailNotConfirmedError(error: Error) {
	return isAuthError(error) && error.code === "email_not_confirmed";
}

/** The translation key of a failed auth call. Unknown errors get the general text. */
export function authErrorKey(error: Error) {
	if (!isAuthError(error)) {
		return "auth.errors.general";
	}
	switch (error.code) {
		case "invalid_credentials":
			return "auth.errors.wrongCredentials";
		case "user_already_exists":
		case "email_exists":
			return "auth.errors.emailTaken";
		case "weak_password":
			return "auth.errors.weakPassword";
		case "email_not_confirmed":
			return "auth.errors.emailNotConfirmed";
		case "over_email_send_rate_limit":
			return "auth.errors.emailRateLimit";
		// Supabase gives this one code for a wrong code and for an old code.
		case "otp_expired":
			return "auth.errors.wrongCode";
		default:
			return "auth.errors.general";
	}
}
