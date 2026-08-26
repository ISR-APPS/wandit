import { ExportIcon } from "@phosphor-icons/react/Export";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useUpdateFeedbackMutation } from "@/features/feedback/api/feedback.mutations";
import {
	useFeedbackDetailQuery,
	useFeedbackListQuery,
	useFeedbackStatsQuery,
} from "@/features/feedback/api/feedback.queries";
import {
	FeedbackDetail,
	FeedbackDetailEmpty,
	FeedbackDetailError,
	FeedbackDetailSkeleton,
} from "@/features/feedback/components/feedback-detail";
import {
	FeedbackList,
	FeedbackListSkeleton,
} from "@/features/feedback/components/feedback-list";
import { FeedbackSummary } from "@/features/feedback/components/feedback-summary";
import { FeedbackToolbar } from "@/features/feedback/components/feedback-toolbar";
import { titleCaseFeedbackValue } from "@/features/feedback/lib/feedback";
import { exportFeedbackToCsv } from "@/features/feedback/lib/feedback-export";
import type {
	FeedbackItem,
	FeedbackPriority,
	FeedbackSort,
	FeedbackStatus,
	FeedbackStatusFilter,
	FeedbackTypeFilter,
} from "@/features/feedback/types";
import { useIsTablet } from "@/hooks/use-mobile";

const FEEDBACK_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function FeedbackPage() {
	const [searchValue, setSearchValue] = useState("");
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<FeedbackStatusFilter>("all");
	const [type, setType] = useState<FeedbackTypeFilter>("all");
	const [sort, setSort] = useState<FeedbackSort>("newest");
	const [page, setPage] = useState(1);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const isTablet = useIsTablet();

	useEffect(() => {
		const handle = setTimeout(() => {
			setQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	// New search text, filters, or sort order restart from the first page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset is intentional
	useEffect(() => {
		setPage(1);
	}, [query, status, type, sort]);

	const listQuery = useFeedbackListQuery({
		page,
		pageSize: FEEDBACK_PAGE_SIZE,
		q: query || undefined,
		sort,
		status: status === "all" ? undefined : [status],
		category: type === "all" ? undefined : [type],
	});
	const statsQuery = useFeedbackStatsQuery();
	const items = listQuery.data?.items ?? [];
	const effectiveSelectedId = items.some((item) => item.id === selectedId)
		? selectedId
		: (items[0]?.id ?? null);
	const detailQuery = useFeedbackDetailQuery(effectiveSelectedId);
	const updateMutation = useUpdateFeedbackMutation();
	const total = listQuery.data?.total ?? 0;
	const fetchedPage = listQuery.data?.page;
	const totalPages = Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE));
	const hasFilters =
		searchValue.trim().length > 0 || status !== "all" || type !== "all";

	// Keep the stored selection aligned with the current, fully fetched page.
	useEffect(() => {
		if (listQuery.isPlaceholderData || fetchedPage !== page) {
			return;
		}

		if (selectedId !== effectiveSelectedId) {
			setSelectedId(effectiveSelectedId);
		}
	}, [
		effectiveSelectedId,
		fetchedPage,
		listQuery.isPlaceholderData,
		page,
		selectedId,
	]);

	// A write can remove the final row from the current filtered page.
	useEffect(() => {
		if (listQuery.data && !listQuery.isPlaceholderData && page > totalPages) {
			setPage(totalPages);
		}
	}, [listQuery.data, listQuery.isPlaceholderData, page, totalPages]);

	function clearFilters() {
		setSearchValue("");
		setQuery("");
		setStatus("all");
		setType("all");
		setSort("newest");
		setPage(1);
		setSelectedId(null);
	}

	function selectFeedback(item: FeedbackItem) {
		setSelectedId(item.id);
		if (isTablet) {
			setDetailOpen(true);
		}
	}

	function updateStatus(feedbackId: string, nextStatus: FeedbackStatus) {
		updateMutation.mutate(
			{ feedbackId, status: nextStatus },
			{
				onSuccess: () => {
					toast.success(
						`Feedback moved to ${titleCaseFeedbackValue(nextStatus)}`,
					);
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function updatePriority(feedbackId: string, nextPriority: FeedbackPriority) {
		updateMutation.mutate(
			{ feedbackId, priority: nextPriority },
			{
				onSuccess: () => {
					toast.success(
						`Priority changed to ${titleCaseFeedbackValue(nextPriority)}`,
					);
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function saveNote(feedbackId: string, adminNote: string) {
		updateMutation.mutate(
			{ feedbackId, adminNote },
			{
				onSuccess: () => toast.success("Internal note saved"),
				onError: (error) => toast.error(error.message),
			},
		);
	}

	async function handleExport() {
		if (isExporting) {
			return;
		}

		setIsExporting(true);
		try {
			await exportFeedbackToCsv({
				q: query || undefined,
				sort,
				status: status === "all" ? undefined : [status],
				category: type === "all" ? undefined : [type],
			});
			toast.success("Feedback exported");
		} catch {
			toast.error("Feedback could not be exported");
		} finally {
			setIsExporting(false);
		}
	}

	function renderDetail(domId: string, onClose?: () => void) {
		if (listQuery.isPending) {
			return <FeedbackDetailSkeleton />;
		}

		if (!effectiveSelectedId) {
			return <FeedbackDetailEmpty />;
		}

		if (detailQuery.isPending) {
			return <FeedbackDetailSkeleton />;
		}

		if (detailQuery.isError) {
			return <FeedbackDetailError onRetry={() => void detailQuery.refetch()} />;
		}

		if (!detailQuery.data) {
			return <FeedbackDetailEmpty />;
		}

		return (
			<FeedbackDetail
				key={`${domId}-${detailQuery.data.id}`}
				item={detailQuery.data}
				domId={`${domId}-${detailQuery.data.id}`}
				isSaving={updateMutation.isPending}
				onStatusChange={updateStatus}
				onPriorityChange={updatePriority}
				onSaveNote={saveNote}
				onClose={onClose}
			/>
		);
	}

	return (
		<>
			<div className="mx-auto w-full max-w-[1600px] space-y-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
							Product signals
						</p>
						<h1 className="mt-1 font-semibold text-2xl tracking-tight">
							Feedback
						</h1>
						<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
							Triage user reports, keep the context behind each signal, and
							track follow-up in one place.
						</p>
					</div>

					<Button
						type="button"
						variant="outline"
						disabled={isExporting}
						onClick={() => void handleExport()}
					>
						<ExportIcon aria-hidden="true" />
						{isExporting ? "Exporting…" : "Export view"}
					</Button>
				</div>

				<FeedbackSummary
					stats={statsQuery.data}
					isLoading={statsQuery.isPending}
				/>

				<section
					aria-label="Feedback inbox"
					className="overflow-hidden rounded-2xl border bg-background"
				>
					<FeedbackToolbar
						stats={statsQuery.data}
						query={searchValue}
						status={status}
						type={type}
						sort={sort}
						onQueryChange={setSearchValue}
						onStatusChange={setStatus}
						onTypeChange={setType}
						onSortChange={setSort}
					/>

					<div className="min-[1200px]:grid min-[1200px]:h-[720px] min-[1200px]:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
						<div className="min-w-0 min-[1200px]:flex min-[1200px]:min-h-0 min-[1200px]:flex-col">
							<div className="flex items-center justify-between gap-3 border-b bg-muted/15 px-4 py-2.5 sm:px-5">
								<p className="text-muted-foreground text-xs">
									<span className="font-medium text-foreground tabular-nums">
										{total.toLocaleString()}
									</span>{" "}
									conversations
								</p>
								{hasFilters ? (
									<Button
										type="button"
										variant="ghost"
										size="xs"
										onClick={clearFilters}
									>
										Reset view
									</Button>
								) : (
									<p className="text-muted-foreground text-xs">All channels</p>
								)}
							</div>

							<div className="min-[1200px]:min-h-0 min-[1200px]:flex-1 min-[1200px]:overflow-y-auto">
								{listQuery.isPending ? (
									<FeedbackListSkeleton />
								) : listQuery.isError ? (
									<FeedbackListError onRetry={() => void listQuery.refetch()} />
								) : (
									<FeedbackList
										items={items}
										selectedId={effectiveSelectedId}
										hasFilters={hasFilters}
										onSelect={selectFeedback}
										onClearFilters={clearFilters}
									/>
								)}
							</div>

							{totalPages > 1 ? (
								<div className="flex items-center justify-between gap-3 border-t bg-muted/10 px-4 py-3 sm:px-5">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={page === 1 || listQuery.isFetching}
										onClick={() =>
											setPage((current) => Math.max(1, current - 1))
										}
									>
										Prev
									</Button>
									<p className="text-muted-foreground text-xs tabular-nums">
										Page {page} of {totalPages}
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={page >= totalPages || listQuery.isFetching}
										onClick={() =>
											setPage((current) => Math.min(totalPages, current + 1))
										}
									>
										Next
									</Button>
								</div>
							) : null}
						</div>

						<div className="hidden min-h-0 border-l min-[1200px]:flex">
							{renderDetail("panel")}
						</div>
					</div>
				</section>
			</div>

			<Sheet
				open={detailOpen && Boolean(effectiveSelectedId)}
				onOpenChange={setDetailOpen}
			>
				<SheetContent
					className="w-full gap-0 sm:max-w-[680px]"
					showCloseButton={false}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Feedback details</SheetTitle>
						<SheetDescription>
							Inspect the selected feedback conversation and update its
							workflow.
						</SheetDescription>
					</SheetHeader>
					{renderDetail("sheet", () => setDetailOpen(false))}
				</SheetContent>
			</Sheet>
		</>
	);
}

function FeedbackListError({ onRetry }: { onRetry: () => void }) {
	return (
		<div
			role="alert"
			className="grid min-h-[460px] place-items-center px-6 py-12 text-center"
		>
			<div className="max-w-sm">
				<h2 className="font-semibold text-base">
					Feedback could not be loaded
				</h2>
				<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
					The server did not respond. Retry the request to restore the inbox.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-4"
					onClick={onRetry}
				>
					Retry
				</Button>
			</div>
		</div>
	);
}

export { FeedbackPage };
