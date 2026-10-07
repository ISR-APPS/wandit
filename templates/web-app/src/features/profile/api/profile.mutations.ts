// Saves the profile through the saveProfileFn server function.
// The profile page calls useSaveProfileMutation(); a success refetches the cached profile.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "~/shared/lib/supabase";
import { saveProfileFn } from "./profile.functions";
import { profileQueryOptions } from "./profile.queries";

/** Saves the full name of the signed-in user. Rejects when Supabase or RLS refuses the write. */
export function useSaveProfileMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (fullName: string) => {
			// Read the session now: Supabase refreshes an expired token here,
			// while a session kept since page load expires after one hour.
			const { data } = await getSupabase().auth.getSession();
			if (!data.session) {
				throw new Error("No signed-in session");
			}
			const result = await saveProfileFn({
				data: {
					accessToken: data.session.access_token,
					userId: data.session.user.id,
					fullName,
				},
			});
			if (!result.ok) {
				throw new Error("Supabase refused the profile write");
			}
			return data.session.user.id;
		},
		onSuccess: (userId) =>
			queryClient.invalidateQueries({
				queryKey: profileQueryOptions(userId).queryKey,
			}),
	});
}
