import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { usePublicationsQuery } from "@/features/publications/api/publications.queries";
import { PublicationsDataTable } from "@/features/publications/components/publications-data-table";
import { PublicationsTableLoading } from "@/features/publications/components/publications-table-loading";

const PUBLICATIONS_DEFAULT_PAGE_SIZE = 25;

function PublicationsPage() {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(PUBLICATIONS_DEFAULT_PAGE_SIZE);

	const publicationsQuery = usePublicationsQuery({ page, pageSize });
	const result = publicationsQuery.data;
	const isEmptyLog =
		result !== undefined && result.total === 0 && !publicationsQuery.isFetching;

	const handlePageSizeChange = (nextPageSize: number) => {
		setPageSize(nextPageSize);
		setPage(1);
	};

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Operations
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">
						Publications
					</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Every website publish across the platform, newest first — who went
						live, on which project, and where.
					</p>
				</div>
			</div>

			{/* Stale rows stay on screen so pagination remains available to undo
			    the failing params. */}
			{publicationsQuery.isError && result ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
				>
					<span>
						These results could not be refreshed and may be out of date.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void publicationsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{publicationsQuery.isPending ? (
				<PublicationsTableLoading />
			) : publicationsQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<GlobeIcon />
						</EmptyMedia>
						<EmptyTitle>Publications could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the log.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							type="button"
							onClick={() => void publicationsQuery.refetch()}
						>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : isEmptyLog ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<GlobeIcon />
						</EmptyMedia>
						<EmptyTitle>No publications yet</EmptyTitle>
						<EmptyDescription>
							Publishes will appear here as soon as users put their websites
							live.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : result ? (
				<PublicationsDataTable
					data={result.items}
					page={page}
					pageSize={pageSize}
					total={result.total}
					isFetching={publicationsQuery.isFetching}
					onPageChange={setPage}
					onPageSizeChange={handlePageSizeChange}
				/>
			) : null}
		</div>
	);
}

export { PublicationsPage };
