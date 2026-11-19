// The accounts card of the home: one colored tile per account in a row that scrolls sideways.
// OverviewPage renders it in the last band with the accounts of accountsQueryOptions.
// Each tile opens the account page. "View all" opens the accounts list.
import { Link } from "@tanstack/react-router";
import { ACCOUNT_TYPE_ICONS, type AccountSummary } from "~/features/accounts";
import { countLabel, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// The tile fills, in the order of the list. The chart series are light on the dark looks, so the dark ink reads on them.
const TILE_FILLS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

type AccountsWalletCardProps = {
	/** Every account with its balance, the main account first. */
	accounts: AccountSummary[];
};

/** The row scrolls inside the card, so the page never scrolls sideways at 375 px. */
export function AccountsWalletCard({ accounts }: AccountsWalletCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.title")}</CardTitle>
				<CardDescription>
					{countLabel(
						accounts.length,
						t("overview.accountsOne"),
						t("overview.accountsOther"),
						locale,
					)}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/accounts">{t("overview.viewAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="flex snap-x gap-4 overflow-x-auto pb-1">
					{accounts.map((account, index) => {
						const Icon = ACCOUNT_TYPE_ICONS[account.type];
						return (
							<li
								key={account.id}
								className="@4xl/main:w-2/3 w-4/5 shrink-0 snap-start"
							>
								<Link
									to="/app/accounts/$accountId"
									params={{ accountId: account.id }}
									className={cn(
										"relative flex h-48 flex-col justify-between overflow-hidden rounded-lg p-6 text-primary-foreground",
										TILE_FILLS[index % TILE_FILLS.length],
									)}
								>
									{/* Two soft rings in the ink color, as on a printed bank card. */}
									<span
										aria-hidden="true"
										className="absolute -end-12 -top-12 size-32 rounded-full bg-current opacity-10"
									/>
									<span
										aria-hidden="true"
										className="absolute -start-10 -bottom-10 size-24 rounded-full bg-current opacity-10"
									/>
									<span className="relative grid gap-2">
										<span className="font-medium">{account.name}</span>
										<span className="font-numeric text-lg">
											{account.numberEnding
												? `•••• ${account.numberEnding}`
												: t(`accountTypes.${account.type}`)}
										</span>
									</span>
									<span className="relative flex items-center justify-between gap-2">
										<MoneyText
											amountCents={account.balanceCents}
											className="font-semibold text-2xl"
										/>
										<Icon aria-hidden="true" className="size-8" />
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
