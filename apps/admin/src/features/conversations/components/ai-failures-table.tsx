import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	AiFailure,
	GenerationSurface,
} from "@/features/conversations/api/conversations.dto";
import {
	formatConversationDateTime,
	formatConversationRelativeTime,
	titleCaseIdentifier,
} from "@/features/conversations/lib/conversation-formatters";
import { sentryEventUrl } from "@/features/conversations/lib/external-links";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";
import { cn } from "@/lib/utils";

import {
	GenerationDrawer,
	type SelectedGenerationAttempt,
} from "./generation-drawer";

type AiFailuresTableProps = {
	items: AiFailure[];
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	isFetching?: boolean;
};

export function AiFailuresTable({
	items,
	page,
	pageSize,
	total,
	onPageChange,
	isFetching = false,
}: AiFailuresTableProps) {
	const [selectedAttempt, setSelectedAttempt] =
		useState<SelectedGenerationAttempt | null>(null);

	if (items.length === 0) {
		return (
			<Empty className="min-h-80 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No AI failures match these filters</EmptyTitle>
					<EmptyDescription>
						Clear a filter or choose a different value to widen the feed.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<>
			<div className="space-y-4" aria-busy={isFetching}>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Created</TableHead>
							<TableHead>Failure</TableHead>
							<TableHead>Surface</TableHead>
							<TableHead>Provider</TableHead>
							<TableHead>Correlation</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((failure) => {
							const sentryUrl = sentryEventUrl(failure.sentryEventId);
							const generationSurface = toGenerationSurface(failure.surface);

							return (
								<TableRow
									key={`${failure.surface}:${failure.id}`}
									className={cn(
										"focus-within:bg-muted/70 hover:bg-muted/70",
										failure.chatId && "cursor-pointer",
									)}
									onClick={failure.chatId ? openChatFromRow : undefined}
								>
									<TableCell>
										<time
											dateTime={failure.createdAt}
											title={formatConversationDateTime(failure.createdAt)}
											className="text-muted-foreground"
										>
											{formatConversationRelativeTime(failure.createdAt)}
										</time>
									</TableCell>
									<TableCell className="max-w-80 whitespace-normal">
										<div className="flex flex-wrap items-center gap-1.5">
											<Badge
												variant="outline"
												className={failureKindTone(failure.kind)}
											>
												{titleCaseIdentifier(failure.kind)}
											</Badge>
											<span className="text-muted-foreground text-xs">
												{failure.source}
											</span>
										</div>
										{failure.providerMessage ? (
											<p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs">
												{failure.providerMessage}
											</p>
										) : null}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{titleCaseIdentifier(failure.surface)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{failure.provider ?? "—"}
									</TableCell>
									<TableCell className="max-w-52">
										<p
											className="truncate font-mono text-xs"
											title={failure.requestId ?? failure.id}
										>
											{failure.requestId ?? failure.id}
										</p>
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											{failure.chatId ? (
												<Button asChild variant="outline" size="sm">
													<Link
														to="/chats/$chatId"
														params={{ chatId: failure.chatId }}
														data-chat-row-link
														onClick={(event) => event.stopPropagation()}
													>
														Open chat
													</Link>
												</Button>
											) : null}
											{generationSurface ? (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={(event) => {
														event.stopPropagation();
														setSelectedAttempt({
															surface: generationSurface,
															attemptId: failure.id,
														});
													}}
												>
													Attempt
												</Button>
											) : null}
											{sentryUrl ? (
												<Button asChild variant="ghost" size="icon-sm">
													<a
														href={sentryUrl}
														target="_blank"
														rel="noreferrer"
														aria-label={`Open Sentry event ${failure.sentryEventId}`}
														onClick={(event) => event.stopPropagation()}
													>
														<ExternalLinkIcon aria-hidden="true" />
													</a>
												</Button>
											) : null}
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				<ProjectDetailPagination
					page={page}
					pageSize={pageSize}
					total={total}
					onPageChange={onPageChange}
				/>
			</div>
			<GenerationDrawer
				selection={selectedAttempt}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedAttempt(null);
					}
				}}
			/>
		</>
	);
}

function toGenerationSurface(
	surface: AiFailure["surface"],
): GenerationSurface | null {
	return surface === "chat" ? null : surface;
}

function failureKindTone(kind: string): string {
	if (kind.includes("connector")) {
		return "border-violet-500/20 bg-violet-500/10 text-violet-800 dark:text-violet-300";
	}

	if (kind.includes("moderated")) {
		return "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300";
	}

	if (
		kind.includes("provider") ||
		kind.includes("capacity") ||
		kind.includes("rate")
	) {
		return "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-300";
	}

	return "border-destructive/20 bg-destructive/8 text-destructive dark:bg-destructive/12";
}

function openChatFromRow(event: MouseEvent<HTMLTableRowElement>) {
	if (
		event.target instanceof Element &&
		event.target.closest("a, button, input, select, textarea")
	) {
		return;
	}

	event.currentTarget
		.querySelector<HTMLAnchorElement>("[data-chat-row-link]")
		?.click();
}
