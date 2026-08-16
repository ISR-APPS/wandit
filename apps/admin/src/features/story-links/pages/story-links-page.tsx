import {
	Link2Icon,
	PlusIcon,
	RefreshCwIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StoryLinksQuery } from "@/features/story-links/api/story-links.dto";
import { useStoryLinksQuery } from "@/features/story-links/api/story-links.queries";
import { CreateStoryLinkDialog } from "@/features/story-links/components/create-story-link-dialog";
import { StoryLinkClicksChart } from "@/features/story-links/components/story-link-clicks-chart";
import { StoryLinkMetrics } from "@/features/story-links/components/story-link-metrics";
import { StoryLinksHeader } from "@/features/story-links/components/story-links-header";
import { StoryLinksPageSkeleton } from "@/features/story-links/components/story-links-page-skeleton";
import { StoryLinksPageState } from "@/features/story-links/components/story-links-page-state";
import { StoryLinksTable } from "@/features/story-links/components/story-links-table";
import { formatAdminDateRangeLabel } from "@/lib/admin-date-range";

type StoryLinksPageProps = {
	query: StoryLinksQuery;
	onQueryChange: (query: StoryLinksQuery) => void;
};

function StoryLinksPage({ query, onQueryChange }: StoryLinksPageProps) {
	const [createOpen, setCreateOpen] = useState(false);
	const { data, isError, isFetching, isPending, refetch } =
		useStoryLinksQuery(query);
	const rangeLabel = formatAdminDateRangeLabel(query);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Links refreshed");
			return;
		}

		toast.error("Links could not be refreshed");
	}

	return (
		<>
			<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
				<StoryLinksHeader
					query={query}
					updatedAt={data?.updatedAt}
					isRefreshing={isFetching}
					onQueryChange={onQueryChange}
					onRefresh={() => void handleRefresh()}
					onCreate={() => setCreateOpen(true)}
				/>

				{isPending ? (
					<StoryLinksPageSkeleton />
				) : isError || !data ? (
					<StoryLinksPageState
						icon={TriangleAlertIcon}
						title="Links could not be loaded"
						description="Link data did not respond. Retry to restore this report, or create a link when the service is ready."
						action={
							<div className="flex flex-wrap justify-center gap-2">
								<Button type="button" onClick={() => void refetch()}>
									<RefreshCwIcon data-icon="inline-start" />
									Retry
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => setCreateOpen(true)}
								>
									<PlusIcon data-icon="inline-start" />
									Create link
								</Button>
							</div>
						}
					/>
				) : data.links.length === 0 ? (
					<StoryLinksPageState
						icon={Link2Icon}
						title="No links yet"
						description="Create your first link and share it in a story — clicks show up here."
						action={
							<Button type="button" onClick={() => setCreateOpen(true)}>
								<PlusIcon data-icon="inline-start" />
								Create link
							</Button>
						}
					/>
				) : (
					<>
						<StoryLinkMetrics links={data.links} rangeLabel={rangeLabel} />
						<StoryLinksTable links={data.links} />
						<StoryLinkClicksChart
							points={data.clicksByDay}
							rangeLabel={rangeLabel}
						/>
					</>
				)}
			</div>

			{createOpen ? (
				<CreateStoryLinkDialog
					open
					onOpenChange={(next) => setCreateOpen(next)}
				/>
			) : null}
		</>
	);
}

export type { StoryLinksPageProps };
export { StoryLinksPage };
