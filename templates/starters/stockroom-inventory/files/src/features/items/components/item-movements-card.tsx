// The newest receipts, counts, and damage of one item: when, what kind, the paper behind it, the units, and the balance after.
// Picks are not in the list: the picks chart of the page shows them.
// The kind and the paper share one column. On a phone the time joins them, so three columns stay.
// The item page renders it under the chart. A receipt links to its purchase order.
import { Link } from "@tanstack/react-router";
import { formatEventTime, MovementReasonBadge } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { ItemMovement } from "../api/items.queries";

type ItemMovementsCardProps = {
	/** Receipts, counts, and damage, newest first, at most 8. */
	movements: ItemMovement[];
};

/** A plain table: the list is short and has its own order, so it needs no search or sort. */
export function ItemMovementsCard({ movements }: ItemMovementsCardProps) {
	const { t, locale } = useT();
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("itemDetail.movements")}</CardTitle>
			</CardHeader>
			<CardContent>
				{movements.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("itemDetail.noMovements")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="@lg/main:table-cell hidden">
									{t("itemDetail.when")}
								</TableHead>
								<TableHead>{t("itemDetail.movement")}</TableHead>
								<TableHead className="text-end">
									{t("itemDetail.quantity")}
								</TableHead>
								<TableHead className="text-end">
									{t("itemDetail.balance")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{movements.map((movement) => (
								<TableRow key={movement.id} className="relative">
									<TableCell className="@lg/main:table-cell hidden text-muted-foreground">
										{formatEventTime(movement.occurredAt, now, locale)}
									</TableCell>
									<TableCell>
										<div className="grid justify-items-start gap-1">
											<MovementReasonBadge reason={movement.reason} />
											<span className="font-numeric text-muted-foreground text-xs">
												{/* A receipt row opens its order: the link covers the row, for a 44 px touch target. */}
												{movement.purchaseOrderId ? (
													<Link
														to="/app/purchase-orders"
														search={{ po: movement.purchaseOrderId }}
														className="text-foreground after:absolute after:inset-0 hover:underline"
													>
														{movement.reference}
													</Link>
												) : (
													movement.reference
												)}
											</span>
											{/* Under 32rem the time moves here, so the row fits a phone without a scroll. */}
											<span className="@lg/main:hidden text-muted-foreground text-xs">
												{formatEventTime(movement.occurredAt, now, locale)}
											</span>
										</div>
									</TableCell>
									{/* dir="ltr" keeps the sign in front in an Arabic page. */}
									<TableCell
										className={cn(
											"text-end font-medium tabular-nums",
											movement.quantity > 0 && "text-success",
										)}
									>
										<bdi dir="ltr">{signed.format(movement.quantity)}</bdi>
									</TableCell>
									<TableCell className="text-end text-muted-foreground tabular-nums">
										{number.format(movement.balanceAfter)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
