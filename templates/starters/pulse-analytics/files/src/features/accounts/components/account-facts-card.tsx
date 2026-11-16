// The details card of the account page: the plan, the seats, the owner, and the other fixed facts.
// AccountDetailPage renders it with the account that the account query returns.
import {
	fillMessage,
	formatRelativeTime,
	ShareBar,
	shareFormat,
	shareOf,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { AccountDetail } from "../api/accounts.queries";

type AccountFactsCardProps = {
	/** The account of the page. */
	account: AccountDetail;
};

/** A list of facts. The seats line also draws how full the plan is. */
export function AccountFactsCard({ account }: AccountFactsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.facts.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-4 text-sm">
					<div className="grid gap-2">
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">
								{t("accounts.facts.seats")}
							</dt>
							<dd className="tabular-nums">
								{fillMessage(t("accounts.facts.seatsValue"), {
									used: number.format(account.members),
									total: number.format(account.seats),
								})}
								<span className="ms-2 text-muted-foreground">
									{share.format(shareOf(account.members, account.seats))}
								</span>
							</dd>
						</div>
						<ShareBar share={shareOf(account.members, account.seats)} />
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.plan")}
						</dt>
						<dd>{t(`plans.${account.plan}`)}</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.owner")}
						</dt>
						<dd className="grid min-w-0 justify-items-end">
							<span>{account.owner.name}</span>
							<span className="max-w-full truncate text-muted-foreground text-xs">
								{account.owner.email}
							</span>
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.industry")}
						</dt>
						<dd>{account.industry}</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.region")}
						</dt>
						<dd>{t(`regions.${account.region}`)}</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.customerSince")}
						</dt>
						<dd>{date.format(new Date(account.createdAt))}</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">
							{t("accounts.facts.lastSeen")}
						</dt>
						<dd>
							{account.lastSeenAt
								? formatRelativeTime(account.lastSeenAt, now, locale)
								: t("accounts.neverSeen")}
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
