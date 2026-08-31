import { aiErrorDataSchema } from "@wandit/contracts";
import {
	BotIcon,
	CircleUserRoundIcon,
	ExternalLinkIcon,
	FileIcon,
	Settings2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/features/conversations/api/conversations.dto";
import { messageHasFailure } from "@/features/conversations/lib/conversation-failures";
import type { MessageUsageSummary } from "@/features/conversations/lib/conversation-usage";
import { cn } from "@/lib/utils";

import { AiErrorAlert, type InspectorAiError } from "./ai-error-alert";
import { AssistantText } from "./assistant-text";
import { MessageUsage } from "./message-usage";
import { ToolPartCard } from "./tool-part-card";

type MessageRowProps = {
	message: ChatMessage;
	usage?: MessageUsageSummary;
	highlighted?: boolean;
};

const roleConfig = {
	user: { label: "User", icon: CircleUserRoundIcon },
	assistant: { label: "Assistant", icon: BotIcon },
	system: { label: "System", icon: Settings2Icon },
} as const;

export function MessageRow({
	message,
	usage,
	highlighted = false,
}: MessageRowProps) {
	if (message.role === "system") {
		return <SystemMessageRow message={message} highlighted={highlighted} />;
	}

	const hasFailure = messageHasFailure(message);
	const content = (
		<>
			<MessageIdentity message={message} />
			<div className="mt-2.5 space-y-3">
				<MessageParts message={message} />
			</div>
			{message.role === "assistant" && usage ? (
				<MessageUsage usage={usage} />
			) : null}
		</>
	);

	return (
		<article
			id={`message-${message.id}`}
			data-message-id={message.id}
			data-failed-message={hasFailure ? "true" : undefined}
			className={cn(
				"group/message scroll-mt-28 transition-[box-shadow,background-color] duration-300",
				highlighted && "rounded-xl ring-2 ring-destructive/55 ring-offset-4",
				message.role === "user" ? "flex justify-end" : "border-s-2 ps-4",
				message.role === "assistant" &&
					(hasFailure ? "border-destructive" : "border-border/70"),
			)}
			aria-labelledby={`message-label-${message.id}`}
		>
			{message.role === "user" ? (
				<div
					className={cn(
						"w-fit max-w-[min(86%,52rem)] rounded-2xl rounded-ee-md border border-primary/15 bg-primary/8 px-4 py-3 shadow-xs",
						hasFailure &&
							"border-destructive/45 border-s-2 border-s-destructive bg-destructive/5",
					)}
				>
					{content}
				</div>
			) : (
				<div className="min-w-0 max-w-5xl">{content}</div>
			)}
		</article>
	);
}

function MessageIdentity({ message }: { message: ChatMessage }) {
	const config = roleConfig[message.role];
	const RoleIcon = config.icon;

	return (
		<header className="flex items-center gap-1.5 text-muted-foreground">
			<RoleIcon aria-hidden="true" className="size-3.5" />
			<h3 id={`message-label-${message.id}`} className="font-medium text-xs">
				{config.label}
			</h3>
			<Badge
				variant="outline"
				className="border-transparent bg-transparent px-1 py-0 font-mono text-muted-foreground/70 text-xs transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100"
			>
				#{message.seq}
			</Badge>
		</header>
	);
}

function SystemMessageRow({
	message,
	highlighted,
}: {
	message: ChatMessage;
	highlighted: boolean;
}) {
	const hasFailure = messageHasFailure(message);
	const characterCount = message.parts.reduce<number>((total, part) => {
		if (
			isRecord(part) &&
			part.type === "text" &&
			typeof part.text === "string"
		) {
			return total + part.text.length;
		}
		return total;
	}, 0);

	return (
		<article
			id={`message-${message.id}`}
			data-message-id={message.id}
			data-failed-message={hasFailure ? "true" : undefined}
			className={cn(
				"group/message scroll-mt-28 transition-shadow duration-300",
				highlighted && "rounded-lg ring-2 ring-destructive/55 ring-offset-4",
			)}
			aria-labelledby={`message-label-${message.id}`}
		>
			<details
				className={cn(
					"group/system border-border/70 border-y bg-muted/15",
					hasFailure && "border-s-2 border-s-destructive",
				)}
			>
				<summary className="flex cursor-pointer list-none items-center gap-2 p-2 text-muted-foreground text-xs outline-none marker:content-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
					<Settings2Icon aria-hidden="true" className="size-3.5" />
					<span id={`message-label-${message.id}`} className="font-medium">
						System prompt
					</span>
					<span aria-hidden="true">—</span>
					<span className="tabular-nums">
						{characterCount.toLocaleString("en-US")} chars
					</span>
					<span aria-hidden="true">—</span>
					<span className="group-open/system:hidden">Expand</span>
					<span className="hidden group-open/system:inline">Collapse</span>
					<Badge
						variant="outline"
						className="ms-auto border-transparent bg-transparent px-1 py-0 font-mono text-muted-foreground/70 text-xs"
					>
						#{message.seq}
					</Badge>
				</summary>
				<div className="space-y-3 border-t px-3 py-4">
					<MessageParts message={message} />
				</div>
			</details>
		</article>
	);
}

function MessageParts({ message }: { message: ChatMessage }) {
	const toolCallIds = new Set(
		message.parts.flatMap((part) => {
			const toolCallId = getToolCallId(part);
			return toolCallId ? [toolCallId] : [];
		}),
	);
	const relatedFailures = new Map<string, InspectorAiError>();

	if (message.failure?.toolCallId) {
		relatedFailures.set(message.failure.toolCallId, {
			...message.failure,
			sentryEventId: message.sentryEventId,
		});
	}

	for (const part of message.parts) {
		const failure = parseAiErrorPart(part, message.sentryEventId);
		if (failure?.toolCallId) {
			relatedFailures.set(failure.toolCallId, failure);
		}
	}

	const hasPersistedErrorPart = message.parts.some(
		(part) => parseAiErrorPart(part) !== null,
	);
	const messageFailureIsToolScoped = Boolean(
		message.failure?.toolCallId && toolCallIds.has(message.failure.toolCallId),
	);

	return (
		<>
			{message.failure &&
			!hasPersistedErrorPart &&
			!messageFailureIsToolScoped ? (
				<AiErrorAlert
					failure={{
						...message.failure,
						sentryEventId: message.sentryEventId,
					}}
					label="Recorded turn failure"
				/>
			) : null}
			{message.parts.length === 0 ? (
				<p className="text-muted-foreground text-sm italic">No message parts</p>
			) : (
				message.parts.map((part, index) => {
					const parsedFailure = parseAiErrorPart(part, message.sentryEventId);
					if (
						parsedFailure?.toolCallId &&
						toolCallIds.has(parsedFailure.toolCallId)
					) {
						return null;
					}

					const toolCallId = getToolCallId(part);
					return (
						<MessagePart
							key={partKey(part, index)}
							part={part}
							index={index}
							role={message.role}
							failure={toolCallId ? relatedFailures.get(toolCallId) : undefined}
							sentryEventId={message.sentryEventId}
						/>
					);
				})
			)}
		</>
	);
}

function MessagePart({
	part,
	index,
	role,
	failure,
	sentryEventId,
}: {
	part: unknown;
	index: number;
	role: ChatMessage["role"];
	failure?: InspectorAiError;
	sentryEventId: string | null;
}) {
	if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
		return role === "user" ? (
			<p
				dir="auto"
				className="whitespace-pre-wrap break-words text-sm leading-6"
			>
				{part.text}
			</p>
		) : (
			<AssistantText text={part.text} />
		);
	}

	const aiError = parseAiErrorPart(part, sentryEventId);
	if (aiError) {
		return <AiErrorAlert failure={aiError} />;
	}

	if (isRecord(part) && part.type === "file") {
		return <FilePartPreview part={part} />;
	}

	return <ToolPartCard part={part} index={index} failure={failure} />;
}

function FilePartPreview({ part }: { part: Record<string, unknown> }) {
	const url = firstHttpsUrl(part.url, part.data);
	const filename =
		typeof part.filename === "string" && part.filename.trim()
			? part.filename
			: url?.split("/").at(-1)?.split("?")[0] || "Attachment";
	const mediaType =
		typeof part.mediaType === "string" ? part.mediaType.toLowerCase() : "";
	const isImage =
		mediaType.startsWith("image/") ||
		Boolean(url?.match(/\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?|$)/i));
	const isVideo =
		mediaType.startsWith("video/") ||
		Boolean(url?.match(/\.(?:mov|mp4|m4v|webm)(?:\?|$)/i));

	if (!url) {
		return (
			<div className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-muted-foreground text-xs">
				<FileIcon aria-hidden="true" className="size-3.5" />
				<span className="truncate">{filename}</span>
			</div>
		);
	}

	if (isImage) {
		return (
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				referrerPolicy="no-referrer"
				className="group/media block w-fit max-w-full overflow-hidden rounded-lg border bg-muted/25 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<img
					src={url}
					alt={filename}
					loading="lazy"
					referrerPolicy="no-referrer"
					className="max-h-56 max-w-full object-contain transition-opacity group-hover/media:opacity-90"
				/>
				<span className="flex items-center gap-1.5 border-t px-2.5 py-1.5 text-muted-foreground text-xs">
					<span className="truncate">{filename}</span>
					<ExternalLinkIcon aria-hidden="true" className="size-3" />
				</span>
			</a>
		);
	}

	if (isVideo) {
		return (
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				referrerPolicy="no-referrer"
				className="group/media block w-fit max-w-full overflow-hidden rounded-lg border bg-muted/25 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<video
					src={url}
					preload="metadata"
					muted
					playsInline
					aria-label={filename}
					className="max-h-56 max-w-full object-contain transition-opacity group-hover/media:opacity-90"
				>
					<track kind="captions" />
				</video>
				<span className="flex items-center gap-1.5 border-t px-2.5 py-1.5 text-muted-foreground text-xs">
					<span className="truncate">{filename}</span>
					<ExternalLinkIcon aria-hidden="true" className="size-3" />
				</span>
			</a>
		);
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			referrerPolicy="no-referrer"
			className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
		>
			<FileIcon aria-hidden="true" className="size-3.5" />
			<span className="truncate">{filename}</span>
			<ExternalLinkIcon aria-hidden="true" className="size-3" />
		</a>
	);
}

function parseAiErrorPart(
	part: unknown,
	sentryEventId: string | null = null,
): InspectorAiError | null {
	if (!isRecord(part) || part.type !== "data-ai-error") {
		return null;
	}

	const parsed = aiErrorDataSchema.safeParse(part.data);
	if (!parsed.success) {
		return null;
	}

	return { ...parsed.data, sentryEventId };
}

function getToolCallId(part: unknown): string | null {
	return isRecord(part) && typeof part.toolCallId === "string"
		? part.toolCallId
		: null;
}

function firstHttpsUrl(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value !== "string") continue;
		try {
			const url = new URL(value);
			if (url.protocol === "https:") return url.href;
		} catch {
			// Invalid and non-public file values stay as metadata-only chips.
		}
	}
	return null;
}

function partKey(part: unknown, index: number): string {
	if (isRecord(part) && typeof part.id === "string") {
		return part.id;
	}

	if (isRecord(part) && typeof part.toolCallId === "string") {
		return part.toolCallId;
	}

	return `${isRecord(part) && "type" in part ? String(part.type) : "part"}-${index}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
