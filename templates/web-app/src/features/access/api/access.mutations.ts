// The owner's decision on one account: a plain update of app_access.status with the browser Supabase client.
// The requests dialog calls useDecideAccessMutation(). A success reads the access rows again.
// RLS and a column grant do the security check: only the owner writes, and never the owner row.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "~/shared/lib/supabase";

/** What the owner decides for one account. */
export type AccessDecision = {
	/** `auth.users.id` of the account to change. RLS refuses the id of the owner. */
	userId: string;
	/** The new status. The update policy accepts only these two values. */
	status: "approved" | "refused";
};

// The update returns the rows that it changed. The client ships no generated Database types.
const changedRowsSchema = z.array(z.object({ user_id: z.string() }));

/** Approves or refuses one account. Rejects when Supabase fails or when RLS lets the write change no row. */
export function useDecideAccessMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ userId, status }: AccessDecision) => {
			const { data, error } = await getSupabase()
				.from("app_access")
				.update({ status })
				.eq("user_id", userId)
				.select("user_id");
			if (error) {
				throw error;
			}
			// RLS hides a row that the caller cannot change, so a refused write gives no error and no row.
			if (changedRowsSchema.parse(data).length === 0) {
				throw new Error("The access decision changed no row");
			}
		},
		// The prefix of the two keys in access.queries.ts: the caller's row and the list.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appAccess"] }),
	});
}
