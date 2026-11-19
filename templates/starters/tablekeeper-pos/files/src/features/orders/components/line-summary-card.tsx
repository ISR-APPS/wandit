// A short table of the lines of one check: the dish, its station, and the line amount.
// OrderDetailPage renders it in the overview, in the place of the kit "transaction history" card.
// Under the rows, the footer shows the subtotal, the tip, and the total, so the timeline amounts add up.
// The Lines tab shows the full lines card with the VAT.
import {
	formatCents,
	lineTotalCents,
	moneyFormat,
	type Order,
	orderSubtotalCents,
	orderTotalCents,
	type Station,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

// The kitchen badge is warm and the bar badge is cool, and the word always shows.
const STATION_BADGE = {
	kitchen: "warning",
	bar: "info",
} as const satisfies Record<Station, "warning" | "info">;

type LineSummaryCardProps = {
	order: Order;
};

/** One row per line, in the order of the ticket. */
export function LineSummaryCard({ order }: LineSummaryCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("orderDetail.lines")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("orderDetail.item")}</TableHead>
							<TableHead>{t("orderDetail.station")}</TableHead>
							<TableHead className="text-end">
								{t("orderDetail.amount")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{order.lines.map((line) => (
							<TableRow key={line.id}>
								<TableCell className="max-w-48 truncate" dir="auto">
									{line.quantity > 1 ? `${line.quantity} × ` : ""}
									{line.name}
								</TableCell>
								<TableCell>
									<Badge variant={STATION_BADGE[line.station]}>
										{t(`stations.${line.station}`)}
									</Badge>
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{formatCents(money, lineTotalCents(line))}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell colSpan={2} className="text-muted-foreground">
								{t("orderDetail.subtotal")}
							</TableCell>
							<TableCell className="text-end tabular-nums">
								{formatCents(money, orderSubtotalCents(order))}
							</TableCell>
						</TableRow>
						{order.tipCents > 0 ? (
							<TableRow>
								<TableCell colSpan={2} className="text-muted-foreground">
									{t("orderDetail.tip")}
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{formatCents(money, order.tipCents)}
								</TableCell>
							</TableRow>
						) : null}
						<TableRow>
							<TableCell colSpan={2}>{t("orderDetail.total")}</TableCell>
							{/* A void is not in the sales, so its total shows struck through. */}
							<TableCell
								className={cn(
									"text-end font-semibold tabular-nums",
									order.status === "void" &&
										"text-muted-foreground line-through",
								)}
							>
								{formatCents(money, orderTotalCents(order))}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</CardContent>
		</Card>
	);
}
