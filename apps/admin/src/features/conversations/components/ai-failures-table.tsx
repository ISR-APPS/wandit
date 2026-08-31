import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

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
import { formatConversationDateTime } from "@/features/conversations/lib/conversation-formatters";
import { sentryEventUrl } from "@/features/conversations/lib/external-links";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";

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
								<TableRow key={`${failure.surface}:${failure.id}`}>
									<TableCell>
										<time dateTime={failure.createdAt}>
											{formatConversationDateTime(failure.createdAt)}
										</time>
									</TableCell>
									<TableCell className="max-w-80 whitespace-normal">
										<div className="flex flex-wrap items-center gap-1.5">
											<Badge variant="destructive">{failure.kind}</Badge>
											<Badge variant="outline">{failure.source}</Badge>
										</div>
										{failure.providerMessage ? (
											<p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs">
												{failure.providerMessage}
											</p>
										) : null}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">{failure.surface}</Badge>
									</TableCell>
									<TableCell>{failure.provider ?? "—"}</TableCell>
									<TableCell className="max-w-52">
										<p
											className="truncate font-mono text-[11px]"
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
													onClick={() =>
														setSelectedAttempt({
															surface: generationSurface,
															attemptId: failure.id,
														})
													}
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
