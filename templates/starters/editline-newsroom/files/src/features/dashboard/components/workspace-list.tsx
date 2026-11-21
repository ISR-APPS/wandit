// Lists sample records with a local text filter.
// The workbench and activity routes supply their rows through their page components.
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Input } from "~/shared/ui/input";
import type { WorkspaceRow } from "../lib/workspace";

type WorkspaceListProps = {
	title: string;
	/** Sample records for the current route. */
	rows: readonly WorkspaceRow[];
};

/** Keeps the search and the disclosure state in the current view. */
export function WorkspaceList({ title, rows }: WorkspaceListProps) {
	const [search, setSearch] = useState("");
	const searchId = useId();
	const query = search.trim().toLowerCase();
	const visibleRows = rows.filter(({ name, subtitle, status, value }) =>
		[name, subtitle, status, value].some((text) =>
			text.toLowerCase().includes(query),
		),
	);

	return (
		<section className="mx-auto grid w-full max-w-5xl gap-5">
			<div>
				<Button asChild variant="ghost" className="-ms-2">
					<Link to="/app">Overview</Link>
				</Button>
				<h1 className="mt-2 font-semibold text-3xl md:text-4xl">{title}</h1>
			</div>
			<div className="grid max-w-sm gap-2">
				<label htmlFor={searchId} className="font-semibold text-sm">
					Search records
				</label>
				<div className="relative">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						id={searchId}
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="ps-9"
					/>
				</div>
			</div>
			<output className="text-muted-foreground text-sm" aria-live="polite">
				{visibleRows.length} results
			</output>
			{/* A blank result gives users one action to see all sample records again. */}
			{visibleRows.length === 0 ? (
				<div className="rounded-xl border p-5">
					<p className="mb-3 text-muted-foreground">
						No records match this search.
					</p>
					<Button onClick={() => setSearch("")}>Clear search</Button>
				</div>
			) : (
				<ul className="rounded-xl border bg-card">
					{visibleRows.map(({ name, subtitle, status, value }) => (
						<li key={name} className="border-b last:border-b-0">
							<details>
								<summary className="cursor-pointer rounded-lg px-4 py-4 hover:bg-accent">
									{name}
								</summary>
								<div className="flex flex-wrap items-center gap-3 px-4 pb-4 text-sm">
									<span className="min-w-0 flex-1 text-muted-foreground">
										{subtitle}
									</span>
									<Badge variant="secondary">{status}</Badge>
									<span className="font-numeric tabular-nums">{value}</span>
								</div>
							</details>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
