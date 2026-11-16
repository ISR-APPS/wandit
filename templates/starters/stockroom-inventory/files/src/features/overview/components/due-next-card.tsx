// The deliveries to come: open orders that are not late, the soonest expected day first.
// OverviewPage renders it last in the rail. Each row opens the order panel of the order list.
import { Link } from "@tanstack/react-router";
import type { PurchaseOrder } from "~/features/purchase-orders";
import { formatRelativeDay, pluralForm } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

// Four rows: the rail then fits a 900 px laptop screen next to five attention rows and the figures.
const SHOWN_ROWS = 4;

type DueNextCardProps = {
	/** Open orders on time, the soonest first. The card shows the first four. */
	orders: PurchaseOrder[];
};

/** The relative day sits at the end, so the eye reads the dock plan down one column. */
export function DueNextCard({ orders }: DueNextCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	return (
		// No description: the title and the relative days say enough, and the rail stays short.
		<Card className="gap-3 py-4">
			<CardHeader>
				<CardTitle>{t("overview.dueNextTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.dueNextEmpty")}
					</p>
				) : (
					<ul className="grid divide-y">
						{orders.slice(0, SHOWN_ROWS).map((order) => (
							<li
								key={order.id}
								className="relative flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
							>
								<div className="grid min-w-0 justify-items-start">
									<Link
										to="/app/purchase-orders"
										search={{ po: order.id }}
										className="font-medium font-numeric text-sm after:absolute after:inset-0 hover:underline"
									>
										{order.number}
									</Link>
									<span
										className="max-w-full truncate text-muted-foreground text-xs"
										dir="auto"
									>
										{`${order.supplierName} · ${number.format(order.lines.length)} ${t(`overview.lines.${pluralForm(order.lines.length, locale)}`)}`}
									</span>
								</div>
								<span className="shrink-0 font-medium text-sm">
									{formatRelativeDay(order.expectedOn, now, locale)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
