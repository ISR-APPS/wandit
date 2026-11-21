// Sign-in, sign-up, the email code check, the password save, and sign-out as React Query mutations over Supabase Auth.
// The login page and the user menu of the app shell call these hooks; they call getSupabase().auth.
// A Supabase error rejects the mutation, so the page reads it from `isError` and `error`.
import { isAuthApiError, type Session } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getSupabase } from "~/shared/lib/supabase";
import type { Credentials } from "../lib/schemas";

/** Signs in with email and password. Resolves to the new session. */
export function useSignInMutation() {
	return useMutation({
		mutationFn: async (credentials: Credentials): Promise<Session> => {
			const { data, error } =
				await getSupabase().auth.signInWithPassword(credentials);
			if (error) {
				throw error;
			}
			return data.session;
		},
	});
}

/**
 * Creates an account. A backend that sends the code email resolves to null: the code step comes next.
 * A backend that sends no email resolves to a session at once.
 * The caller cannot know which one the project has before this answer.
 */
export function useSignUpMutation() {
	return useMutation({
		mutationFn: async (credentials: Credentials): Promise<Session | null> => {
			const { data, error } = await getSupabase().auth.signUp(credentials);
			if (error) {
				throw error;
			}
			return data.session;
		},
	});
}

type EmailCode = {
	/** Address of the account that waits for its confirmation. */
	email: string;
	/** The 6 digits from the sign-up email. */
	code: string;
};

/**
 * Checks the code of the sign-up email. A correct code confirms the email and resolves to the session.
 * A wrong code, an old code, and an unknown address all reject with the same error.
 */
export function useVerifyEmailCodeMutation() {
	return useMutation({
		mutationFn: async ({ email, code }: EmailCode): Promise<Session> => {
			// "email" is the type that Supabase documents for a code that a person types.
			const { data, error } = await getSupabase().auth.verifyOtp({
				email,
				token: code,
				type: "email",
			});
			if (error) {
				throw error;
			}
			if (!data.session) {
				// The library type allows no session here. A correct code always gives one.
				throw new Error("Supabase returned no session after the code check");
			}
			return data.session;
		},
	});
}

/**
 * Asks for a new sign-up code for this email address.
 * Supabase answers success also when it sends no email, so a success is not a proof.
 */
export function useResendEmailCodeMutation() {
	return useMutation({
		mutationFn: async (email: string): Promise<void> => {
			const { error } = await getSupabase().auth.resend({
				type: "signup",
				email,
			});
			if (error) {
				throw error;
			}
		},
	});
}

type AccountPassword = {
	/** `auth.users.id` of the session that the code check returned. */
	userId: string;
	/** Password that the person typed in the login form. */
	password: string;
};

/**
 * The browser does not hold the session of the code check.
 * Another tab replaced or removed it, or Supabase refused its refresh.
 * A new try of the password save never works. The person signs in again.
 */
export class SessionChangedError extends Error {}

/**
 * Saves the password of the login form on the account of the code check. Call it after a correct code.
 * Before the confirmation, another person can set or clear the account password with a direct call to Supabase.
 * It rejects with `SessionChangedError`, and writes nothing, when the browser holds no session or another session.
 */
export function useSetAccountPasswordMutation() {
	return useMutation({
		mutationFn: async ({
			userId,
			password,
		}: AccountPassword): Promise<void> => {
			const auth = getSupabase().auth;
			const { data, error: sessionError } = await auth.getSession();
			if (sessionError) {
				throw sessionError;
			}
			// Security: `updateUser` writes to the account of the stored session, and another tab can replace that session.
			if (data.session?.user.id !== userId) {
				throw new SessionChangedError(
					"The stored session is not the session of the code check",
				);
			}
			// LIMIT: the check and the write are two calls, so the check does not see a session change between them. Upgrade: a second client with memory storage for the code step.
			// A changed password also closes all other sessions of the account.
			const { error } = await auth.updateUser({ password });
			// The usual case: the account already has this password, and Supabase refuses an equal one.
			if (error && !hasAuthErrorCode(error, "same_password")) {
				throw error;
			}
		},
	});
}

/** The Supabase Auth error codes that the auth feature reads. supabase-js does not export its code list. */
type LoginErrorCode =
	| "email_not_confirmed"
	| "over_email_send_rate_limit"
	| "same_password";

/**
 * True when a failed auth mutation has this Supabase error code.
 * An error with no code, such as a network error, answers false.
 */
export function hasAuthErrorCode(
	error: unknown,
	code: LoginErrorCode,
): boolean {
	return isAuthApiError(error) && error.code === code;
}

/** Signs out, opens the landing page, then drops the cached data of the old user. */
export function useSignOutMutation() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	return useMutation({
		mutationFn: async () => {
			const { error } = await getSupabase().auth.signOut();
			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await navigate({ to: "/" });
			// The next user of this browser must never see rows of the old user.
			queryClient.clear();
		},
	});
}
