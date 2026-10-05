/**
 * Read hooks of the profile feature. `useProfile` reads the row of the
 * signed-in user from `public.profiles` through Supabase. RLS returns only
 * that row. The mutations file invalidates `profileKeys` after a write.
 */
import { skipToken, useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { type ProfileRow, profileRowSchema } from "../lib/profile.schemas";

/** The cache keys of this feature. A write invalidates the key it changed. */
export const profileKeys = {
	all: ["profile"] as const,
	detail: (userId: string) => [...profileKeys.all, userId] as const,
};

/** The profile row of one user, or null when the user has no row yet. */
async function fetchProfile(userId: string): Promise<ProfileRow | null> {
	const { data } = await supabase
		.from("profiles")
		.select("id, full_name")
		.eq("id", userId)
		.maybeSingle()
		.throwOnError();
	return data === null ? null : profileRowSchema.parse(data);
}

/**
 * The profile of the signed-in user. Pass null while nobody is signed in:
 * the query then waits and fetches nothing.
 */
export function useProfile(userId: string | null) {
	return useQuery({
		queryKey: profileKeys.detail(userId ?? ""),
		queryFn: userId === null ? skipToken : () => fetchProfile(userId),
	});
}
