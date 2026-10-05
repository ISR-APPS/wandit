/**
 * Write hooks of the profile feature. `useSaveProfile` writes the name of
 * the signed-in user to `public.profiles` and refetches the profile.
 * RLS allows a user to insert and update only the own row.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { profileKeys } from "./profile.queries";

/** The input of a profile save. `fullName` comes checked from `profileFormSchema`. */
type SaveProfileInput = {
	/** `auth.users.id` of the signed-in user, from `useSession`. */
	userId: string;
	fullName: string;
};

async function saveProfile({ userId, fullName }: SaveProfileInput) {
	// The base schema creates no profile row at sign-up, so the first save inserts it.
	await supabase
		.from("profiles")
		.upsert({
			id: userId,
			full_name: fullName,
			updated_at: new Date().toISOString(),
		})
		.throwOnError();
}

/** Saves the name, then refetches the profile. `isPending` stays true until the refetch ends. */
export function useSaveProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["profile", "save"],
		mutationFn: saveProfile,
		// The returned promise keeps `isPending` true until the new row is in the cache.
		onSuccess: (_data, { userId }) =>
			queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
	});
}
