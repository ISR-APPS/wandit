/**
 * The shapes of the profile feature. The Supabase client has no generated
 * types, so `fetchProfile` parses each row it reads with `profileRowSchema`.
 * `EditProfileScreen` checks the form with `profileFormSchema`.
 */
import { z } from "zod";

// 80 characters: a long full name fits; the profile header wraps it.
const FULL_NAME_MAX_LENGTH = 80;

/** One row of `public.profiles`, as `fetchProfile` selects it. */
export const profileRowSchema = z.object({
	id: z.uuid(),
	full_name: z.string().nullable(),
});

/** One parsed profile row. `full_name` is null until the user saves a name. */
export type ProfileRow = z.infer<typeof profileRowSchema>;

/** The edit form: a trimmed name of 1 to 80 characters. */
export const profileFormSchema = z.object({
	fullName: z.string().trim().min(1).max(FULL_NAME_MAX_LENGTH),
});
