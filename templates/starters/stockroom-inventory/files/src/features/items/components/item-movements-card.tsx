// The movement table of the item page: every receipt, pick, count, and damage of the item, with a type filter,
// sort, and pages. ItemDetailPage renders it in its Movements tab, under the level chart.
// "Export" downloads the movements of the filter as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	downloadCsv,
	formatEventTime,
	MOVEMENT_REASONS,
	type MovementReason,
	MovementReasonBadge,
	toCsv,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import type { ItemMovement } from "../api/items.queries";

// Ten rows per page, as the kit tables show.
const PAGE_SIZE = 10;

type ItemMovementsCardProps = {
	/** Every movement of the item, newest first. */
	movements: ItemMovement[];
	/** The SKU, for the file name of the export. */
	sku: string;
	/** The current time in ms, for the relative times. */
	now: number;
};

/** The type filter is page state: the tab has no URL of its own. */
export function ItemMovementsCard({
	movements,
	sku,
	now,
}: ItemMovementsCardProps) {
	const { t, locale } = useT();
	const [reason, setReason] = useState<MovementReason | null>(null);
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const rows = reason
		? movements.filter((movement) => movement.reason === reason)
		: movements;
	const columns: RecordColumn<ItemMovement>[] = [
		{
			id: "when",
			header: t("itemDetail.when"),
			sortValue: (movement) => movement.occurredAt,
			cell: (movement) => (
				<time
					dateTime={movement.occurredAt}
					className="whitespace-nowrap text-muted-foreground"
				>
					{formatEventTime(movement.occurredAt, now, locale)}
				</time>
			),
		},
		{
			id: "reason",
			header: t("itemDetail.movement"),
			cell: (movement) => <MovementReasonBadge reason={movement.reason} />,
		},
		{
			id: "reference",
			header: t("itemDetail.reference"),
			hideable: true,
			cell: (movement) =>
				movement.purchaseOrderId ? (
					<Link
						to="/app/purchase-orders"
						search={{ po: movement.purchaseOrderId }}
						className="tabular-nums hover:underline"
					>
						{movement.reference}
					</Link>
				) : (
					<span className="tabular-nums">{movement.reference}</span>
				),
		},
		{
			id: "quantity",
			header: t("itemDetail.quantity"),
			align: "end",
			sortValue: (movement) => movement.quantity,
			cell: (movement) => (
				<bdi dir="ltr" className={cn(movement.quantity > 0 && "text-success")}>
					{signed.format(movement.quantity)}
				</bdi>
			),
		},
		{
			id: "balance",
			header: t("itemDetail.balance"),
			align: "end",
			hideable: true,
			cell: (movement) => number.format(movement.balanceAfter),
		},
	];

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("itemDetail.movementsTitle")}</CardTitle>
				<CardDescription>
					{t("itemDetail.movementsDescription")}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								`${sku.toLowerCase()}-movements.csv`,
								toCsv(rows, [
									{
										header: t("itemDetail.when"),
										value: (row) => row.occurredAt,
									},
									{
										header: t("itemDetail.movement"),
										value: (row) => t(`movementReasons.${row.reason}`),
									},
									{
										header: t("itemDetail.reference"),
										value: (row) => row.reference,
									},
									{
										header: t("itemDetail.quantity"),
										value: (row) => String(row.quantity),
									},
									{
										header: t("itemDetail.balance"),
										value: (row) => String(row.balanceAfter),
									},
								]),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(movement) => movement.reference}
					searchPlaceholder={t("itemDetail.searchReference")}
					toolbar={
						<RecordFilter
							label={t("itemDetail.movement")}
							options={MOVEMENT_REASONS.map((value) => ({
								value,
								label: t(`movementReasons.${value}`),
							}))}
							value={reason}
							onValueChange={(value) =>
								setReason(
									MOVEMENT_REASONS.find((candidate) => candidate === value) ??
										null,
								)
							}
						/>
					}
					pageSize={PAGE_SIZE}
					noResults={t("itemDetail.noMovements")}
				/>
			</CardContent>
		</Card>
	);
}
