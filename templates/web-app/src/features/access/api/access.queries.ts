// Reads public.app_access with the browser Supabase client: the row of the caller, and the list for the owner.
// The /app layout loader fills the cache with the row of the caller. The user menu and the requests dialog read the list.
// The client sends the user JWT. RLS returns the caller's own row, and all rows only to the owner.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "~/shared/lib/supabase";

/**
 * One account of the app. The base SQL (supabase/migrations/0000_base.sql) writes the row when Supabase Auth confirms the email.
 * On a backend that sends the code email, a person confirms it only with the code of that email.
 * The recovery, magic link, and email change emails of that backend hold no link and no code.
 * A backend that sends no email confirms it at sign-up, with no check.
 */
export type AppAccess = {
	/** `auth.users.id` of the account. */
	userId: string;
	/** Copy of the account email when the database wrote the row. Only a backend that sends the code email verified it. */
	email: string;
	/** The first account with a confirmed email is the owner. The database gives the role. */
	role: "owner" | "member";
	/** Only "approved" opens the app. The owner changes it for the other accounts. */
	status: "pending" | "approved" | "refused";
	/** Time when the database wrote the row: the email confirmation, or the run of the base SQL for an older account. */
	requestedAt: Date;
};

const ACCESS_COLUMNS = "user_id,email,role,status,requested_at";

// The client ships no generated Database types, so each row is parsed here.
const accessRowSchema = z
	.object({
		user_id: z.string(),
		email: z.string(),
		role: z.enum(["owner", "member"]),
		status: z.enum(["pending", "approved", "refused"]),
		requested_at: z.coerce.date(),
	})
	.transform(
		(row): AppAccess => ({
			userId: row.user_id,
			email: row.email,
			role: row.role,
			status: row.status,
			requestedAt: row.requested_at,
		}),
	);

/**
 * Query key and fetcher of the caller's own access row. `userId` is the `auth.users.id` of the session.
 * It throws when the read fails or no row exists. The gate then shows its error state, never the app.
 */
export function accessQueryOptions(userId: string) {
	return queryOptions({
		queryKey: ["appAccess", userId],
		queryFn: async (): Promise<AppAccess> => {
			const { data, error } = await getSupabase()
				.from("app_access")
				.select(ACCESS_COLUMNS)
				.eq("user_id", userId)
				.maybeSingle();
			if (error) {
				throw error;
			}
			const access = accessRowSchema.nullable().parse(data);
			if (!access) {
				// The base SQL writes one row per confirmed account, and a session needs a confirmed email.
				// No row: the session is anonymous, or SQL removed the row.
				throw new Error("No app_access row for this account");
			}
			return access;
		},
	});
}

/**
 * Query key and fetcher of all accounts that the caller can read, newest first.
 * Only the owner gets the full list: RLS gives each other account its own row.
 */
export function accessRequestsQueryOptions() {
	return queryOptions({
		queryKey: ["appAccess", "requests"],
		queryFn: async (): Promise<AppAccess[]> => {
			// LIMIT: the newest 200 accounts, and the browser counts the accounts that wait. Upgrade: pages, and a count in the database.
			const { data, error } = await getSupabase()
				.from("app_access")
				.select(ACCESS_COLUMNS)
				.order("requested_at", { ascending: false })
				.limit(200);
			if (error) {
				throw error;
			}
			return z.array(accessRowSchema).parse(data);
		},
	});
}
