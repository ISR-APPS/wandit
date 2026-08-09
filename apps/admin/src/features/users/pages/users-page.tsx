import { RefreshCwIcon, UsersRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type { AdminListUsersSort } from "@/features/users/api/users.dto";
import { useUsersQuery } from "@/features/users/api/users.queries";
import { UsersDataTable } from "@/features/users/components/table/users-data-table";
import { UsersTableLoading } from "@/features/users/components/table/users-table-loading";
import { USER_TABLE_DEFAULT_PAGE_SIZE } from "@/features/users/lib/constants";

const SEARCH_DEBOUNCE_MS = 300;

function UsersPage() {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(USER_TABLE_DEFAULT_PAGE_SIZE);
	const [sort, setSort] = useState<AdminListUsersSort>("newest");
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	// New search text, sort, or page size all restart from the first page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset is intentional
	useEffect(() => {
		setPage(1);
	}, [debouncedQuery, sort, pageSize]);

	const usersQuery = useUsersQuery({
		page,
		pageSize,
		sort,
		q: debouncedQuery || undefined,
	});

	const result = usersQuery.data;
	const isEmptyDirectory =
		result !== undefined && result.total === 0 && debouncedQuery.length === 0;

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Access & billing
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">Users</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Inspect every account, subscription, credit balance, and project
						from one operational view.
					</p>
				</div>
			</div>

			{/* Stale rows stay on screen so the search and sort controls — which live
			    in the table toolbar — remain available to undo the failing params. */}
			{usersQuery.isError && result ? (
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
						onClick={() => void usersQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{usersQuery.isPending ? (
				<UsersTableLoading />
			) : usersQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersRoundIcon />
						</EmptyMedia>
						<EmptyTitle>Users could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the
							table.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void usersQuery.refetch()}>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : isEmptyDirectory ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersRoundIcon />
						</EmptyMedia>
						<EmptyTitle>No users yet</EmptyTitle>
						<EmptyDescription>
							Accounts will appear here as soon as people sign up for Wandit.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : result ? (
				<UsersDataTable
					data={result.items}
					page={page}
					pageSize={pageSize}
					total={result.total}
					sort={sort}
					searchValue={searchValue}
					isFetching={usersQuery.isFetching}
					onSearchChange={setSearchValue}
					onSortChange={setSort}
					onPageChange={setPage}
					onPageSizeChange={setPageSize}
				/>
			) : null}
		</div>
	);
}

export { UsersPage };
