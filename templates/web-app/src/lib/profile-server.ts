// Server functions for the /app route. Called by app.tsx.
// The handler runs in the Worker; the browser call is an RPC POST.
// Writes go through RLS with the user JWT, so a user writes their own row only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "./supabase";

const saveProfileInputSchema = z.object({
	/** Session access token from the browser client. Sent as the Authorization header. */
	accessToken: z.string().min(1),
	/** profiles.id. RLS checks it against auth.uid(), so a wrong id fails the write. */
	userId: z.string().min(1),
	// 200 chars is a sanity bound for a display name, not a column limit.
	fullName: z.string().trim().max(200),
});

/**
 * Upserts the caller's profiles row. Throws a zod error on bad input.
 * Returns `{ ok: false }` when Supabase or RLS rejects the write.
 */
export const saveProfileFn = createServerFn({ method: "POST" })
	.validator((data: unknown) => saveProfileInputSchema.parse(data))
	.handler(async ({ data }) => {
		const { error } = await getSupabaseServer(data.accessToken)
			.from("profiles")
			.upsert({ id: data.userId, full_name: data.fullName });
		if (error) {
			// The Worker log is the only place a rejected write is visible.
			console.error("Profile upsert failed", error.message);
		}
		return { ok: error === null };
	});
