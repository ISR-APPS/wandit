// Content layouts for generated analytics, operations, and workbench routes.
// Workspace features supply real metrics, charts, tables, and task panels.
// These parts reuse the template Card and the DashboardShell density setting.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";

/** Each dashboard route supplies one page heading and its primary actions. */
export function DashboardPageHeader({
	title,
	description,
	eyebrow,
	actions,
}: {
	title: string;
	description?: string;
	/** Short translated context, such as a workspace name or section. */
	eyebrow?: string;
	/** Route-owned buttons and filters wrap below the heading on small screens. */
	actions?: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
			<div className="flex min-w-0 flex-col gap-2">
				{eyebrow && (
					<p className="font-medium text-muted-foreground text-sm">{eyebrow}</p>
				)}
				<h1 className="wrap-anywhere font-semibold text-2xl tracking-tight sm:text-3xl">
					{title}
				</h1>
				{description && (
					<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		</div>
	);
}

/** Values and comparisons come from the route; this card does not invent trends. */
export function DashboardMetric({
	label,
	value,
	detail,
	icon,
}: {
	label: string;
	/** The route formats this value with the active locale and correct unit. */
	value: ReactNode;
	/** A translated comparison, period, or loading state with explicit meaning. */
	detail?: ReactNode;
	/** Decorative icon; the label already supplies its accessible meaning. */
	icon?: ReactNode;
}) {
	return (
		<Card className="min-w-0 gap-0 py-5 group-data-[density=compact]/dashboard:py-4">
			<CardContent className="px-5 group-data-[density=compact]/dashboard:px-4">
				<dl className="flex min-w-0 flex-col gap-3">
					<dt className="flex items-start justify-between gap-3 text-muted-foreground text-sm">
						{label}
						<span aria-hidden="true" className="[&>svg]:size-4">
							{icon}
						</span>
					</dt>
					<dd className="wrap-anywhere font-semibold text-3xl tabular-nums tracking-tight">
						{value}
					</dd>
					<dd className="text-muted-foreground text-xs leading-relaxed">
						{detail}
					</dd>
				</dl>
			</CardContent>
		</Card>
	);
}

const bodyColumns = {
	analytics: "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
	operations: "2xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]",
	workbench: "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
};

/** Layouts stack on small screens and keep route-owned panels in document order. */
export function DashboardBody({
	layout,
	metrics,
	primary,
	secondary,
}: {
	/** Analytics pairs a chart with a summary; operations pairs a table with a queue. */
	layout: "analytics" | "operations" | "workbench";
	/** DashboardMetric children, omitted when this route has no summary metrics. */
	metrics?: ReactNode;
	/** The main chart, operations table, or workbench task list. */
	primary: ReactNode;
	/** A summary, work queue, or selected task detail. */
	secondary?: ReactNode;
}) {
	// React renders neither boolean; zero remains valid content.
	const hasMetrics =
		metrics !== undefined &&
		metrics !== null &&
		metrics !== false &&
		metrics !== true;
	const hasSecondary =
		secondary !== undefined &&
		secondary !== null &&
		secondary !== false &&
		secondary !== true;
	return (
		<div className="flex min-w-0 flex-col gap-4 group-data-[density=comfortable]/dashboard:gap-6">
			{/* LIMIT: Four metric columns. Upgrade: Add a route-specific grid for larger metric sets. */}
			{hasMetrics && (
				<div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{metrics}
				</div>
			)}
			<div
				data-dashboard-body={layout}
				className={cn(
					"grid min-w-0 items-start gap-4 group-data-[density=comfortable]/dashboard:gap-6",
					// A missing companion panel must not leave an empty desktop column.
					hasSecondary && bodyColumns[layout],
				)}
			>
				<div className="min-w-0">{primary}</div>
				{hasSecondary && <div className="min-w-0">{secondary}</div>}
			</div>
		</div>
	);
}
