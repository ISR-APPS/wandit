// Shows the first signed-in screen for Platform.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { primaryRows } from "../lib/workspace";
import { Snapshot } from "./snapshot";

const metrics = [
	{
		title: "On time",
		measure: "92.7%",
		note: "Across 4 lines",
	},
	{
		title: "In service",
		measure: "27",
		note: "Trains and shuttles",
	},
	{
		title: "Disruptions",
		measure: "1",
		note: "Riverside line",
	},
];
const lines = [
	{ code: "H", name: "Harbor", state: "Normal service", tone: "bg-chart-1" },
	{ code: "R", name: "Riverside", state: "Delays", tone: "bg-chart-5" },
	{ code: "M", name: "Midtown", state: "Normal service", tone: "bg-chart-3" },
	{ code: "A", name: "Airport", state: "Normal service", tone: "bg-chart-2" },
];
const lineMarkers = ["start", "north", "middle", "south", "end"];

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Northline network · Friday, 16 October
				</p>
				<h1 className="font-semibold text-4xl">Service board</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					Line status for the morning service window.
				</p>
			</div>
			<dl className="grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div
						key={title}
						className="grid gap-1 px-2 sm:border-e sm:last:border-e-0"
					>
						<dt className="font-medium text-muted-foreground text-sm">
							{title}
						</dt>
						<dd className="mt-1 font-numeric font-semibold text-3xl tabular-nums">
							{measure}
						</dd>
						<dd className="mt-1 text-muted-foreground text-xs">{note}</dd>
					</div>
				))}
			</dl>
			<section
				aria-label="Line status"
				className="grid gap-4 rounded-xl border bg-card p-5 md:p-7"
			>
				<h2 className="font-semibold text-2xl">Line status</h2>
				<ul className="grid gap-4">
					{lines.map(({ code, name, state, tone }) => (
						<li
							key={code}
							className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[auto_9rem_1fr_9rem]"
						>
							<span
								className={cn(
									"grid size-9 place-items-center rounded-md font-numeric font-semibold text-primary-foreground",
									tone,
								)}
							>
								{code}
							</span>
							<span className="font-semibold">{name}</span>
							<div
								className="relative col-span-2 flex justify-between before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border sm:col-span-1"
								aria-hidden="true"
							>
								{lineMarkers.map((marker) => (
									<span
										key={marker}
										className={cn(
											"relative size-2.5 rounded-full border border-card",
											tone,
										)}
									/>
								))}
							</div>
							<span className="col-span-2 text-muted-foreground text-sm sm:col-span-1 sm:text-end">
								{state}
							</span>
						</li>
					))}
				</ul>
			</section>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
				<section className="min-w-0" aria-label="Next departures">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Next departures</h2>
						<Button asChild variant="ghost">
							<Link to="/app/workbench">
								Departures <ArrowUpRightIcon />
							</Link>
						</Button>
					</div>
					<div className="border-y">
						<Snapshot rows={primaryRows} />
					</div>
				</section>
				<aside className="rounded-lg bg-accent p-4">
					<h2 className="font-semibold">Riverside signal inspection</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						Allow extra time between Pioneer and Riverside.
					</p>
					<Button asChild variant="outline" className="mt-4">
						<Link to="/app/activity">Disruptions</Link>
					</Button>
				</aside>
			</div>
		</div>
	);
}
