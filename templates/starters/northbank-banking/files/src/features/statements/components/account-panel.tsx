// One account at the top of the statements page: its name, type, number ending, balance, and month change.
// StatementsPage renders one panel per account. A click on the panel filters the table to that account.
import { MoneyText } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import type { AccountSummary } from "../lib/statements";

type AccountPanelProps = {
	summary: AccountSummary;
	/** True when the statements table shows only this account. */
	isSelected: boolean;
	/** Runs on a click: the page filters the table to this account, or back to all. */
	onSelect: () => void;
};

/** The whole panel is one button. aria-pressed tells a screen reader that it filters the table. */
export function AccountPanel({
	summary,
	isSelected,
	onSelect,
}: AccountPanelProps) {
	const { t } = useT();
	const { account } = summary;
	return (
		<Card
			className={cn(
				"relative gap-3 py-5 transition-colors hover:bg-accent/40",
				isSelected && "border-ring",
			)}
		>
			<CardContent className="grid gap-3 px-5">
				{/* Between 42rem and 56rem three panels are narrow, so the account type takes its own line in each. */}
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
					<button
						type="button"
						onClick={onSelect}
						aria-pressed={isSelected}
						className="text-start font-medium after:absolute after:inset-0 focus-visible:outline-none"
					>
						{t(`accounts.${account.id}`)}
					</button>
					<span className="@2xl/main:@max-4xl/main:basis-full text-muted-foreground text-sm tabular-nums">
						{`${t(`accounts.types.${account.type}`)} ••${account.numberEnding}`}
					</span>
				</div>
				<MoneyText
					amountCents={summary.balanceCents}
					className="font-semibold text-2xl"
				/>
				<p className="text-muted-foreground text-sm">
					<MoneyText
						amountCents={summary.monthChangeCents}
						withCents={false}
						isSigned
					/>
					{` ${t("statements.sinceMonthStart")}`}
				</p>
			</CardContent>
		</Card>
	);
}
