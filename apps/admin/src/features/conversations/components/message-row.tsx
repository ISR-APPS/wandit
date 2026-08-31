import { aiErrorDataSchema } from "@wandit/contracts";
import { BotIcon, CircleUserRoundIcon, Settings2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/features/conversations/api/conversations.dto";
import { formatConversationDateTime } from "@/features/conversations/lib/conversation-formatters";
import { cn } from "@/lib/utils";

import { AiErrorAlert } from "./ai-error-alert";
import { ToolPartCard } from "./tool-part-card";

type MessageRowProps = {
	message: ChatMessage;
};

const roleConfig = {
	user: { label: "User", icon: CircleUserRoundIcon },
	assistant: { label: "Assistant", icon: BotIcon },
	system: { label: "System", icon: Settings2Icon },
} as const;

export function MessageRow({ message }: MessageRowProps) {
	const config = roleConfig[message.role];
	const RoleIcon = config.icon;
	const hasErrorPart = message.parts.some(isAiErrorPart);

	return (
		<article
			className={cn(
				"rounded-xl border p-4",
				message.role === "assistant" ? "bg-muted/20" : "bg-background",
			)}
			aria-labelledby={`message-${message.id}`}
		>
			<header className="flex flex-wrap items-center gap-2 border-b pb-3">
				<div className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<RoleIcon aria-hidden="true" className="size-4" />
				</div>
				<h3 id={`message-${message.id}`} className="font-medium text-sm">
					{config.label}
				</h3>
				<Badge variant="outline" className="font-mono">
					#{message.seq}
				</Badge>
				<time
					dateTime={message.createdAt}
					className="ms-auto text-muted-foreground text-xs"
				>
					{formatConversationDateTime(message.createdAt)}
				</time>
			</header>

			<div className="mt-4 space-y-3">
				{message.failure && !hasErrorPart ? (
					<AiErrorAlert
						failure={message.failure}
						label="Recorded turn failure"
					/>
				) : null}
				{message.parts.length === 0 ? (
					<p className="text-muted-foreground text-sm italic">
						No message parts
					</p>
				) : (
					message.parts.map((part, index) => (
						<MessagePart key={partKey(part, index)} part={part} index={index} />
					))
				)}
			</div>
		</article>
	);
}

function MessagePart({ part, index }: { part: unknown; index: number }) {
	if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
		return (
			<p className="whitespace-pre-wrap break-words text-sm leading-6">
				{part.text}
			</p>
		);
	}

	const aiError = parseAiErrorPart(part);
	if (aiError) {
		return <AiErrorAlert failure={aiError} />;
	}

	if (isRecord(part) && part.type === "data-billing-error") {
		return (
			<div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm">
				<p className="font-medium text-amber-700 dark:text-amber-300">
					Billing error data
				</p>
				<ToolPartCard part={part} index={index} />
			</div>
		);
	}

	return <ToolPartCard part={part} index={index} />;
}

function parseAiErrorPart(part: unknown) {
	if (!isRecord(part) || part.type !== "data-ai-error") {
		return null;
	}

	const parsed = aiErrorDataSchema.safeParse(part.data);
	if (!parsed.success) {
		return null;
	}

	const rawData = isRecord(part.data) ? part.data : null;
	return {
		...parsed.data,
		sentryEventId:
			typeof rawData?.sentryEventId === "string" ? rawData.sentryEventId : null,
	};
}

function isAiErrorPart(part: unknown): boolean {
	return parseAiErrorPart(part) !== null;
}

function partKey(part: unknown, index: number): string {
	if (isRecord(part) && typeof part.id === "string") {
		return part.id;
	}

	return `${typeof part === "object" && part !== null && "type" in part ? String(part.type) : "part"}-${index}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
