import { ExportIcon } from "@phosphor-icons/react/Export";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	FeedbackDetail,
	FeedbackDetailEmpty,
} from "@/features/feedback/components/feedback-detail";
import { FeedbackList } from "@/features/feedback/components/feedback-list";
import { FeedbackSummary } from "@/features/feedback/components/feedback-summary";
import { FeedbackToolbar } from "@/features/feedback/components/feedback-toolbar";
import {
	filterFeedback,
	titleCaseFeedbackValue,
} from "@/features/feedback/lib/feedback";
import { MOCK_FEEDBACK } from "@/features/feedback/lib/mock-feedback";
import type {
	FeedbackItem,
	FeedbackPriority,
	FeedbackSort,
	FeedbackStatus,
	FeedbackStatusFilter,
	FeedbackTypeFilter,
} from "@/features/feedback/types";
import { useIsTablet } from "@/hooks/use-mobile";

type FeedbackViewState = {
	query: string;
	status: FeedbackStatusFilter;
	type: FeedbackTypeFilter;
	sort: FeedbackSort;
	selectedId: string | null;
};

const initialViewState: FeedbackViewState = {
	query: "",
	status: "all",
	type: "all",
	sort: "newest",
	selectedId: MOCK_FEEDBACK[0]?.id ?? null,
};

function FeedbackPage() {
	const [items, setItems] = useState<FeedbackItem[]>(MOCK_FEEDBACK);
	const [view, setView] = useState<FeedbackViewState>(initialViewState);
	const [detailOpen, setDetailOpen] = useState(false);
	const isTablet = useIsTablet();
	const { query, status, type, sort, selectedId } = view;

	const filteredItems = useMemo(
		() =>
			filterFeedback(items, {
				query,
				status,
				type,
				sort,
			}),
		[items, query, sort, status, type],
	);
	const selectedItem =
		filteredItems.find((item) => item.id === selectedId) ??
		filteredItems[0] ??
		null;
	const hasFilters =
		query.trim().length > 0 || status !== "all" || type !== "all";

	function clearFilters() {
		setView({
			...initialViewState,
			selectedId: items[0]?.id ?? null,
		});
	}

	function selectFeedback(item: FeedbackItem) {
		setView((current) => ({ ...current, selectedId: item.id }));
		if (isTablet) {
			setDetailOpen(true);
		}
	}

	function updateStatus(id: string, status: FeedbackStatus) {
		setItems((current) =>
			current.map((item) => {
				if (item.id !== id || item.status === status) {
					return item;
				}

				return {
					...item,
					status,
					activity: [
						{
							id: `activity-${id}-${Date.now()}`,
							label:
								status === "resolved"
									? "Marked resolved"
									: `Moved to ${titleCaseFeedbackValue(status).toLocaleLowerCase()}`,
							description: "Status updated in the mock admin workspace.",
							createdAt: new Date().toISOString(),
							tone: status === "resolved" ? "success" : "default",
						},
						...item.activity,
					],
				};
			}),
		);
		toast.success(`Feedback moved to ${titleCaseFeedbackValue(status)}`);
	}

	function updatePriority(id: string, priority: FeedbackPriority) {
		setItems((current) =>
			current.map((item) => (item.id === id ? { ...item, priority } : item)),
		);
		toast.success(`Priority changed to ${titleCaseFeedbackValue(priority)}`);
	}

	function saveNote(id: string, note: string) {
		setItems((current) =>
			current.map((item) => {
				if (item.id !== id || item.adminNote === note) {
					return item;
				}

				return {
					...item,
					adminNote: note,
					activity: [
						{
							id: `activity-${id}-${Date.now()}`,
							label: "Internal note updated",
							description: note
								? "Investigation context was saved for administrators."
								: "The internal note was cleared.",
							createdAt: new Date().toISOString(),
							tone: "default",
						},
						...item.activity,
					],
				};
			}),
		);
		toast.success("Internal note saved");
	}

	function exportMockView() {
		toast.success(
			`${filteredItems.length.toLocaleString()} mock records prepared`,
			{
				description: "Connect the backend later to enable a real export.",
			},
		);
	}

	return (
		<>
			<div className="mx-auto w-full max-w-[1600px] space-y-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
								Product signals
							</p>
							<Badge
								variant="outline"
								className="border-primary/15 bg-primary/5 font-medium text-primary text-xs"
							>
								Mock data
							</Badge>
						</div>
						<h1 className="mt-1 font-semibold text-2xl tracking-tight">
							Feedback
						</h1>
						<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
							Triage user reports, preserve the context behind each signal, and
							keep product follow-up in one operational view.
						</p>
					</div>

					<Button type="button" variant="outline" onClick={exportMockView}>
						<ExportIcon aria-hidden="true" />
						Export view
					</Button>
				</div>

				<FeedbackSummary items={items} />

				<section
					aria-label="Feedback inbox"
					className="overflow-hidden rounded-2xl border bg-background"
				>
					<FeedbackToolbar
						items={items}
						query={query}
						status={status}
						type={type}
						sort={sort}
						onQueryChange={(value) =>
							setView((current) => ({ ...current, query: value }))
						}
						onStatusChange={(value) =>
							setView((current) => ({ ...current, status: value }))
						}
						onTypeChange={(value) =>
							setView((current) => ({ ...current, type: value }))
						}
						onSortChange={(value) =>
							setView((current) => ({ ...current, sort: value }))
						}
					/>

					<div className="xl:grid xl:h-[720px] xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
						<div className="min-w-0 xl:min-h-0 xl:overflow-y-auto">
							<div className="flex items-center justify-between gap-3 border-b bg-muted/15 px-4 py-2.5 sm:px-5">
								<p className="text-muted-foreground text-xs">
									<span className="font-medium text-foreground tabular-nums">
										{filteredItems.length}
									</span>{" "}
									{filteredItems.length === 1
										? "conversation"
										: "conversations"}
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
							<FeedbackList
								items={filteredItems}
								selectedId={selectedItem?.id ?? null}
								hasFilters={hasFilters}
								onSelect={selectFeedback}
								onClearFilters={clearFilters}
							/>
						</div>

						<div className="hidden min-h-0 border-l xl:flex">
							{selectedItem ? (
								<FeedbackDetail
									key={selectedItem.id}
									item={selectedItem}
									domId={`panel-${selectedItem.id}`}
									onStatusChange={updateStatus}
									onPriorityChange={updatePriority}
									onSaveNote={saveNote}
								/>
							) : (
								<FeedbackDetailEmpty />
							)}
						</div>
					</div>
				</section>
			</div>

			<Sheet
				open={detailOpen && Boolean(selectedItem)}
				onOpenChange={setDetailOpen}
			>
				<SheetContent
					className="w-full gap-0 sm:max-w-[680px]"
					showCloseButton={false}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Feedback details</SheetTitle>
						<SheetDescription>
							Inspect the selected feedback conversation and update its mock
							workflow.
						</SheetDescription>
					</SheetHeader>
					{selectedItem ? (
						<FeedbackDetail
							key={`sheet-${selectedItem.id}`}
							item={selectedItem}
							domId={`sheet-${selectedItem.id}`}
							onStatusChange={updateStatus}
							onPriorityChange={updatePriority}
							onSaveNote={saveNote}
							onClose={() => setDetailOpen(false)}
						/>
					) : null}
				</SheetContent>
			</Sheet>
		</>
	);
}

export { FeedbackPage };
