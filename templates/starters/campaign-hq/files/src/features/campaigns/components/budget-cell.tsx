// The budget use of one campaign in a table cell: the percent used and a thin bar, then the spend of the budget.
// The campaign table renders it in its Budget column.
import { fillMessage, moneyFormat } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Progress } from "~/shared/ui/progress";
import type { Campaign } from "../api/campaigns.queries";

type BudgetCellProps = {
	/** One row of campaignsQueryOptions, with its totals to date. */
	campaign: Campaign;
};

/** The bar is the spend against the approved budget of the whole flight. */
export function BudgetCell({ campaign }: BudgetCellProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const compact = moneyFormat(locale, "compact");
	const label = fillMessage(t("campaigns.spentOf"), {
		spent: compact.format(campaign.totals.spend),
		budget: compact.format(campaign.budget),
	});
	// w-28 keeps the five columns of the table inside a 1024 px screen. The amounts go on their own line.
	return (
		<div className="grid w-28 gap-1 text-xs">
			<div className="flex items-center gap-2">
				<span className="w-8 shrink-0 font-medium tabular-nums">
					{percent.format(campaign.totals.spend / campaign.budget)}
				</span>
				<Progress
					value={campaign.totals.spend}
					max={campaign.budget}
					aria-label={label}
					className="h-1.5"
				/>
			</div>
			<span className="whitespace-nowrap text-muted-foreground tabular-nums">
				{label}
			</span>
		</div>
	);
}
