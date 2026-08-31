import { MessageSquareTextIcon } from "lucide-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type { ChatMessage } from "@/features/conversations/api/conversations.dto";
import { ProjectDetailPagination } from "@/features/projects/components/project-detail-pagination";

import { MessageRow } from "./message-row";

type TranscriptProps = {
	messages: ChatMessage[];
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	isFetching?: boolean;
};

export function Transcript({
	messages,
	page,
	pageSize,
	total,
	onPageChange,
	isFetching = false,
}: TranscriptProps) {
	if (messages.length === 0) {
		return (
			<Empty className="min-h-72 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MessageSquareTextIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No transcript messages</EmptyTitle>
					<EmptyDescription>
						This conversation does not have any stored message rows.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="space-y-4" aria-busy={isFetching}>
			<div className="space-y-3">
				{messages
					.toSorted((left, right) => left.seq - right.seq)
					.map((message) => (
						<MessageRow key={message.id} message={message} />
					))}
			</div>
			<ProjectDetailPagination
				page={page}
				pageSize={pageSize}
				total={total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
