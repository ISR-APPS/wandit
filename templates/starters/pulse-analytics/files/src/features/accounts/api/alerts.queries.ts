// Reads of the header alerts: the accounts "at risk", the largest drop of active users first.
// HeaderNotifications reads it after the shell renders. The rule comes from lib/account-status.ts,
// so the bell counts the same accounts as the "At risk" filter of the Accounts page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { listAccounts } from "./accounts.queries";

// Each alert opens the page of its account. linkOptions types the path, so a wrong path fails typecheck.
function accountLink(accountId: string) {
	return linkOptions({
		to: "/app/accounts/$accountId",
		params: { accountId },
	});
}

/** One alert of the bell menu: an account whose active users fell by 20 % or more. */
export type Alert = {
	/** The URL id of the account. */
	id: string;
	/** The account name. */
	title: string;
	/** The change of active users against the 30 days before, as a ratio: -0.32 is a drop of 32 %. */
	drop: number;
	/** The active users of the last 30 days. */
	activeUsers: number;
	/** ISO time of the last event of the account. */
	at: string;
	link: ReturnType<typeof accountLink>;
};

/** Every at-risk account, the largest drop first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> =>
			listAccounts()
				.flatMap((account) =>
					account.status === "at_risk" && account.lastSeenAt !== null
						? {
								id: account.id,
								title: account.name,
								drop: account.change ?? 0,
								activeUsers: account.activePeople,
								at: account.lastSeenAt,
								link: accountLink(account.id),
							}
						: [],
				)
				.sort((first, second) => first.drop - second.drop),
	});
}
