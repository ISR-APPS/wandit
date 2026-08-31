import {
	type AdminAiFailureSurface,
	adminAiFailureSurfaces,
	aiErrorKinds,
} from "@wandit/contracts";
import { RefreshCwIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListAiFailuresParams } from "@/features/conversations/api/conversations.dto";
import { useAiFailuresQuery } from "@/features/conversations/api/conversations.queries";
import { AiFailuresTable } from "@/features/conversations/components/ai-failures-table";
import { titleCaseIdentifier } from "@/features/conversations/lib/conversation-formatters";

const FAILURES_PAGE_SIZE = 25;
const ALL_FILTER = "__all";
const FAILURE_SKELETON_KEYS = [
	"failure-one",
	"failure-two",
	"failure-three",
	"failure-four",
	"failure-five",
	"failure-six",
	"failure-seven",
] as const;

type FailureFilters = Pick<
	ListAiFailuresParams,
	"kind" | "provider" | "surface"
>;

const emptyFilters: FailureFilters = {};

export function AiFailuresPage() {
	const [page, setPage] = useState(1);
	const [kind, setKind] = useState(ALL_FILTER);
	const [surface, setSurface] = useState(ALL_FILTER);
	const [provider, setProvider] = useState("");
	const [filters, setFilters] = useState<FailureFilters>(emptyFilters);
	const failuresQuery = useAiFailuresQuery({
		...filters,
		page,
		pageSize: FAILURES_PAGE_SIZE,
	});
	const hasFilters = Boolean(
		filters.kind || filters.provider || filters.surface?.length,
	);

	function applyFilters(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPage(1);
		setFilters({
			kind: kind === ALL_FILTER ? undefined : kind,
			provider: provider.trim() || undefined,
			surface:
				surface === ALL_FILTER ? undefined : [surface as AdminAiFailureSurface],
		});
	}

	function clearFilters() {
		setKind(ALL_FILTER);
		setSurface(ALL_FILTER);
		setProvider("");
		setFilters(emptyFilters);
		setPage(1);
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<header className="flex flex-col gap-4 rounded-xl border bg-background p-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.16em]">
						AI operations
					</p>
					<h1 className="mt-2 font-semibold text-2xl tracking-tight">
						AI failures
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
						Review normalized failures across chats and generation surfaces.
						Open a chat or safe attempt record for more context.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={failuresQuery.isFetching}
					onClick={() => void failuresQuery.refetch()}
				>
					<RefreshCwIcon
						aria-hidden="true"
						className={failuresQuery.isFetching ? "animate-spin" : undefined}
					/>
					Refresh
				</Button>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
					<CardDescription>
						Narrow the feed by normalized kind, surface, or provider slug.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={applyFilters}
						className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]"
					>
						<div className="grid gap-2">
							<Label htmlFor="failure-kind">Kind</Label>
							<Select value={kind} onValueChange={setKind}>
								<SelectTrigger id="failure-kind" className="w-full">
									<SelectValue placeholder="All kinds" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_FILTER}>All kinds</SelectItem>
									{aiErrorKinds.map((value) => (
										<SelectItem key={value} value={value}>
											{titleCaseIdentifier(value)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="failure-surface">Surface</Label>
							<Select value={surface} onValueChange={setSurface}>
								<SelectTrigger id="failure-surface" className="w-full">
									<SelectValue placeholder="All surfaces" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_FILTER}>All surfaces</SelectItem>
									{adminAiFailureSurfaces.map((value) => (
										<SelectItem key={value} value={value}>
											{titleCaseIdentifier(value)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="failure-provider">Provider</Label>
							<Input
								id="failure-provider"
								value={provider}
								onChange={(event) => setProvider(event.target.value)}
								placeholder="For example, anthropic"
							/>
						</div>

						<div className="flex gap-2">
							<Button type="submit">Apply</Button>
							{hasFilters ? (
								<Button type="button" variant="ghost" onClick={clearFilters}>
									<XIcon aria-hidden="true" />
									Clear
								</Button>
							) : null}
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Failure feed</CardTitle>
					<CardDescription>
						Newest normalized failures appear first.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{failuresQuery.isPending ? (
						<FailuresSkeleton />
					) : failuresQuery.isError || !failuresQuery.data ? (
						<Empty className="min-h-80 border-0">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<TriangleAlertIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>AI failures could not be loaded</EmptyTitle>
								<EmptyDescription>
									{failuresQuery.error instanceof Error
										? failuresQuery.error.message
										: "Retry the request to restore the failure feed."}
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button
									type="button"
									onClick={() => void failuresQuery.refetch()}
								>
									<RefreshCwIcon aria-hidden="true" />
									Retry
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<AiFailuresTable
							items={failuresQuery.data.items}
							page={failuresQuery.data.page}
							pageSize={failuresQuery.data.pageSize}
							total={failuresQuery.data.total}
							onPageChange={setPage}
							isFetching={failuresQuery.isFetching}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function FailuresSkeleton() {
	return (
		<div className="space-y-3" role="status" aria-label="Loading AI failures">
			<Skeleton className="h-10 w-full" />
			{FAILURE_SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-16 w-full" />
			))}
		</div>
	);
}
