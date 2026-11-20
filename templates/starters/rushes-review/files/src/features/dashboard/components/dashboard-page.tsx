// Shows the first signed-in screen for Rushes.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/shared/ui/button";
import { primaryRows, secondaryRows } from "../lib/workspace";

const metrics = [
	{
		title: "Takes received",
		measure: "26",
		note: "3 scenes",
	},
	{
		title: "Selected",
		measure: "9",
		note: "2 ready for editorial",
	},
	{
		title: "Open notes",
		measure: "4",
		note: "Across scenes 18 and 22",
	},
];
// The overview shows the first three takes. The workbench holds the full set.
const sceneStripCount = 3;

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Palmetto / Unit A
				</p>
				<h1 className="font-semibold text-4xl md:text-5xl">Day 07 dailies</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					Friday unit delivery. Review the selects and confirm which takes are
					ready for editorial.
				</p>
			</div>
			<dl className="grid gap-3 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="rounded-lg border bg-muted p-4">
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
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
				<section
					className="min-w-0 overflow-hidden rounded-lg border bg-card"
					aria-label="Selected take"
				>
					<div className="grid min-h-52 content-end gap-2 bg-primary/10 px-5 py-8 md:min-h-64 md:px-8">
						<span className="font-numeric text-primary text-sm">
							Select · Camera A
						</span>
						<h2 className="font-semibold text-4xl md:text-5xl">
							18B · Take 04
						</h2>
						<p className="text-muted-foreground">Kitchen window / 00:42</p>
					</div>
					<ul className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
						{primaryRows.slice(0, sceneStripCount).map((take) => (
							<li key={take.name} className="p-4">
								<p className="font-numeric text-muted-foreground text-xs">
									{take.value}
								</p>
								<p className="mt-1 font-medium">{take.name}</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{take.status}
								</p>
							</li>
						))}
					</ul>
					<div className="border-t p-3">
						<Button asChild variant="ghost">
							<Link to="/app/workbench">
								Browse takes <ArrowUpRightIcon />
							</Link>
						</Button>
					</div>
				</section>
				<aside className="rounded-lg border bg-card p-5">
					<h2 className="font-semibold text-xl">Review notes</h2>
					<ul className="mt-2 divide-y">
						{secondaryRows.map((note) => (
							<li key={note.name} className="grid gap-1 py-3">
								<span className="font-numeric text-primary text-xs">
									{note.value}
								</span>
								<p className="font-medium text-sm">{note.name}</p>
							</li>
						))}
					</ul>
					<Button asChild variant="outline" className="mt-3">
						<Link to="/app/activity">All notes</Link>
					</Button>
				</aside>
			</div>
		</div>
	);
}
