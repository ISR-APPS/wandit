// Shows the first signed-in screen for Commonroom.
// The app index route calls this page. The figures and records are samples.
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/shared/ui/button";
import { primaryRows } from "../lib/workspace";

const metrics = [
	{
		title: "Active threads",
		measure: "24",
		note: "Since Monday",
	},
	{
		title: "New members",
		measure: "13",
		note: "Joined this week",
	},
	{
		title: "Waiting for a reply",
		measure: "6",
		note: "Oldest is 5 hours",
	},
];

/** Leads with the current shift and links to the two full workspace lists. */
export function DashboardPage() {
	return (
		<div className="mx-auto grid w-full max-w-7xl gap-6">
			<div>
				<p className="mb-2 font-semibold text-primary text-sm">
					The Maker Room
				</p>
				<h1 className="font-semibold text-4xl md:text-5xl">Community pulse</h1>
				<p className="mt-3 max-w-xl text-muted-foreground text-sm md:text-base">
					Follow the threads that are moving and find posts that need a reply.
				</p>
			</div>
			<dl className="grid gap-4 sm:grid-cols-3">
				{metrics.map(({ title, measure, note }) => (
					<div key={title} className="rounded-xl border bg-card px-4 py-3">
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
				className="flex flex-wrap items-end justify-between gap-6 rounded-2xl bg-primary/10 p-6 md:p-9"
				aria-label="Featured conversation"
			>
				<div>
					<p className="font-semibold text-primary text-sm">
						Weekly studio circle
					</p>
					<h2 className="mt-2 font-semibold text-3xl">
						Show your Friday workbench
					</h2>
					<p className="mt-2 max-w-lg text-muted-foreground">
						Share the rough drafts, offcuts, and useful things you are making.
					</p>
				</div>
				<Button asChild>
					<Link to="/app/workbench">
						Read conversations <ArrowUpRightIcon />
					</Link>
				</Button>
			</section>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
				<section aria-label="Active conversations">
					<h2 className="mb-3 font-semibold text-xl">Active conversations</h2>
					<ul className="overflow-hidden rounded-xl border bg-card">
						{primaryRows.map((thread) => (
							<li
								key={thread.name}
								className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b p-4 last:border-b-0"
							>
								<span
									aria-hidden="true"
									className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary"
								>
									{thread.name.charAt(0)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-semibold">{thread.name}</p>
									<p className="text-muted-foreground text-sm">
										{thread.subtitle}
									</p>
								</div>
								<span className="text-muted-foreground text-xs">
									{thread.value}
								</span>
							</li>
						))}
					</ul>
				</section>
				<aside className="rounded-xl bg-muted p-5">
					<h2 className="font-semibold text-xl">New this week</h2>
					<p className="mt-3 font-display font-semibold text-4xl text-primary">
						13
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						People joined The Maker Room.
					</p>
					<Button asChild variant="outline" className="mt-5">
						<Link to="/app/activity">Member directory</Link>
					</Button>
				</aside>
			</div>
		</div>
	);
}
