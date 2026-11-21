// The activity card of the account page, in the kit activity timeline form: the 3 newest entries of the account
// on a vertical rule with an icon dot. AccountDetailPage renders it at the top of the wide column.
// "View all" opens the Entries tab. The newest entry gets a "Latest" badge and an open button.
import {
	ArrowDownIcon,
	ArrowsLeftRightIcon,
	ArrowUpIcon,
	ClockIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	fillMessage,
	MoneyText,
	type TransactionType,
} from "~/features/ledger";
import type { TransactionRow } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

// The icon of each type: money in, money out, and a move between accounts.
const TYPE_ICONS = {
	income: ArrowDownIcon,
	expense: ArrowUpIcon,
	transfer: ArrowsLeftRightIcon,
} satisfies Record<TransactionType, KitIcon>;

// The timeline shows this many entries, as the kit activity card does.
const SHOWN_ENTRIES = 3;

type AccountActivityCardProps = {
	/** Every entry of the account, newest first. The card shows the first 3. */
	rows: TransactionRow[];
	/** Opens the Entries tab of the page. */
	onViewAll: () => void;
};

/** No entry in the history: one muted sentence. */
export function AccountActivityCard({
	rows,
	onViewAll,
}: AccountActivityCardProps) {
	const { t, locale } = useT();
	const longDay = dayFormat(locale, "long");
	const shown = rows.slice(0, SHOWN_ENTRIES);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.activityTitle")}</CardTitle>
				{shown.length === 0 ? (
					<CardDescription>{t("accounts.noEntries")}</CardDescription>
				) : null}
				<CardAction>
					<button
						type="button"
						onClick={onViewAll}
						className="text-muted-foreground text-sm hover:text-foreground hover:underline"
					>
						{t("accounts.viewAll")}
					</button>
				</CardAction>
			</CardHeader>
			{shown.length === 0 ? null : (
				<CardContent className="ps-8">
					<ol className="relative grid gap-10 border-s">
						{shown.map((row, index) => {
							const Icon = TYPE_ICONS[row.type];
							return (
								<li key={row.id} className="grid gap-2 ps-6">
									<span
										aria-hidden="true"
										className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted"
									>
										<Icon className="size-3 text-primary" />
									</span>
									<h3 className="flex flex-wrap items-center gap-2 font-semibold">
										<span dir="auto">{row.payee}</span>
										<MoneyText
											amountCents={row.amountCents}
											sign="always"
											className="font-normal text-muted-foreground text-sm"
										/>
										{index === 0 ? (
											<Badge variant="outline">{t("accounts.latest")}</Badge>
										) : null}
									</h3>
									<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
										<ClockIcon aria-hidden="true" className="size-3" />
										{fillMessage(t("accounts.bookedOn"), {
											day: longDay.format(dayToDate(row.day)),
										})}
									</p>
									<p className="text-muted-foreground text-sm" dir="auto">
										{`${row.memo} · ${t(`categories.${row.categoryId}`)}`}
									</p>
									{index === 0 ? (
										<Button
											asChild
											variant="outline"
											className="justify-self-start"
										>
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
											>
												{t("accounts.openEntry")}
											</Link>
										</Button>
									) : null}
								</li>
							);
						})}
					</ol>
				</CardContent>
			)}
		</Card>
	);
}
