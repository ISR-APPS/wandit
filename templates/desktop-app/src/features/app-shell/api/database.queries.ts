// The open check of the database. DatabaseGate runs it before the first page renders.
// In the preview the first db call opens and migrates the sql.js copy. In the desktop app the shell
// migrated before the window could query, and a failed start answers migration_failed to every call.
import { queryOptions } from "@tanstack/react-query";
import { select } from "~/lib/db";

/** Resolves when the database answers a query. Rejects with the DbError of a failed start. */
export function databaseReadyQueryOptions() {
	return queryOptions({
		queryKey: ["database-ready"],
		queryFn: () => select<{ ready: number }>("SELECT 1 AS ready"),
		// The start state does not change while the app runs, so the check runs once.
		staleTime: Number.POSITIVE_INFINITY,
	});
}
