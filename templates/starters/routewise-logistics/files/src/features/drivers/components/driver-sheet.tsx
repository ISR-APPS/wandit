// The side panel of one driver: the contact facts, the delivery figures of 30 days, and the run of today.
// DriversPage opens it from a driver name. The run is read on open, with its own loading and error states.
import { useQuery } from "@tanstack/react-query";
import {
	DRIVER_STATUS_BADGE,
	FigureStrip,
	fillMessage,
	PersonAvatar,
	percentFormat,
	weightFormat,
} from "~/features/logistics";
import { openLoadQueryOptions, ShipmentSlipList } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import { DRIVER_STATS_DAYS, type Driver } from "../api/drivers.queries";

type DriverSheetProps = {
	/** The driver to show. It stays set while the panel closes, so the content does not empty during the slide. */
	driver: Driver | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled panel at the end side. On a phone it takes the full width. */
export function DriverSheet({ driver, open, onOpenChange }: DriverSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{driver ? <DriverPanel driver={driver} /> : null}
			</SheetContent>
		</Sheet>
	);
}

// The content of the panel. A separate component, so the run query runs only for an open driver.
function DriverPanel({ driver }: { driver: Driver }) {
	const { t, locale } = useT();
	const run = useQuery(
		openLoadQueryOptions({ kind: "driver", driverId: driver.id }),
	);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const facts = [
		{ label: t("drivers.phone"), value: driver.phone },
		{ label: t("drivers.licence"), value: driver.licenceClass },
		{ label: t("drivers.depot"), value: driver.depotName },
		{ label: t("drivers.hired"), value: date.format(new Date(driver.hiredAt)) },
	];
	return (
		<>
			<SheetHeader className="border-b pe-12">
				<div className="flex items-center gap-3">
					<PersonAvatar name={driver.name} className="size-11" />
					<div className="grid min-w-0 gap-1">
						<SheetTitle className="truncate">{driver.name}</SheetTitle>
						<SheetDescription asChild>
							<div>
								<Badge variant={DRIVER_STATUS_BADGE[driver.status]}>
									{t(`driverStatus.${driver.status}`)}
								</Badge>
							</div>
						</SheetDescription>
					</div>
				</div>
			</SheetHeader>
			<div className="grid gap-6 p-4">
				<dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
					{facts.map((fact) => (
						<div key={fact.label} className="grid gap-1">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-medium tabular-nums">{fact.value}</dd>
						</div>
					))}
				</dl>
				<section className="grid gap-3">
					<h3 className="font-semibold text-sm">
						{fillMessage(t("drivers.statsTitle"), {
							days: number.format(DRIVER_STATS_DAYS),
						})}
					</h3>
					{/* The box clips the outer rules of the cells and draws the panel edge. */}
					<div className="overflow-hidden rounded-md border">
						<FigureStrip
							className="grid-cols-3"
							figures={[
								{
									id: "delivered",
									label: t("drivers.delivered"),
									value: number.format(driver.deliveredCount),
								},
								{
									id: "on-time",
									label: t("drivers.onTime"),
									value:
										driver.onTimeRate === null
											? t("drivers.noRate")
											: percentFormat(locale).format(driver.onTimeRate),
								},
								{
									id: "problems",
									label: t("drivers.lateOrFailed"),
									value: number.format(driver.lateCount + driver.failedCount),
								},
							]}
						/>
					</div>
				</section>
				<section className="grid gap-3">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="font-semibold text-sm">{t("drivers.runToday")}</h3>
						{driver.vehicleUnit ? (
							<p className="text-muted-foreground text-xs tabular-nums">
								{`${driver.vehicleUnit} · ${weightFormat(locale).format(driver.loadKg)}`}
							</p>
						) : null}
					</div>
					{run.isError ? (
						<p className="text-destructive text-sm" role="alert">
							{t("drivers.runError")}
						</p>
					) : run.data === undefined ? (
						<div className="grid gap-2">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : run.data.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t(
								driver.status === "off_duty"
									? "drivers.restDay"
									: "drivers.noRun",
							)}
						</p>
					) : (
						<ShipmentSlipList shipments={run.data} />
					)}
				</section>
			</div>
		</>
	);
}
