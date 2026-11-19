// The "Drivers on duty" card of the home: the drivers with the largest open run, one boxed row each.
// DispatchPage renders it in the second band, beside the shipment tracker. It gets the driver list of driversQueryOptions.
// Each row shows the initials tile, the name, the load bar against the payload of the vehicle, and the stop count.
import { Link } from "@tanstack/react-router";
import type { Driver } from "~/features/drivers";
import {
	fillMessage,
	initialsOf,
	pluralForm,
	weightFormat,
} from "~/features/logistics";
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
import { CaretRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";

// Six rows match the six table rows of the tracker card beside this card.
const SHOWN_DRIVERS = 6;

type DriversOnDutyCardProps = {
	/** Every driver, from driversQueryOptions. The card keeps the drivers with an open run. */
	drivers: Driver[];
};

/** The largest run first. A driver with no run today is not on duty, so the card leaves the driver out. */
export function DriversOnDutyCard({ drivers }: DriversOnDutyCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const weight = weightFormat(locale);
	const onDuty = drivers
		.filter((driver) => driver.stopCount > 0)
		.sort((first, second) => second.stopCount - first.stopCount)
		.slice(0, SHOWN_DRIVERS);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("onDuty.title")}</CardTitle>
				<CardDescription>{t("onDuty.description")}</CardDescription>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								asChild
								variant="outline"
								size="icon"
								aria-label={t("common.viewAll")}
							>
								<Link to="/app/drivers">
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("common.viewAll")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			{/* Equal rows stretch to the height of the tracker card beside it, so no empty band shows under them. */}
			<CardContent className="grid flex-1 auto-rows-fr gap-4">
				{onDuty.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("onDuty.empty")}</p>
				) : (
					onDuty.map((driver) => (
						<div
							key={driver.id}
							className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
						>
							<div className="flex min-w-0 items-center gap-4">
								<span
									aria-hidden="true"
									className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-sm"
								>
									{initialsOf(driver.name)}
								</span>
								<div className="grid min-w-0 gap-1.5">
									<p className="truncate font-medium">{driver.name}</p>
									{driver.vehicleCapacityKg ? (
										<Progress
											value={driver.loadKg}
											max={driver.vehicleCapacityKg}
											className="h-1.5 w-28"
											aria-label={fillMessage(t("onDuty.loadLabel"), {
												weight: weight.format(driver.loadKg),
												capacity: weight.format(driver.vehicleCapacityKg),
												unit: driver.vehicleUnit ?? "",
											})}
										/>
									) : null}
								</div>
							</div>
							<p className="shrink-0 text-sm text-success tabular-nums">
								{fillMessage(
									t(`load.stops.${pluralForm(driver.stopCount, locale)}`),
									{ count: number.format(driver.stopCount) },
								)}
							</p>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
