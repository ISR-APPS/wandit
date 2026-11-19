// The top accounts card of the rep page: the 5 accounts with the largest bookings of the quarter.
// RepDetailPage renders it in the end column, beside the largest orders card.
// The arrow button switches the page to the Accounts tab, which lists every account of the rep.
import {
	fillMessage,
	initialsOf,
	moneyFormat,
	pluralOf,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { RepAccount } from "../api/reps.queries";

// Shows the 5 largest accounts. The Accounts tab lists every account.
const SHOWN_ACCOUNTS = 5;

type RepAccountsCardProps = {
	/** Every account of the rep, the largest amount first. */
	accounts: RepAccount[];
	/** Switches the page to the Accounts tab. */
	onViewAll: () => void;
};

/** Each row: initials, the name over the segment and the order count, then the amount at the end. */
export function RepAccountsCard({ accounts, onViewAll }: RepAccountsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const top = accounts.slice(0, SHOWN_ACCOUNTS);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reps.accountsTitle")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label={t("reps.allAccounts")}
						onClick={onViewAll}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{top.map((account) => (
					<div key={account.id} className="flex items-center gap-4">
						<Avatar aria-hidden className="size-9">
							<AvatarFallback className="bg-muted font-medium text-xs">
								{initialsOf(account.name)}
							</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 gap-0.5">
							<bdi className="truncate font-medium">{account.name}</bdi>
							<span className="truncate text-muted-foreground text-xs">
								{`${t(`segments.${account.segment}`)} · ${fillMessage(
									t(`reps.orderCount.${pluralOf(locale, account.orders)}`),
									{ count: number.format(account.orders) },
								)}`}
							</span>
						</div>
						<span className="shrink-0 font-medium text-sm tabular-nums">
							{money.format(account.amount)}
						</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
