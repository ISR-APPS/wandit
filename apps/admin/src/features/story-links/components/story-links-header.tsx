import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { AdminDateRangePicker } from "@/components/admin-date-range-picker";
import { Button } from "@/components/ui/button";
import { formatOverviewUpdatedAt } from "@/features/overview/lib/formatters";
import type { StoryLinksQuery } from "@/features/story-links/api/story-links.dto";

type StoryLinksHeaderProps = {
	query: StoryLinksQuery;
	updatedAt?: string;
	isRefreshing: boolean;
	onQueryChange: (query: StoryLinksQuery) => void;
	onRefresh: () => void;
	onCreate: () => void;
};

function StoryLinksHeader({
	query,
	updatedAt,
	isRefreshing,
	onQueryChange,
	onRefresh,
	onCreate,
}: StoryLinksHeaderProps) {
	return (
		<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					Story traffic
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">Links</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Build trackable links and see how many people open them.
				</p>
			</div>

			<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
				<span className="mr-1 text-muted-foreground text-xs tabular-nums">
					{updatedAt
						? formatOverviewUpdatedAt(updatedAt)
						: "Preparing snapshot"}
				</span>
				<AdminDateRangePicker value={query} onChange={onQueryChange} />
				<Button
					type="button"
					variant="outline"
					size="icon"
					aria-label="Refresh links"
					disabled={isRefreshing}
					onClick={onRefresh}
				>
					<span className={isRefreshing ? "animate-spin" : undefined}>
						<RefreshCwIcon />
					</span>
				</Button>
				<Button type="button" onClick={onCreate}>
					<PlusIcon data-icon="inline-start" />
					Create link
				</Button>
			</div>
		</header>
	);
}

export type { StoryLinksHeaderProps };
export { StoryLinksHeader };
