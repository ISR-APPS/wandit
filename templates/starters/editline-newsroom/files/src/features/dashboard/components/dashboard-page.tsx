// Shows the first signed-in screen for Editline.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/shared/ui/button";
import { primaryRows } from "../lib/workspace";
import { Snapshot } from "./snapshot";

const metrics = [
	{
		title: "On the slate",
		measure: "14",
		note: "5 sections",
	},
	{
		title: "Ready to publish",
		measure: "8",
		note: "3 ready before noon",
	},
	{
		title: "Review due",
		measure: "4",
		note: "Next at 10:15",
	},
];

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Reporting desk / Friday, 16 October
				</p>
				<h1 className="font-semibold text-5xl md:text-6xl">
					The morning edition
				</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					The running order for the evening edition. See which stories still
					need a final read.
				</p>
			</div>
			<dl className="grid gap-5 border-y py-5 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="sm:border-e sm:pe-3 sm:last:border-e-0">
						<dt className="font-medium text-muted-foreground text-sm">
							{title}
						</dt>
						<dd className="mt-1 font-numeric font-semibold text-4xl tabular-nums">
							{measure}
						</dd>
						<dd className="mt-1 text-muted-foreground text-xs">{note}</dd>
					</div>
				))}
			</dl>
			<div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_16rem]">
				<section className="min-w-0" aria-label="Story running order">
					<div className="mb-3 flex items-center justify-between gap-3">
						<h2 className="font-semibold text-2xl">Today’s stories</h2>
						<Button asChild variant="ghost">
							<Link to="/app/workbench">
								Story desk <ArrowUpRightIcon />
							</Link>
						</Button>
					</div>
					<div className="border-y">
						<Snapshot rows={primaryRows} />
					</div>
				</section>
				<aside className="border-t pt-4">
					<h2 className="font-semibold text-xl">Editor’s note</h2>
					<p className="mt-3 font-display text-2xl leading-tight">
						Photo selection and the final legal read are due before press.
					</p>
					<p className="mt-3 text-muted-foreground text-sm">
						Metro desk · 10:15
					</p>
					<Button asChild variant="outline" className="mt-5">
						<Link to="/app/activity">Edition log</Link>
					</Button>
				</aside>
			</div>
		</div>
	);
}
