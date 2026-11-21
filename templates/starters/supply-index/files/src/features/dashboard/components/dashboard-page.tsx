// Shows the first signed-in screen for Supply Index.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/shared/ui/button";
import { primaryRows } from "../lib/workspace";
import { Snapshot } from "./snapshot";

const metrics = [
	{
		title: "Open orders",
		measure: "18",
		note: "Across 7 suppliers",
	},
	{
		title: "Open value",
		measure: "$46,780",
		note: "Before tax",
	},
	{
		title: "Await approval",
		measure: "5",
		note: "Oldest is 3 days",
	},
];

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					Purchasing office / Q4
				</p>
				<h1 className="font-semibold text-4xl md:text-5xl">
					Purchase register
				</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					Review open orders before the next supplier payment run.
				</p>
			</div>
			<dl className="grid gap-4 border-y border-dashed py-4 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="px-2 sm:border-e sm:last:border-e-0">
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
				className="overflow-hidden rounded-lg border bg-card"
				aria-label="Recent purchase orders"
			>
				<div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
					<div>
						<h2 className="font-semibold text-xl">Recent orders</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Sorted by most recent order number.
						</p>
					</div>
					<Button asChild variant="outline">
						<Link to="/app/workbench">
							Purchase orders <ArrowUpRightIcon />
						</Link>
					</Button>
				</div>
				<Snapshot rows={primaryRows} />
			</section>
			<section
				className="grid items-center gap-4 border-y px-2 py-5 sm:grid-cols-[1fr_auto]"
				aria-label="Supplier review"
			>
				<div>
					<h2 className="font-semibold text-lg">Supplier register</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Union Paper has payment terms in review.
					</p>
				</div>
				<Button asChild variant="ghost">
					<Link to="/app/activity">Open suppliers</Link>
				</Button>
			</section>
		</div>
	);
}
