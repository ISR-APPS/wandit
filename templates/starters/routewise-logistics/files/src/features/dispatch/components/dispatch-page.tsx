// The home behind login: the period and the export in the header, then two bands.
// Band 1: the volume card beside four KPI cards in a 2 x 2 grid. Band 2: the drivers on duty beside the shipment tracker.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period. The volume card, two KPIs, and the tracker read the queries of that period.
import {
	ClockCountdownIcon,
	DownloadSimpleIcon,
	ShippingContainerIcon,
	TimerIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { driversQueryOptions } from "~/features/drivers";
import { vehiclesQueryOptions } from "~/features/fleet";
import {
	dayCountFormat,
	downloadCsv,
	type Figure,
	fillMessage,
	isOpenStatus,
	LoadError,
	type PeriodDays,
	PeriodSelect,
	percentFormat,
	toCsv,
} from "~/features/logistics";
import {
	deliveryFiguresQueryOptions,
	deliveryOutcomesQueryOptions,
	shipmentCsvColumns,
	shipmentsQueryOptions,
} from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { DriversOnDutyCard } from "./drivers-on-duty-card";
import { KpiCard } from "./kpi-card";
import { TrackShipmentsCard } from "./track-shipments-card";
import { VolumeCard } from "./volume-card";

/** The period of the home on the first visit, in days. The route loader prefetches it. */
export const DISPATCH_DEFAULT_DAYS: PeriodDays = 30;

/** Two bands of the kit sales layout. One column on a phone. */
export function DispatchPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(DISPATCH_DEFAULT_DAYS);
	const { data: drivers } = useSuspenseQuery(driversQueryOptions());
	const { data: vehicles } = useSuspenseQuery(vehiclesQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const shipments = useQuery({
		...shipmentsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const figures = useQuery({
		...deliveryFiguresQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const outcomes = useQuery({
		...deliveryOutcomesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = percentFormat(locale);
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const openRows = (shipments.data ?? []).filter((row) =>
		isOpenStatus(row.status),
	);
	// A vehicle on the road or at the dock with a load is in use. A vehicle in the workshop is not.
	const inUseCount = vehicles.filter(
		(vehicle) => vehicle.status === "on_route" || vehicle.status === "loading",
	).length;
	const workshopCount = vehicles.filter(
		(vehicle) => vehicle.status === "workshop",
	).length;
	const vsBefore = fillMessage(t("dispatch.vsBefore"), {
		period: dayCount.format(days),
	});

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("dispatch.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("dispatch.exportOpen")}
							disabled={shipments.data === undefined}
							onClick={() =>
								downloadCsv(
									"open-shipments.csv",
									toCsv(openRows, shipmentCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{shipments.isError || figures.isError || outcomes.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("dispatch.periodError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							shipments.refetch();
							figures.refetch();
							outcomes.refetch();
						}}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : shipments.data === undefined ||
				figures.data === undefined ||
				outcomes.data === undefined ? (
				<BandsSkeleton />
			) : (
				<>
					<div className="grid @4xl/main:grid-cols-2 gap-4">
						<VolumeCard outcomes={outcomes.data} days={days} />
						<div className="grid @xl/main:grid-cols-2 gap-4">
							<KpiCard
								label={t("dispatch.inTransit")}
								value={number.format(
									openRows.filter((row) => row.status === "in_transit").length,
								)}
								note={{
									kind: "fact",
									text: fillMessage(t("dispatch.inTransitLate"), {
										count: number.format(
											openRows.filter(
												(row) =>
													row.status === "in_transit" && row.lateDays > 0,
											).length,
										),
									}),
								}}
								icon={TruckIcon}
							/>
							<OnTimeKpi figures={figures.data} context={vsBefore} />
							<LateKpi figures={figures.data} context={vsBefore} />
							<KpiCard
								label={t("dispatch.fleetInUse")}
								value={percent.format(
									vehicles.length === 0 ? 0 : inUseCount / vehicles.length,
								)}
								note={{
									kind: "fact",
									text: fillMessage(t("dispatch.fleetInUseDetail"), {
										used: number.format(inUseCount),
										total: number.format(vehicles.length),
										workshop: number.format(workshopCount),
									}),
								}}
								icon={ShippingContainerIcon}
							/>
						</div>
					</div>
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<DriversOnDutyCard drivers={drivers} />
						<div className="@4xl/main:col-span-2 min-w-0">
							<TrackShipmentsCard
								rows={shipments.data}
								figures={figures.data}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

type FigureKpiProps = {
	/** The delivery figures of the period, from deliveryFiguresQueryOptions. */
	figures: Figure[];
	/** What the delta compares, for example "vs the 30 days before". */
	context: string;
};

// The on-time rate of the period. No delivery gives no rate, so the value shows a dash.
function OnTimeKpi({ figures, context }: FigureKpiProps) {
	const { t, locale } = useT();
	const figure = figures.find((entry) => entry.id === "on-time-rate");
	return (
		<KpiCard
			label={t("dispatch.onTimeRate")}
			value={figure ? percentFormat(locale).format(figure.value) : "–"}
			note={{
				kind: "change",
				change: figure?.change ?? null,
				goodWhen: "up",
				context,
			}}
			icon={TimerIcon}
		/>
	);
}

// The late deliveries of the period. A fall is good news.
function LateKpi({ figures, context }: FigureKpiProps) {
	const { t, locale } = useT();
	const figure = figures.find((entry) => entry.id === "late");
	return (
		<KpiCard
			label={t("dispatch.late")}
			value={new Intl.NumberFormat(locale).format(figure?.value ?? 0)}
			note={{
				kind: "change",
				change: figure?.change ?? null,
				goodWhen: "down",
				context,
			}}
			icon={ClockCountdownIcon}
		/>
	);
}

// Placeholder keys of the KPI grid. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];

// The two bands while the queries of a period load.
function BandsSkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-2 gap-4">
				<Skeleton className="h-80" />
				<div className="grid @xl/main:grid-cols-2 gap-4">
					{SKELETON_KPIS.map((key) => (
						<Skeleton key={key} className="h-36" />
					))}
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-128" />
				<Skeleton className="@4xl/main:col-span-2 h-128" />
			</div>
		</>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function DispatchPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<BandsSkeleton />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function DispatchPageError() {
	const { t } = useT();
	return <LoadError message={t("dispatch.loadError")} />;
}
