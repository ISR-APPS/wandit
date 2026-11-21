// Shows the first signed-in screen for Gridwatch.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { primaryRows } from "../lib/workspace";
import { Snapshot } from "./snapshot";

const metrics = [
	{
		title: "Present load",
		measure: "218 kW",
		note: "Last interval",
	},
	{
		title: "Peak today",
		measure: "284 kW",
		note: "At 14:10",
	},
	{
		title: "Online meters",
		measure: "11 / 12",
		note: "One reports late",
	},
];
const demandSamples = [
	{
		hour: 0,
		load: 96,
	},
	{
		hour: 1,
		load: 99,
	},
	{
		hour: 2,
		load: 91,
	},
	{
		hour: 3,
		load: 109,
	},
	{
		hour: 4,
		load: 115,
	},
	{
		hour: 5,
		load: 127,
	},
	{
		hour: 6,
		load: 158,
	},
	{
		hour: 7,
		load: 177,
	},
	{
		hour: 8,
		load: 167,
	},
	{
		hour: 9,
		load: 192,
	},
	{
		hour: 10,
		load: 218,
	},
	{
		hour: 11,
		load: 203,
	},
	{
		hour: 12,
		load: 248,
	},
	{
		hour: 13,
		load: 255,
	},
	{
		hour: 14,
		load: 284,
	},
	{
		hour: 15,
		load: 243,
	},
	{
		hour: 16,
		load: 252,
	},
	{
		hour: 17,
		load: 225,
	},
	{
		hour: 18,
		load: 218,
	},
	{
		hour: 19,
		load: 172,
	},
	{
		hour: 20,
		load: 155,
	},
	{
		hour: 21,
		load: 136,
	},
	{
		hour: 22,
		load: 116,
	},
	{
		hour: 23,
		load: 101,
	},
];
// The demo chart uses a 300 kW scale to show the full daily peak.
const chartCeilingKilowatts = 300;
const percentScale = 100;

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Cedar campus / Microgrid 04
				</p>
				<h1 className="font-semibold text-3xl md:text-4xl">Site demand</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					Load, meter health and exceptions for today’s shift.
				</p>
			</div>
			<dl className="grid gap-1 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="rounded-lg border bg-card p-3">
						<dt className="font-medium text-muted-foreground text-sm">
							{title}
						</dt>
						<dd className="mt-1 font-numeric font-semibold text-2xl tabular-nums">
							{measure}
						</dd>
						<dd className="mt-1 text-muted-foreground text-xs">{note}</dd>
					</div>
				))}
			</dl>
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
				<section
					className="min-w-0 rounded-lg border bg-card p-5"
					aria-label="Demand history"
				>
					<div className="mb-5 flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 className="font-display font-semibold text-xl">
								Demand by hour
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Main service · kW
							</p>
						</div>
						<Badge variant="secondary">Sample data</Badge>
					</div>
					<div
						className="relative grid h-44 auto-cols-fr grid-flow-col items-end gap-1 border-y py-2"
						aria-hidden="true"
					>
						{/* The bar height uses a percent of the chart scale. */}
						{demandSamples.map(({ hour, load }) => (
							<div
								key={hour}
								className="rounded-t-sm bg-chart-1"
								title={`${hour}:00 · ${load} kW`}
								style={{
									height: `${(load / chartCeilingKilowatts) * percentScale}%`,
								}}
							/>
						))}
					</div>
					<p className="sr-only">
						Demand starts at 96 kilowatts and peaks at 284 kilowatts in the
						afternoon.
					</p>
					<div className="mt-2 flex justify-between font-numeric text-muted-foreground text-xs">
						<span>00:00</span>
						<span>06:00</span>
						<span>12:00</span>
						<span>18:00</span>
						<span>23:00</span>
					</div>
				</section>
				<aside className="rounded-lg border bg-card p-5">
					<h2 className="font-display font-semibold text-lg">Open exception</h2>
					<p className="mt-5 font-numeric text-primary text-sm">14:32 · G-04</p>
					<p className="mt-2 font-semibold">North meter reports late</p>
					<p className="mt-1 text-muted-foreground text-sm">
						The main service meters are current.
					</p>
					<Button asChild variant="outline" className="mt-5">
						<Link to="/app/activity">
							Site events <ArrowUpRightIcon />
						</Link>
					</Button>
				</aside>
			</div>
			<section
				className="min-w-0 rounded-lg border bg-card"
				aria-label="Meter state"
			>
				<div className="flex items-center justify-between gap-3 border-b px-5 py-3">
					<h2 className="font-display font-semibold text-xl">Meter status</h2>
					<Button asChild variant="ghost">
						<Link to="/app/workbench">Open meters</Link>
					</Button>
				</div>
				<Snapshot rows={primaryRows} />
			</section>
		</div>
	);
}
