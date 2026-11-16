// The facts row of the customer page: four figures of the whole customer list in one ruled row with no panels.
// CustomersPage renders it above the table with the rows of the customer query.
// The first and the last figure equal the counts of the "All" and the "Lapsed" tabs.
import { fillMessage, moneyFormat } from "~/features/shop";
import { useT } from "~/shared/i18n";
import type { Customer } from "../api/customers.queries";
import { LAPSED_AFTER_DAYS } from "../lib/segment";

type CustomerFactsProps = {
	/** Every customer of the list query, with no filter. */
	customers: Customer[];
};

/** One `dl` with one `div` for each fact. The wrapper clips the start rule of the first fact of each line. */
export function CustomerFacts({ customers }: CustomerFactsProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const count = customers.length;
	const repeatCount = customers.filter((row) => row.orderCount > 1).length;
	const lapsedCount = customers.filter(
		(row) => row.segment === "lapsed",
	).length;
	const spent = customers.reduce((sum, row) => sum + row.spent, 0);

	const facts = [
		{
			id: "count",
			label: t("customers.title"),
			value: number.format(count),
			hint: t("customers.factCountHint"),
		},
		{
			id: "repeat",
			label: t("customers.factRepeat"),
			// No customer gives no share: the figure shows 0 %.
			value: percent.format(count === 0 ? 0 : repeatCount / count),
			hint: fillMessage(t("customers.factRepeatHint"), {
				count: number.format(repeatCount),
			}),
		},
		{
			id: "spent",
			label: t("customers.factSpent"),
			value: moneyFormat(locale).format(count === 0 ? 0 : spent / count),
			hint: t("customers.factSpentHint"),
		},
		{
			id: "lapsed",
			label: t("customers.segments.lapsed"),
			value: number.format(lapsedCount),
			hint: fillMessage(t("customers.factLapsedHint"), {
				days: number.format(LAPSED_AFTER_DAYS),
			}),
		},
	];

	return (
		<div className="overflow-hidden">
			{/* The negative margin is the ps-6 padding plus the 1 px rule. It hides the rule of each line start. */}
			<dl className="-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-6">
				{facts.map((fact) => (
					<div
						key={fact.id}
						className="grid @4xl/main:flex-1 basis-1/2 content-start gap-1 border-s ps-6 pe-6"
					>
						<dt className="label-text text-muted-foreground text-sm">
							{fact.label}
						</dt>
						<dd className="font-numeric font-semibold text-2xl">
							{fact.value}
						</dd>
						<dd className="text-muted-foreground text-xs">{fact.hint}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
