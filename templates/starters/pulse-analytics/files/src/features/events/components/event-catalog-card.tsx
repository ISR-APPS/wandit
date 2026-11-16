// The catalog card of the Events page: every tracked event with its volume, people, trend, and change.
// EventsPage renders it. A click on an event name chooses the event of the detail card beside it.
import { useState } from "react";
import {
	ChangePill,
	type EventKey,
	EventName,
	PRODUCT_AREAS,
	type ProductArea,
	useIsWideScreen,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import type { CatalogEvent } from "../api/events.queries";
import { MiniTrend } from "./mini-trend";

type EventCatalogCardProps = {
	/** Every tracked event of the chosen period, the largest volume first. */
	events: CatalogEvent[];
	/** The event of the detail card. Its row shows as chosen. */
	selectedKey: EventKey;
	/** Runs when the user chooses another event. */
	onSelect: (eventKey: EventKey) => void;
};

/** The area filter cuts the rows before DataTable searches and sorts them. */
export function EventCatalogCard({
	events,
	selectedKey,
	onSelect,
}: EventCatalogCardProps) {
	const { t, locale } = useT();
	const isWide = useIsWideScreen();
	const [area, setArea] = useState<ProductArea | "all">("all");
	const number = new Intl.NumberFormat(locale);
	const changeOf = (row: CatalogEvent) =>
		row.change === null ? (
			<span className="text-muted-foreground">{t("events.noChange")}</span>
		) : (
			<ChangePill change={row.change} goodWhen="up" />
		);
	const rows =
		area === "all" ? events : events.filter((event) => event.area === area);

	const eventColumn: DataTableColumn<CatalogEvent> = {
		id: "event",
		header: t("events.columns.event"),
		sortValue: (row) => row.id,
		cell: (row) => {
			const isSelected = row.id === selectedKey;
			return (
				<button
					type="button"
					aria-pressed={isSelected}
					onClick={() => onSelect(row.id)}
					// min-h-11: the touch area is 44 px high on a phone.
					className="group grid min-h-11 content-center justify-items-start gap-1 text-start outline-none"
				>
					<EventName
						eventKey={row.id}
						className={cn(
							"transition-colors group-hover:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring",
							isSelected &&
								"bg-primary text-primary-foreground group-hover:bg-primary",
						)}
					/>
					{/* The kit cell does not wrap. This line wraps, so a phone keeps the volume in view. */}
					<span className="whitespace-normal text-muted-foreground text-xs">
						{`${t(`areas.${row.area}`)} · ${t(`eventTypes.${row.id}`)}`}
					</span>
				</button>
			);
		},
	};
	const volumeColumn: DataTableColumn<CatalogEvent> = {
		id: "volume",
		header: t("events.columns.volume"),
		align: "end",
		sortValue: (row) => row.volume,
		cell: (row) => number.format(row.volume),
	};
	const wideColumns: DataTableColumn<CatalogEvent>[] = [
		eventColumn,
		volumeColumn,
		{
			id: "people",
			header: t("events.columns.people"),
			align: "end",
			sortValue: (row) => row.people,
			cell: (row) => number.format(row.people),
		},
		{
			id: "trend",
			header: t("events.columns.trend"),
			cell: (row) => <MiniTrend series={row.trend} />,
		},
		{
			id: "change",
			header: t("events.columns.change"),
			align: "end",
			// An event with no earlier data sorts below every fall.
			sortValue: (row) => row.change ?? -2,
			cell: changeOf,
		},
	];
	// Under 1024 px: two columns. The users and the trend leave, and the change sits under the volume.
	const phoneColumns: DataTableColumn<CatalogEvent>[] = [
		eventColumn,
		{
			...volumeColumn,
			cell: (row) => (
				<div className="grid justify-items-end gap-1">
					{number.format(row.volume)}
					{changeOf(row)}
				</div>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.catalog.title")}</CardTitle>
				<CardDescription>{t("events.catalog.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<DataTable
					rows={rows}
					columns={isWide ? wideColumns : phoneColumns}
					searchText={(row) =>
						`${row.id} ${t(`eventTypes.${row.id}`)} ${t(`areas.${row.area}`)}`
					}
					noResults={t("events.catalog.noResults")}
					toolbar={
						<Select
							value={area}
							onValueChange={(value) =>
								setArea(
									PRODUCT_AREAS.find((option) => option === value) ?? "all",
								)
							}
						>
							<SelectTrigger
								aria-label={t("events.catalog.areaFilter")}
								className="w-44"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("events.catalog.allAreas")}
								</SelectItem>
								{PRODUCT_AREAS.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`areas.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
			</CardContent>
		</Card>
	);
}
