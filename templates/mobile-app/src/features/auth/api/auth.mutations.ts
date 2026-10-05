/**
 * Write hooks of the auth feature: sign in, sign up, and sign out with
 * Supabase email and password. Each hook throws the Supabase error, so the
 * screen reads `mutation.error`. `useSession` sees the new session at once.
 */
import { isAuthError } from "@supabase/supabase-js";
import { useMutation } from "@tanstack/react-query";
import { successFeedback } from "@/shared/lib/haptics";
import { supabase } from "@/shared/lib/supabase";
import type { SignInInput, SignUpInput } from "../lib/auth.schemas";

/** Signs in with email and password. Throws the Supabase AuthError, for example `invalid_credentials`. */
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

/** Creates the account and signs it in. Throws when Supabase returns no session (email confirmation is on). */
export function useSignUp() {
	return useMutation({
		mutationKey: ["auth", "sign-up"],
		// Here, not in mutate(): the sign-in modal closes before a mutate() callback runs.
		onSuccess: successFeedback,
		mutationFn: async ({ email, password }: SignUpInput) => {
			const { data, error } = await supabase.auth.signUp({ email, password });
			if (error) {
				throw error;
			}
			// Email confirmation is off for this project, so a sign-up signs the user in.
			// No session means the project setting changed; the user cannot go on.
			if (data.session === null) {
				throw new Error(
					"Sign-up returned no session: email confirmation is on",
				);
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
		default:
			return "auth.errors.general";
	}
}
