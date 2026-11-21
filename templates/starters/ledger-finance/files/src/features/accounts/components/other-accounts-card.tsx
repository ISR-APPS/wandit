// The other-accounts card of the account page, in the kit connections list form: each other account
// with its type mark, its name, its bank and balance, and an open button.
// AccountDetailPage renders it beside the history card. The arrow opens the accounts list.
import { Link } from "@tanstack/react-router";
import { centsToUnits, moneyFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { ACCOUNT_TYPE_ICONS } from "../lib/account-icons";
import type { AccountSummary } from "../lib/account-summary";

type OtherAccountsCardProps = {
	/** Every other account, the main account first. */
	accounts: AccountSummary[];
};

/** The business always has more than one account, so the list is never empty in the sample. */
export function OtherAccountsCard({ accounts }: OtherAccountsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.otherTitle")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={t("accounts.openList")}
					>
						<Link to="/app/accounts">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{accounts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.noOther")}
					</p>
				) : (
					<ul className="grid gap-4">
						{accounts.map((account) => {
							const Icon = ACCOUNT_TYPE_ICONS[account.type];
							return (
								<li key={account.id} className="flex items-center gap-3">
									<span
										aria-hidden="true"
										className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
									>
										<Icon className="size-4" />
									</span>
									<div className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm">
											{account.name}
										</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{`${account.institution ?? t(`accountTypes.${account.type}`)} · ${money.format(centsToUnits(account.balanceCents))}`}
										</span>
									</div>
									<Button asChild variant="outline" size="sm">
										<Link
											to="/app/accounts/$accountId"
											params={{ accountId: account.id }}
										>
											{t("accounts.open")}
										</Link>
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
