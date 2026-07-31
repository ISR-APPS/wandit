import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	FeedbackPriorityBadge,
	FeedbackStatusBadge,
	FeedbackTypeBadge,
} from "@/features/feedback/components/feedback-badges";
import {
	formatFeedbackRelativeTime,
	getFeedbackInitials,
} from "@/features/feedback/lib/feedback";
import type { FeedbackItem } from "@/features/feedback/types";
import { cn } from "@/lib/utils";

type FeedbackListProps = {
	items: FeedbackItem[];
	selectedId: string | null;
	hasFilters: boolean;
	onSelect: (item: FeedbackItem) => void;
	onClearFilters: () => void;
};

function FeedbackList({
	items,
	selectedId,
	hasFilters,
	onSelect,
	onClearFilters,
}: FeedbackListProps) {
	if (items.length === 0) {
		return (
			<div className="grid min-h-[460px] place-items-center px-6 py-12 text-center">
				<div className="max-w-sm">
					<div className="mx-auto grid size-11 place-items-center rounded-full border bg-muted/45 text-muted-foreground">
						<MagnifyingGlassIcon aria-hidden="true" size={20} />
					</div>
					<h2 className="mt-4 font-semibold text-base">
						{hasFilters ? "No feedback matches this view" : "Inbox is clear"}
					</h2>
					<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
						{hasFilters
							? "Try another status, type, or search term to bring conversations back into view."
							: "New user reports and requests will appear here when they arrive."}
					</p>
					{hasFilters ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="mt-4"
							onClick={onClearFilters}
						>
							Clear filters
						</Button>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<ul aria-label="Feedback conversations" className="divide-y">
			{items.map((item) => {
				const isSelected = item.id === selectedId;

				return (
					<li key={item.id}>
						<button
							type="button"
							aria-pressed={isSelected}
							className={cn(
								"group relative w-full px-4 py-4 text-left outline-none transition-[background-color,transform] duration-200 ease-out hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset active:scale-[0.995] sm:px-5",
								isSelected && "bg-primary/[0.055] hover:bg-primary/[0.07]",
							)}
							onClick={() => onSelect(item)}
						>
							<span
								aria-hidden="true"
								className={cn(
									"absolute inset-y-5 left-0 w-0.5 rounded-r-full bg-transparent transition-colors",
									isSelected && "bg-primary",
								)}
							/>

							<div className="flex min-w-0 items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-1.5">
										{item.status === "new" ? (
											<>
												<span className="sr-only">Unread</span>
												<span
													aria-hidden="true"
													className="size-1.5 rounded-full bg-primary"
												/>
											</>
										) : null}
										<span className="font-mono text-muted-foreground text-xs uppercase tracking-[0.08em]">
											{item.id}
										</span>
										<FeedbackTypeBadge type={item.type} />
									</div>
									<h3 className="mt-2 line-clamp-1 font-semibold text-[0.9375rem] tracking-tight">
										{item.title}
									</h3>
									<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
										{item.message}
									</p>
								</div>
								<time
									dateTime={item.createdAt}
									className="shrink-0 text-muted-foreground text-xs"
								>
									{formatFeedbackRelativeTime(item.createdAt)}
								</time>
							</div>

							<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									<Avatar size="sm" className="border">
										<AvatarImage src={item.reporter.avatarUrl} alt="" />
										<AvatarFallback>
											{getFeedbackInitials(item.reporter.name)}
										</AvatarFallback>
									</Avatar>
									<p className="truncate text-xs">
										<span className="font-medium">{item.reporter.name}</span>
										<span className="text-muted-foreground">
											{" "}
											· {item.context.project}
										</span>
									</p>
								</div>
								<div className="flex items-center gap-1.5">
									<FeedbackPriorityBadge priority={item.priority} />
									<FeedbackStatusBadge status={item.status} />
								</div>
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

export { FeedbackList };
