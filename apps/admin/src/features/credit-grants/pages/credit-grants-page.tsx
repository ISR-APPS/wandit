/**
 * The "Credit grants" page: every manual credit grant, newest first.
 * The route /credit-grants renders it behind the credits:read permission.
 * It reads useCreditGrantsQuery and renders CreditGrantsTable.
 */
import { CoinVerticalIcon } from "@phosphor-icons/react/CoinVertical";
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
import { Skeleton } from "@/components/ui/skeleton";

import { useCreditGrantsQuery } from "../api/credit-grants.queries";
import { CreditGrantsTable } from "../components/credit-grants-table";

const DEFAULT_PAGE_SIZE = 25;
const LOADING_ROWS = Array.from({ length: 8 }, (_, index) => index);

/** Keeps page and page size in local state. A new page size goes back to page 1. */
export function CreditGrantsPage() {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const grantsQuery = useCreditGrantsQuery({ page, pageSize });
	const result = grantsQuery.data;
	const isEmptyLog = result !== undefined && result.total === 0;

	function handlePageSizeChange(nextPageSize: number) {
		setPageSize(nextPageSize);
		setPage(1);
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					Operations
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">
					Credit grants
				</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Every manual credit grant, newest first: who granted, to whom, how
					much, and why.
				</p>
			</div>

			{/* A failed background refetch of the same page keeps its old rows. */}
			{grantsQuery.isError && result ? (
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
						onClick={() => void grantsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{grantsQuery.isPending ? (
				<div className="space-y-2 rounded-xl border bg-background p-4">
					{LOADING_ROWS.map((row) => (
						<Skeleton key={row} className="h-12 w-full" />
					))}
				</div>
			) : grantsQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CoinVerticalIcon />
						</EmptyMedia>
						<EmptyTitle>Credit grants could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to load the log.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void grantsQuery.refetch()}>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
						{/* A failed page change drops the table and its pagination. */}
						{page > 1 ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => setPage(1)}
							>
								Go to first page
							</Button>
						) : null}
					</EmptyContent>
				</Empty>
			) : isEmptyLog ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CoinVerticalIcon />
						</EmptyMedia>
						<EmptyTitle>No credit grants yet</EmptyTitle>
						<EmptyDescription>
							Grants from a user or organization page show here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : result ? (
				<CreditGrantsTable
					grants={result.items}
					page={page}
					pageSize={pageSize}
					total={result.total}
					isFetching={grantsQuery.isFetching}
					onPageChange={setPage}
					onPageSizeChange={handlePageSizeChange}
				/>
			) : null}
		</div>
	);
}
