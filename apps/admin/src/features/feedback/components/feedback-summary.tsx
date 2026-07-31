import { BellRingingIcon } from "@phosphor-icons/react/BellRinging";
import { BugIcon } from "@phosphor-icons/react/Bug";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { TrayIcon } from "@phosphor-icons/react/Tray";

import type { FeedbackItem } from "@/features/feedback/types";
import { cn } from "@/lib/utils";

function FeedbackSummary({ items }: { items: FeedbackItem[] }) {
	const needsTriage = items.filter((item) => item.status === "new").length;
	const openBugs = items.filter(
		(item) => item.type === "bug" && item.status !== "resolved",
	).length;
	const elevated = items.filter(
		(item) =>
			item.status !== "resolved" &&
			(item.priority === "urgent" || item.priority === "high"),
	).length;
	const resolved = items.filter((item) => item.status === "resolved").length;

	const metrics = [
		{
			label: "Needs triage",
			value: needsTriage,
			description: "Unreviewed conversations",
			icon: TrayIcon,
			accent: true,
		},
		{
			label: "Open bugs",
			value: openBugs,
			description: "Across editor and assets",
			icon: BugIcon,
		},
		{
			label: "High priority",
			value: elevated,
			description: "Urgent or high signals",
			icon: BellRingingIcon,
		},
		{
			label: "Resolved this week",
			value: resolved,
			description: "Closed in this mock view",
			icon: CheckCircleIcon,
		},
	];

	return (
		<section
			aria-label="Feedback summary"
			className="overflow-hidden rounded-xl border bg-background"
		>
			<div className="grid @[880px]/main:grid-cols-4 grid-cols-2">
				{metrics.map((metric, index) => (
					<div
						key={metric.label}
						className={cn(
							"flex min-w-0 items-start gap-3 border-b px-4 py-4",
							index % 2 === 0 && "border-r",
							index > 1 && "border-b-0",
							"@[880px]/main:border-r @[880px]/main:border-b-0",
							index === metrics.length - 1 && "@[880px]/main:border-r-0",
						)}
					>
						<div
							className={cn(
								"mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40 text-muted-foreground",
								metric.accent && "border-primary/15 bg-primary/8 text-primary",
							)}
						>
							<metric.icon aria-hidden="true" size={16} weight="regular" />
						</div>
						<div className="min-w-0">
							<p className="truncate text-muted-foreground text-xs">
								{metric.label}
							</p>
							<p className="mt-0.5 font-mono font-semibold text-xl tabular-nums tracking-tight">
								{metric.value}
							</p>
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{metric.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export { FeedbackSummary };
