import { Link } from "@tanstack/react-router";
import {
	Building2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminListOrganizationsSort } from "@/features/organizations/api/organizations.dto";
import { useOrganizationsQuery } from "@/features/organizations/api/organizations.queries";
import {
	formatAdminDate,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

const SORT_LABELS: Record<AdminListOrganizationsSort, string> = {
	newest: "Newest first",
	oldest: "Oldest first",
	name: "Name A–Z",
};

export function OrganizationsPage() {
	const [page, setPage] = useState(1);
	const [sort, setSort] = useState<AdminListOrganizationsSort>("newest");
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	// New search text or sort restarts from the first page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset is intentional
	useEffect(() => {
		setPage(1);
	}, [debouncedQuery, sort]);

	const organizationsQuery = useOrganizationsQuery({
		page,
		pageSize: PAGE_SIZE,
		sort,
		q: debouncedQuery || undefined,
	});
	const result = organizationsQuery.data;
	const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
	const isEmptyDirectory =
		result !== undefined && result.total === 0 && debouncedQuery.length === 0;

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="min-w-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
					Teams & billing
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">
					Organizations
				</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
					Every team workspace with its members, Business plan, and shared
					credit pool.
				</p>
			</div>

			{organizationsQuery.isError && result ? (
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
						onClick={() => void organizationsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{organizationsQuery.isPending ? (
				<Card className="shadow-none">
					<CardContent className="flex flex-col gap-3 py-6">
						<Skeleton className="h-9 w-full max-w-sm" />
						{Array.from({ length: 6 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
							<Skeleton key={index} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			) : organizationsQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Building2Icon />
						</EmptyMedia>
						<EmptyTitle>Organizations could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the
							table.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							type="button"
							onClick={() => void organizationsQuery.refetch()}
						>
							<RefreshCwIcon data-icon="inline-start" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : isEmptyDirectory ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Building2Icon />
						</EmptyMedia>
						<EmptyTitle>No team workspaces yet</EmptyTitle>
						<EmptyDescription>
							Teams appear here as soon as users create workspaces. Enable
							team workspaces in Settings to open creation.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : result ? (
				<Card className="shadow-none">
					<CardContent className="flex flex-col gap-4 pt-6">
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative min-w-0 flex-1 sm:max-w-sm">
								<SearchIcon
									className="-translate-y-1/2 absolute start-3 top-1/2 size-4 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									value={searchValue}
									onChange={(event) => setSearchValue(event.target.value)}
									placeholder="Search by name or slug"
									className="ps-9"
									aria-label="Search organizations"
								/>
							</div>
							<Select
								value={sort}
								onValueChange={(value) =>
									setSort(value as AdminListOrganizationsSort)
								}
							>
								<SelectTrigger className="w-40" aria-label="Sort organizations">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(SORT_LABELS).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{result.items.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No organizations match “{debouncedQuery}”.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Workspace</TableHead>
										<TableHead>Plan</TableHead>
										<TableHead className="text-end">Members</TableHead>
										<TableHead className="text-end">Projects</TableHead>
										<TableHead className="text-end">Pool balance</TableHead>
										<TableHead>Created</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{result.items.map((organization) => (
										<TableRow key={organization.id}>
											<TableCell>
												<Link
													to="/organizations/$organizationId"
													params={{ organizationId: organization.id }}
													className="flex min-w-0 flex-col hover:underline"
												>
													<span className="truncate font-medium">
														{organization.name}
													</span>
													<span className="truncate text-muted-foreground text-xs">
														{organization.slug}
													</span>
												</Link>
											</TableCell>
											<TableCell>
												<Badge
													variant={
														organization.plan === "free"
															? "outline"
															: "default"
													}
													className="capitalize"
												>
													{organization.plan}
												</Badge>
											</TableCell>
											<TableCell className="text-end font-mono text-sm tabular-nums">
												{formatWholeNumber(organization.membersCount)}
											</TableCell>
											<TableCell className="text-end font-mono text-sm tabular-nums">
												{formatWholeNumber(organization.projectsCount)}
											</TableCell>
											<TableCell className="text-end font-mono text-sm tabular-nums">
												{formatWholeNumber(organization.creditsBalance)}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{formatAdminDate(organization.createdAt)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}

						<div className="flex items-center justify-between gap-3 border-t pt-4">
							<p className="text-muted-foreground text-sm">
								{formatWholeNumber(result.total)} organizations
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page <= 1 || organizationsQuery.isFetching}
									onClick={() => setPage((current) => current - 1)}
								>
									<ChevronLeftIcon
										data-icon="inline-start"
										aria-hidden="true"
										className="rtl:rotate-180"
									/>
									Previous
								</Button>
								<span className="text-muted-foreground text-sm tabular-nums">
									{page} / {totalPages}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page >= totalPages || organizationsQuery.isFetching}
									onClick={() => setPage((current) => current + 1)}
								>
									Next
									<ChevronRightIcon
										data-icon="inline-end"
										aria-hidden="true"
										className="rtl:rotate-180"
									/>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
