// The top accounts card of the home: the accounts with the most events in the period,
// each with its change against the period before. OverviewPage renders it in the second row of three.
// "View all" opens the account list. A name opens the page of the account.
import { Link } from "@tanstack/react-router";
import { changeRatio, NameMark } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { AccountEvents } from "../api/overview.queries";
import { ChangeText } from "./change-text";

type TopAccountsCardProps = {
	/** The description line, already translated: it names the period. */
	description: string;
	/** The busiest accounts, the most events first. */
	accounts: AccountEvents[];
};

/** A round initials mark stands where the kit shows a flag. No account in the period shows one sentence. */
export function TopAccountsCard({
	description,
	accounts,
}: TopAccountsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.topAccounts.title")}</CardTitle>
				<CardDescription>{description}</CardDescription>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<Link to="/app/accounts">
							{t("overview.topAccounts.viewAll")}
							<CaretRightIcon className="size-4 rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{accounts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.topAccounts.empty")}
					</p>
				) : (
					<ul className="grid gap-5">
						{accounts.map((account) => (
							<li key={account.id} className="flex items-center gap-4">
								<NameMark
									name={account.name}
									className="size-10 rounded-full"
								/>
								<div className="grid min-w-0 gap-1">
									<Link
										to="/app/accounts/$accountId"
										params={{ accountId: account.id }}
										className="truncate font-medium text-sm leading-none hover:underline"
									>
										{account.name}
									</Link>
									<p className="text-muted-foreground text-sm">
										<ChangeText
											change={changeRatio(account.current, account.previous)}
										/>{" "}
										{t("overview.topAccounts.fromBefore")}
									</p>
								</div>
								<span className="ms-auto font-medium tabular-nums">
									{number.format(account.current)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
