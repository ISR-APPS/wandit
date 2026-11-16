// The summary strip of the account list: the count of accounts, their active people, and the mix of health statuses.
// AccountsPage renders it above the table and passes the accounts of the chosen plan, so its counts equal the tab counts.
import { fillMessage, shareFormat, wholeShares } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import type { Account } from "../api/accounts.queries";
import { ACCOUNT_STATUSES, type AccountStatus } from "../lib/account-status";

/** The fill of each status in the bar and in the legend. The legend also names the status, so color is never alone. */
const STATUS_FILL = {
	healthy: "bg-success",
	new: "bg-info",
	at_risk: "bg-warning",
	dormant: "bg-muted-foreground/40",
} satisfies Record<AccountStatus, string>;

type AccountHealthStripProps = {
	/** The accounts of the chosen plan, before the status tab and the search. */
	accounts: Account[];
};

/** One bar with a segment per status. The width of a segment is its share of the accounts. */
export function AccountHealthStrip({ accounts }: AccountHealthStripProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const members = accounts.reduce((sum, account) => sum + account.members, 0);
	const activePeople = accounts.reduce(
		(sum, account) => sum + account.activePeople,
		0,
	);
	const counts = ACCOUNT_STATUSES.map(
		(status) => accounts.filter((account) => account.status === status).length,
	);
	const shares = wholeShares(counts);
	const statuses = ACCOUNT_STATUSES.map((status, index) => ({
		status,
		count: counts[index] ?? 0,
		share: shares[index] ?? 0,
	}));

	return (
		<Card>
			<CardContent className="grid @3xl/main:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @3xl/main:items-center gap-x-10 gap-y-6">
				<div className="grid gap-1.5">
					<p className="label-text text-muted-foreground text-sm">
						{t("accounts.health.accounts")}
					</p>
					<p className="font-numeric font-semibold text-3xl tabular-nums leading-none">
						{number.format(accounts.length)}
					</p>
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("accounts.health.people"), {
							active: number.format(activePeople),
							total: number.format(members),
						})}
					</p>
				</div>
				<div className="grid gap-4">
					<div
						aria-hidden="true"
						className="flex h-2.5 gap-0.5 overflow-hidden rounded-badge"
					>
						{accounts.length === 0 ? (
							<span className="flex-1 bg-muted" />
						) : (
							statuses.map(({ status, count }) =>
								count === 0 ? null : (
									<span
										key={status}
										className={STATUS_FILL[status]}
										style={{ flexGrow: count }}
									/>
								),
							)
						)}
					</div>
					<dl className="grid @2xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-4">
						{statuses.map(({ status, count, share: statusShare }) => (
							<div key={status} className="grid gap-1">
								<dt className="flex items-center gap-2 text-muted-foreground text-sm">
									<span
										aria-hidden="true"
										className={cn(
											"size-2 shrink-0 rounded-full",
											STATUS_FILL[status],
										)}
									/>
									{t(`accounts.statuses.${status}`)}
								</dt>
								<dd className="flex items-baseline gap-2">
									<span className="font-numeric font-semibold text-xl tabular-nums">
										{number.format(count)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{share.format(statusShare)}
									</span>
								</dd>
							</div>
						))}
					</dl>
				</div>
			</CardContent>
		</Card>
	);
}
