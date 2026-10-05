// Sign-in, sign-up, and sign-out as React Query mutations over Supabase Auth.
// The login page and the user menu of the app shell call these hooks; they call getSupabase().auth.
// A Supabase error rejects the mutation, so the page reads it from `isError`.
import type { Session } from "@supabase/supabase-js";
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

/** Creates an account. Email confirmation is off, so it resolves to a session at once. */
export function useSignUpMutation() {
	return useMutation({
		mutationFn: async (credentials: Credentials): Promise<Session> => {
			const { data, error } = await getSupabase().auth.signUp(credentials);
			if (error) {
				throw error;
			}
			if (!data.session) {
				// Only a project with email confirmation on returns no session.
				throw new Error("Supabase returned no session after sign-up");
			}
			return data.session;
		},
	});
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
