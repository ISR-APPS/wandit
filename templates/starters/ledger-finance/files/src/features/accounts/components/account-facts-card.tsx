// The facts card of the account detail page: the bank, the number, the opening day, and the state of the books.
// AccountDetailPage renders it in the rail. A card account also shows how much of its limit is in use.
import { dayFormat, dayToDate, MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { AccountSummary } from "../lib/account-summary";

type AccountFactsCardProps = {
	account: AccountSummary;
};

/** Each fact is one line: the name at the start and the value at the end. */
export function AccountFactsCard({ account }: AccountFactsCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	// A card balance is negative, so the debt is its opposite.
	const debtCents = Math.max(-account.balanceCents, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.details")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				<dl className="grid gap-3 text-sm">
					{account.institution ? (
						<div className="flex items-baseline justify-between gap-4">
							<dt className="text-muted-foreground">
								{t("accounts.institution")}
							</dt>
							<dd className="text-end">
								<bdi>{account.institution}</bdi>
							</dd>
						</div>
					) : null}
					{account.numberEnding ? (
						<div className="flex items-baseline justify-between gap-4">
							<dt className="text-muted-foreground">{t("accounts.number")}</dt>
							<dd className="tabular-nums">{`•••• ${account.numberEnding}`}</dd>
						</div>
					) : null}
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-muted-foreground">{t("accounts.opened")}</dt>
						<dd className="tabular-nums">
							{day.format(dayToDate(account.openedDay))}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-muted-foreground">
							{t("accounts.lastReconciled")}
						</dt>
						<dd className="tabular-nums">
							{account.lastReconciledDay
								? day.format(dayToDate(account.lastReconciledDay))
								: t("accounts.never")}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-muted-foreground">
							{t("accounts.pendingEntries")}
						</dt>
						<dd className="tabular-nums">
							{number.format(account.pendingCount)}
						</dd>
					</div>
				</dl>
				{account.creditLimitCents === null ? null : (
					<div className="grid gap-2 border-t pt-5">
						<div className="flex items-baseline justify-between gap-4 text-sm">
							<span className="text-muted-foreground">
								{t("accounts.creditUsed")}
							</span>
							<span className="font-numeric tabular-nums">
								{percent.format(debtCents / account.creditLimitCents)}
							</span>
						</div>
						<Progress
							value={debtCents}
							max={account.creditLimitCents}
							aria-label={t("accounts.creditUsed")}
						/>
						<p className="text-muted-foreground text-xs">
							{t("accounts.creditLimit")}{" "}
							<MoneyText
								amountCents={account.creditLimitCents}
								withCents={false}
							/>
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
