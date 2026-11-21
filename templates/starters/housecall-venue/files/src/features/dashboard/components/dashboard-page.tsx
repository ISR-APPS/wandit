// Shows the first signed-in screen for Housecall.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon, VinylRecordIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/shared/ui/button";
import { secondaryRows } from "../lib/workspace";

const metrics = [
	{
		title: "Tickets scanned",
		measure: "0 / 438",
		note: "Doors open at 19:00",
	},
	{
		title: "Crew on duty",
		measure: "12",
		note: "Stage, sound, front of house",
	},
	{
		title: "Capacity",
		measure: "480",
		note: "42 tickets available",
	},
];

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Friday, 16 October
				</p>
				<h1 className="font-semibold text-4xl md:text-5xl">
					Tonight at Irving
				</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					One show, three calls left before doors.
				</p>
			</div>
			<dl className="grid gap-3 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="rounded-xl border bg-card p-4">
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
				className="grid gap-1 overflow-hidden rounded-2xl border bg-card md:grid-cols-[1fr_1fr]"
				aria-label="Current booking"
			>
				<div className="flex flex-col items-start p-6 md:p-9">
					<span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-sm">
						Main hall
					</span>
					<h2 className="mt-4 font-semibold text-3xl md:text-4xl">
						Marta Vale Quartet
					</h2>
					<p className="mt-2 text-muted-foreground">
						Doors at 19:00 · First set at 20:00
					</p>
					<Button asChild className="mt-5">
						<Link to="/app/workbench">
							Open bookings <ArrowUpRightIcon />
						</Link>
					</Button>
				</div>
				<div
					className="relative grid min-h-40 place-items-center overflow-hidden bg-primary/10"
					aria-hidden="true"
				>
					<div className="grid aspect-square w-[min(75%,18rem)] place-items-center rounded-full border border-primary/35">
						<div className="grid size-4/5 place-items-center rounded-full border border-primary/45">
							<div className="grid size-3/4 place-items-center rounded-full bg-primary text-primary-foreground">
								<VinylRecordIcon className="size-2/5" />
							</div>
						</div>
					</div>
				</div>
			</section>
			<section aria-label="Call sheet" className="grid gap-3">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-2xl">Call sheet</h2>
					<Button asChild variant="ghost">
						<Link to="/app/activity">Full crew call</Link>
					</Button>
				</div>
				<ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
					{secondaryRows.map((call) => (
						<li key={call.name} className="rounded-xl border bg-card p-4">
							<p className="font-numeric font-semibold text-lg text-primary">
								{call.value}
							</p>
							<p className="mt-2 font-semibold">{call.name}</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{call.subtitle}
							</p>
						</li>
					))}
				</ol>
			</section>
		</div>
	);
}
