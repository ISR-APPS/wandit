// The "Track shipments" card of the home: four status figures with a share bar, then the table of the period.
// DispatchPage renders it in the second band, beside the drivers card. It gets the shipment rows and the delivery figures.
// The figures count the same rows as the table, so a figure equals the rows of its status in the table.
import { ExportIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	ChangeLine,
	downloadCsv,
	type Figure,
	fillMessage,
	type ShipmentStatus,
	ShipmentStatusBadge,
	toCsv,
} from "~/features/logistics";
import { type Shipment, shipmentCsvColumns } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

/** One figure of the strip: its status, its chart color classes, and the delivery figure that gives its delta. */
type StripFigure = {
	status: ShipmentStatus;
	/** The fill of the share bar. A literal class, so Tailwind finds it. */
	barClass: string;
	/** The track of the share bar: the same chart color at 20 %. */
	trackClass: string;
	/** The id of the delivery figure with the delta. null for an open status: it has no earlier value. */
	figureId: "delivered" | "failed" | null;
};

// Two open statuses that need the desk, then the two end statuses of the period.
// Delivered and failed use the colors of the volume chart, so one status has one color on the page.
const STRIP_FIGURES: StripFigure[] = [
	{
		status: "unassigned",
		barClass: "bg-chart-3",
		trackClass: "bg-chart-3/20",
		figureId: null,
	},
	{
		status: "scheduled",
		barClass: "bg-chart-2",
		trackClass: "bg-chart-2/20",
		figureId: null,
	},
	{
		status: "delivered",
		barClass: "bg-chart-1",
		trackClass: "bg-chart-1/20",
		figureId: "delivered",
	},
	{
		status: "failed",
		barClass: "bg-chart-4",
		trackClass: "bg-chart-4/20",
		figureId: "failed",
	},
];

// Six rows keep the card as high as the drivers card beside it.
const HOME_PAGE_SIZE = 6;

type TrackShipmentsCardProps = {
	/** The open shipments and the shipments closed in the period, newest booking first. */
	rows: Shipment[];
	/** The delivery figures of the period, from deliveryFiguresQueryOptions. */
	figures: Figure[];
};

/** Export downloads every row of the period as CSV, in the order of the table. */
export function TrackShipmentsCard({ rows, figures }: TrackShipmentsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	const columns: RecordColumn<Shipment>[] = [
		{
			id: "reference",
			header: t("shipments.reference"),
			cell: (row) => (
				<Link
					to="/app/shipments/$shipmentId"
					params={{ shipmentId: row.id }}
					className="font-medium tabular-nums hover:underline"
				>
					{row.reference}
				</Link>
			),
		},
		{
			id: "route",
			header: t("shipments.route"),
			cell: (row) => (
				<div className="grid">
					<span className="font-medium" dir="auto">
						{row.customerName}
					</span>
					<span className="flex items-center gap-1 text-muted-foreground text-xs">
						{row.depotName}
						<ArrowRightIcon className="size-3 rtl:rotate-180" />
						{row.destination}
					</span>
				</div>
			),
		},
		{
			id: "pallets",
			header: t("shipments.pallets"),
			align: "end",
			hideable: true,
			cell: (row) => number.format(row.pallets),
		},
		{
			id: "due",
			header: t("shipments.due"),
			hideable: true,
			cell: (row) => (
				<span className="tabular-nums">{date.format(new Date(row.dueAt))}</span>
			),
		},
		{
			id: "driver",
			header: t("shipments.driver"),
			hideable: true,
			cell: (row) =>
				row.driverName ?? (
					<span className="text-muted-foreground">
						{t("shipments.noDriver")}
					</span>
				),
		},
		{
			id: "status",
			header: t("shipments.status"),
			cell: (row) => <ShipmentStatusBadge status={row.status} />,
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("track.title")}</CardTitle>
				<CardDescription>{t("track.description")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						aria-label={t("common.export")}
						onClick={() =>
							downloadCsv(
								"shipments-of-period.csv",
								toCsv(rows, shipmentCsvColumns(t)),
							)
						}
					>
						<ExportIcon />
						<span className="hidden lg:inline">{t("common.export")}</span>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-8">
				<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
					{STRIP_FIGURES.map((item) => {
						const count = rows.filter(
							(row) => row.status === item.status,
						).length;
						const share = rows.length === 0 ? 0 : count / rows.length;
						const figure = figures.find((entry) => entry.id === item.figureId);
						const label = t(`shipmentStatus.${item.status}`);
						return (
							<div key={item.status} className="grid gap-2">
								<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
									{number.format(count)}
								</p>
								<div className="flex flex-wrap items-center gap-x-2">
									<span className="text-muted-foreground text-sm">{label}</span>
									{figure ? (
										<ChangeLine
											change={figure.change}
											goodWhen={figure.goodWhen}
										/>
									) : (
										<span className="text-muted-foreground text-xs">
											{t("track.openNow")}
										</span>
									)}
								</div>
								<div
									role="img"
									aria-label={fillMessage(t("track.shareLabel"), {
										status: label,
										share: percent.format(share),
									})}
									className={`h-2 overflow-hidden rounded-full ${item.trackClass}`}
								>
									<div
										className={`h-full rounded-full ${item.barClass}`}
										style={{ width: `${share * 100}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
				<RecordTable
					rows={rows}
					columns={columns}
					searchText={(row) =>
						`${row.reference} ${row.customerName} ${row.destination} ${row.driverName ?? ""}`
					}
					searchPlaceholder={t("track.filter")}
					pageSize={HOME_PAGE_SIZE}
					noResults={t("shipments.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
