// Shows charge levels, depot capacity, and hourly demand.
// The /app route renders it with the selected depot's sample bay list.
import {
	BatteryChargingIcon,
	LightningIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Progress } from "~/shared/ui/progress";

const [firstDepot, ...otherDepots] = [
	{
		name: "Pier 7",
		load: "146",
		active: "4 / 5",
		bays: [
			{
				id: "A01",
				truck: "Vega 04",
				percent: 82,
				goal: "05:40",
				status: "Charging",
			},
			{
				id: "A02",
				truck: "Vega 19",
				percent: 64,
				goal: "05:55",
				status: "Charging",
			},
			{
				id: "A03",
				truck: "Falcon 07",
				percent: 91,
				goal: "05:30",
				status: "Ready",
			},
			{
				id: "A04",
				truck: "Vega 25",
				percent: 47,
				goal: "06:10",
				status: "Charging",
			},
		],
		demand: [
			{ hour: "00:00", height: "49%", load: "77 kW" },
			{ hour: "01:00", height: "70%", load: "110 kW" },
			{ hour: "02:00", height: "93%", load: "146 kW" },
			{ hour: "03:00", height: "83%", load: "130 kW" },
			{ hour: "04:00", height: "70%", load: "110 kW" },
			{ hour: "05:00", height: "38%", load: "60 kW" },
		],
	},
	{
		name: "West Dock",
		load: "93",
		active: "3 / 5",
		bays: [
			{
				id: "W01",
				truck: "Vega 02",
				percent: 76,
				goal: "05:45",
				status: "Charging",
			},
			{
				id: "W02",
				truck: "Falcon 13",
				percent: 95,
				goal: "05:10",
				status: "Ready",
			},
			{
				id: "W03",
				truck: "Vega 16",
				percent: 38,
				goal: "06:25",
				status: "Charging",
			},
		],
		demand: [
			{ hour: "00:00", height: "32%", load: "49 kW" },
			{ hour: "01:00", height: "55%", load: "86 kW" },
			{ hour: "02:00", height: "59%", load: "93 kW" },
			{ hour: "03:00", height: "50%", load: "78 kW" },
			{ hour: "04:00", height: "33%", load: "52 kW" },
			{ hour: "05:00", height: "27%", load: "42 kW" },
		],
	},
];
const depots = [firstDepot, ...otherDepots];

/** Changes all depot metrics, bay records, and demand bars with one depot selection. */
export function DashboardPage() {
	const { t } = useT();
	const [depot, setDepot] = useState(firstDepot);
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="text-primary text-sm">
						{t("dashboard.operationsOvernightCharging")}
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-tight sm:text-5xl">
						{t("dashboard.depotReadiness")}
					</h1>
				</div>
				<div className="flex gap-1 rounded-xl border bg-card p-1">
					{depots.map((choice) => (
						<Button
							key={choice.name}
							type="button"
							size="sm"
							aria-pressed={depot === choice}
							variant={depot === choice ? "default" : "ghost"}
							onClick={() => setDepot(choice)}
						>
							{choice.name}
						</Button>
					))}
				</div>
			</div>
			<section
				className="grid gap-4 md:grid-cols-2"
				aria-label={t("dashboard.readinessSummary")}
			>
				<div className="flex items-center justify-between gap-3 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
					<div>
						<p className="text-sm">{t("dashboard.peakChargingDemand")}</p>
						<strong className="mt-2 block font-numeric text-4xl">
							{depot.load} <span className="text-xl">kW</span>
						</strong>
					</div>
					<LightningIcon size="35" />
				</div>
				<div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 sm:p-6">
					<div>
						<p className="text-muted-foreground text-sm">
							{t("dashboard.occupiedBays")}
						</p>
						<strong className="mt-2 block font-numeric text-4xl">
							{depot.active}
						</strong>
					</div>
					<TruckIcon size="33" className="text-primary" />
				</div>
			</section>
			<section id="bays" className="scroll-mt-8" aria-labelledby="bay-title">
				<div className="flex items-center justify-between gap-2">
					<h2 id="bay-title" className="font-semibold text-xl">
						{t("dashboard.chargingBays")}
					</h2>
					<Badge variant="outline">{depot.name}</Badge>
				</div>
				<ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{depot.bays.map((bay) => (
						<li key={bay.id} className="rounded-2xl border bg-card p-5">
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 font-mono text-xs">
									<BatteryChargingIcon />
									{bay.id}
								</span>
								<Badge variant="secondary">{bay.status}</Badge>
							</div>
							<strong className="mt-4 block font-display">{bay.truck}</strong>
							<div className="mt-2 flex items-baseline justify-between gap-2">
								<span className="font-numeric font-semibold text-2xl">
									{bay.percent}%
								</span>
								<span className="text-muted-foreground text-xs">
									{t("dashboard.readyBy")} {bay.goal}
								</span>
							</div>
							<Progress
								aria-label={bay.truck}
								value={bay.percent}
								className="mt-3"
							/>
						</li>
					))}
				</ul>
			</section>
			<section
				id="load"
				className="scroll-mt-8 rounded-2xl border bg-card p-5 sm:p-6"
				aria-labelledby="load-title"
			>
				<h2 id="load-title" className="font-semibold text-xl">
					{t("dashboard.energyDemand")}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("dashboard.hourlyPeakInKilowatts")}
				</p>
				<ol className="mt-5 grid grid-cols-6 gap-2 sm:gap-4">
					{depot.demand.map((point) => (
						<li key={point.hour} className="grid gap-2 text-center">
							<div className="flex h-28 items-end bg-muted/70">
								<span
									title={point.load}
									className="block w-full rounded-t-md bg-primary"
									style={{ height: point.height }}
								>
									<span className="sr-only">{point.load}</span>
								</span>
							</div>
							<span className="font-numeric text-muted-foreground text-xs">
								{point.hour}
							</span>
						</li>
					))}
				</ol>
			</section>
		</div>
	);
}
