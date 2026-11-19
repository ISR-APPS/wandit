// The second card of the account page, in the kit progress card form: one bar and its percent.
// For a card: the debt against the credit limit. For a bank or cash account: its share of all the cash of the business.
// AccountDetailPage renders it under the profile card.
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { AccountSummary } from "../lib/account-summary";

type AccountUsageCardProps = {
	account: AccountSummary;
	/** The sum of every account that is not a card, in cents. */
	cashOnHandCents: number;
};

/** The percent sits beside the bar, so the bar is never the only mark. */
export function AccountUsageCard({
	account,
	cashOnHandCents,
}: AccountUsageCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const isCard = account.creditLimitCents !== null;
	// A card balance is negative, so the debt is its opposite. A limit or a cash total of 0 gives an empty bar.
	const base = account.creditLimitCents ?? cashOnHandCents;
	const used = isCard ? -account.balanceCents : account.balanceCents;
	const share = base > 0 ? used / base : 0;
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{t(isCard ? "accounts.creditUsed" : "accounts.shareOfCash")}
				</CardTitle>
				<CardDescription>
					{t(isCard ? "accounts.creditUsedNote" : "accounts.shareOfCashNote")}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={share * 100}
					className="flex-1"
					aria-label={t(
						isCard ? "accounts.creditUsed" : "accounts.shareOfCash",
					)}
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
