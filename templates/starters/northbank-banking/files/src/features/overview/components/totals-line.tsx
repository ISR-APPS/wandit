// The line of totals at the top of the home: one figure per KPI, split by thin rules, with no panel.
// OverviewPage renders it with the translated KPI items. It follows the home "ledger" of the app-dashboard skill.
import { ChangeLine, type KpiItem, MoneyText } from "~/features/bank";

type TotalsLineProps = {
	/** The figures in order of importance. Each value is money in cents. */
	items: KpiItem[];
};

/**
 * Under 36rem each figure takes one line: the label at the start, the value at the end.
 * From 36rem the figures sit side by side, with the delta under the value.
 */
export function TotalsLine({ items }: TotalsLineProps) {
	return (
		// The negative margin and overflow-hidden clip the start rule of the first figure on each line.
		// The margin is ps-6 plus the 1 px rule. It reads --spacing, so it follows the theme scale.
		<div className="overflow-hidden">
			<dl className="-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-4">
				{items.map((item) => (
					<div
						key={item.id}
						className="flex w-full @xl/main:min-w-40 @xl/main:flex-1 @xl/main:flex-col items-baseline justify-between gap-x-3 gap-y-1.5 border-s ps-6 @xl/main:pe-6"
					>
						<dt className="label-text text-muted-foreground text-sm">
							{item.label}
						</dt>
						<dd className="grid @xl/main:justify-items-start justify-items-end gap-0.5">
							<MoneyText
								amountCents={item.value}
								withCents={false}
								className="font-semibold @xl/main:text-3xl text-xl"
							/>
							<ChangeLine change={item.change} goodWhen={item.goodWhen} />
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
