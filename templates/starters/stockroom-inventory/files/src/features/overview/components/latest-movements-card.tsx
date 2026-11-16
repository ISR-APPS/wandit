// The newest receipts, counts, and damage of the warehouse: item, kind, signed units, and time.
// OverviewPage renders it under the trend card. Each row opens the item page: the item link covers the row.
import { Link } from "@tanstack/react-router";
import type { MovementListRow } from "~/features/items";
import {
	formatEventTime,
	MovementReasonBadge,
	unitWord,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type LatestMovementsCardProps = {
	/** Newest first. */
	movements: MovementListRow[];
};

/** A plain table of 8 rows without picks: the list has its own order, so it needs no search or sort. */
export function LatestMovementsCard({ movements }: LatestMovementsCardProps) {
	const { t, locale } = useT();
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const now = Date.now();
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("overview.movementsTitle")}</CardTitle>
				<CardDescription>{t("overview.movementsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{movements.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.movementsEmpty")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("overview.item")}</TableHead>
								<TableHead className="@lg/main:table-cell hidden">
									{t("overview.movement")}
								</TableHead>
								<TableHead className="text-end">
									{t("overview.quantity")}
								</TableHead>
								<TableHead className="@lg/main:table-cell hidden text-end">
									{t("overview.when")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{movements.map((movement) => (
								<TableRow key={movement.id} className="relative">
									<TableCell>
										<div className="grid justify-items-start gap-0.5">
											<Link
												to="/app/items/$itemId"
												params={{ itemId: movement.itemId }}
												className="font-medium after:absolute after:inset-0 hover:underline"
												dir="auto"
											>
												{movement.itemName}
											</Link>
											<span className="font-numeric text-muted-foreground text-xs">
												{`${movement.sku} · ${movement.bin}`}
											</span>
											{/* Under 32rem the kind and the time move here, so the row fits a phone without a scroll. */}
											<span className="flex @lg/main:hidden flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-muted-foreground text-xs">
												<MovementReasonBadge reason={movement.reason} />
												{formatEventTime(movement.occurredAt, now, locale)}
											</span>
										</div>
									</TableCell>
									<TableCell className="@lg/main:table-cell hidden">
										<div className="grid justify-items-start gap-1">
											<MovementReasonBadge reason={movement.reason} />
											<span className="font-numeric text-muted-foreground text-xs">
												{movement.reference}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{/* dir="ltr" keeps the sign in front in an Arabic page. */}
										<bdi
											dir="ltr"
											className={cn(
												"font-medium",
												movement.quantity > 0 && "text-success",
											)}
										>
											{signed.format(movement.quantity)}
										</bdi>
										<span className="block text-muted-foreground text-xs">
											{unitWord(movement.quantity, movement.unit, t, locale)}
										</span>
									</TableCell>
									<TableCell className="@lg/main:table-cell hidden text-end text-muted-foreground">
										{formatEventTime(movement.occurredAt, now, locale)}
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
