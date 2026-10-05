// Reads the profiles row of the signed-in user with the browser Supabase client.
// The /app route loader fills the cache with it; the profile page reads the cache.
// The client sends the user JWT, so RLS returns only the caller's own row.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "~/shared/lib/supabase";

// The client ships no generated Database types, so the row is parsed here.
const profileRowSchema = z.object({ full_name: z.string().nullable() });

/** The profile as the UI shows it. `fullName` is "" before the first save. */
export type Profile = { fullName: string };

/** Query key and fetcher of one profile. `userId` is the `auth.users.id` of the session. */
export function profileQueryOptions(userId: string) {
	return queryOptions({
		queryKey: ["profile", userId],
		queryFn: async (): Promise<Profile> => {
			// maybeSingle returns null for a first login: no profiles row exists yet.
			const { data, error } = await getSupabase()
				.from("profiles")
				.select("full_name")
				.eq("id", userId)
				.maybeSingle();
			if (error) {
				throw error;
			}
			const row = profileRowSchema.nullable().parse(data);
			return { fullName: row?.full_name ?? "" };
		},
	});
}
