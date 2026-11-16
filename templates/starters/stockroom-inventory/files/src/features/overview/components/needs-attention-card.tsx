// The first card of the home rail: the items under their minimum and the orders past their expected day.
// OverviewPage renders it first in the rail, so it opens the page on a phone. The rows come from buildAttentionRows.
// Each row links to the item page or to the order panel. The link covers the whole row, for a 44 px touch target.
// The count in the title counts every row, shown or not. The footer links to the full item list and the Late tab.
import { Link } from "@tanstack/react-router";
import { formatQuantity, StockStatusBadge } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CheckCircleIcon } from "~/shared/ui/icons";
import type { AttentionRow } from "../lib/attention";

// Five rows keep the rail shorter than a 900 px laptop screen with the figures and the next deliveries.
const SHOWN_ROWS = 5;
// In the two-column rail (42rem to 56rem) the card sits beside the figures and due next, so one more row fits.
const WIDE_ROWS = 6;

type NeedsAttentionCardProps = {
	/** Every row of the rule, the most urgent first. */
	rows: AttentionRow[];
};

/** The healthy state (no row) is real data: one line says that nothing needs attention. */
export function NeedsAttentionCard({ rows }: NeedsAttentionCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const lateCount = rows.filter((row) => row.kind === "order").length;
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
		maximumFractionDigits: 0,
	});
	const rowClass =
		"relative flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0";

	const renderRow = (row: AttentionRow) =>
		row.kind === "item" ? (
			<li key={row.item.id} className={rowClass}>
				<div className="grid min-w-0 justify-items-start">
					<Link
						to="/app/items/$itemId"
						params={{ itemId: row.item.id }}
						className="max-w-full truncate font-medium text-sm after:absolute after:inset-0 hover:underline"
						dir="auto"
					>
						{row.item.name}
					</Link>
					<span className="text-muted-foreground text-xs tabular-nums">
						{`${number.format(row.item.onHand)} / ${number.format(row.item.minimum)} · ${
							row.item.onOrder > 0
								? `${t("overview.onOrderShort")} ${formatQuantity(row.item.onOrder, row.item.unit, t, locale)}`
								: row.item.onDraft > 0
									? `${t("overview.inDraft")} ${formatQuantity(row.item.onDraft, row.item.unit, t, locale)}`
									: t("overview.notOrdered")
						}`}
					</span>
				</div>
				<StockStatusBadge status={row.item.status} />
			</li>
		) : (
			<li key={row.order.id} className={rowClass}>
				<div className="grid min-w-0 justify-items-start">
					<Link
						to="/app/purchase-orders"
						search={{ po: row.order.id }}
						className="font-medium font-numeric text-sm after:absolute after:inset-0 hover:underline"
					>
						{row.order.number}
					</Link>
					<span
						className="max-w-full truncate text-muted-foreground text-xs"
						dir="auto"
					>
						{row.order.supplierName}
					</span>
				</div>
				<Badge variant="destructive">
					{t("purchaseOrders.late")}
					<span className="tabular-nums">
						{days.format(row.order.lateDays)}
					</span>
				</Badge>
			</li>
		);

	return (
		// No description: the badge of each row names its reason (out, low, late), and the rail stays short.
		<Card className="gap-3 py-4">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{t("overview.attentionTitle")}
					<Badge
						variant={rows.length > 0 ? "destructive" : "success"}
						className="tabular-nums"
					>
						{number.format(rows.length)}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						<CheckCircleIcon className="size-4 text-success" />
						{t("overview.attentionEmpty")}
					</p>
				) : (
					<>
						<ul className="grid divide-y">
							{rows.slice(0, SHOWN_ROWS).map(renderRow)}
						</ul>
						{rows.length > SHOWN_ROWS ? (
							<ul className="mt-1.5 @2xl/main:grid @4xl/main:hidden hidden divide-y border-t pt-1.5">
								{rows.slice(SHOWN_ROWS, WIDE_ROWS).map(renderRow)}
							</ul>
						) : null}
					</>
				)}
			</CardContent>
			{rows.length > 0 ? (
				// The count mixes items and late orders, so each kind gets its own link to its full list.
				// 44 px touch targets on a phone. In the desktop rail, a mouse needs less, and the rail stays short.
				<CardFooter className="flex-wrap gap-x-5">
					<Link
						to="/app/items"
						className="inline-flex @4xl/main:min-h-8 min-h-11 items-center font-medium text-sm underline-offset-4 hover:underline"
					>
						{t("overview.attentionMore")}
					</Link>
					{lateCount > 0 ? (
						<Link
							to="/app/purchase-orders"
							search={{ late: true }}
							className="inline-flex @4xl/main:min-h-8 min-h-11 items-center gap-1.5 font-medium text-sm underline-offset-4 hover:underline"
						>
							{t("overview.attentionLate")}
							<span className="text-muted-foreground tabular-nums">
								{number.format(lateCount)}
							</span>
						</Link>
					) : null}
				</CardFooter>
			) : null}
		</Card>
	);
}
