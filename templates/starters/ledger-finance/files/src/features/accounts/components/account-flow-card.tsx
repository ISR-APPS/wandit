// The flow card of the account detail page: money in, money out, and the difference for the last 30 days,
// then the largest expense categories of the account with a share bar each.
// AccountDetailPage renders it in the rail.
import { MoneyText } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { AccountSummary, CategorySpend } from "../lib/account-summary";

type AccountFlowCardProps = {
	account: AccountSummary;
	/** The largest expense categories of the account in the last 30 days, the largest first. */
	topCategories: CategorySpend[];
};

/** Each category bar is a share of the largest category, so the first bar is full. */
export function AccountFlowCard({
	account,
	topCategories,
}: AccountFlowCardProps) {
	const { t } = useT();
	const largestCents = topCategories[0]?.spentCents ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.flowTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				<dl className="grid gap-3 text-sm">
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-muted-foreground">{t("overview.moneyIn")}</dt>
						<dd>
							<MoneyText
								amountCents={account.moneyInCents}
								sign="always"
								className="text-success"
							/>
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="text-muted-foreground">{t("overview.moneyOut")}</dt>
						<dd>
							<MoneyText amountCents={-account.moneyOutCents} />
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4 border-t pt-3">
						<dt className="font-medium">{t("accounts.netFlow")}</dt>
						<dd>
							<MoneyText
								amountCents={account.moneyInCents - account.moneyOutCents}
								sign="always"
								className="font-medium"
							/>
						</dd>
					</div>
				</dl>
				<div className="grid gap-3 border-t pt-5">
					<p className="label-text text-muted-foreground text-sm">
						{t("accounts.topCategories")}
					</p>
					{topCategories.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("accounts.noExpenses")}
						</p>
					) : (
						<ul className="grid gap-3">
							{topCategories.map((category) => (
								<li key={category.categoryId} className="grid gap-1.5">
									<div className="flex items-baseline justify-between gap-4 text-sm">
										<span>{t(`categories.${category.categoryId}`)}</span>
										<MoneyText amountCents={category.spentCents} />
									</div>
									<Progress
										value={category.spentCents}
										max={largestCents}
										className="h-1.5"
										aria-label={t(`categories.${category.categoryId}`)}
									/>
								</li>
							))}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
