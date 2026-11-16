// The newest rows panel of the home: the six accounts that signed up last.
// OverviewPage renders it. The panel reads the account list that the home loader put in the cache.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ACCOUNT_STATUS_BADGE,
	accountsQueryOptions,
} from "~/features/accounts";
import {
	fillMessage,
	formatRelativeTime,
	NameMark,
	TOUCH_AREA,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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

/** How many accounts the panel lists. The ranked panel beside it has the same count of lines. */
const NEWEST_COUNT = 6;

/** Each row opens the page of its account. "See all" opens the account list. */
export function NewestAccountsCard() {
	const { t, locale } = useT();
	const { data: accounts } = useSuspenseQuery(accountsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.newest.title")}</CardTitle>
				<CardDescription>{t("overview.newest.description")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm" className={TOUCH_AREA}>
						<Link to="/app/accounts">{t("overview.newest.seeAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid">
					{accounts.slice(0, NEWEST_COUNT).map((account) => (
						<li
							key={account.id}
							className="flex items-center gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
						>
							<NameMark name={account.name} />
							<div className="grid min-w-0 flex-1 justify-items-start">
								<Link
									to="/app/accounts/$accountId"
									params={{ accountId: account.id }}
									className={cn(
										"max-w-full font-medium text-sm hover:underline",
										TOUCH_AREA,
									)}
								>
									{account.name}
								</Link>
								<span className="max-w-full truncate text-muted-foreground text-xs">
									{fillMessage(t("overview.newest.planAndPeople"), {
										plan: t(`plans.${account.plan}`),
										count: number.format(account.members),
									})}
								</span>
							</div>
							<Badge variant={ACCOUNT_STATUS_BADGE[account.status]}>
								{t(`accounts.statuses.${account.status}`)}
							</Badge>
							<span className="hidden w-24 text-end text-muted-foreground text-xs sm:block">
								{formatRelativeTime(account.createdAt, now, locale)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
