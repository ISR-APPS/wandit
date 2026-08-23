import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { BrowserIcon } from "@phosphor-icons/react/Browser";
import { ChatCenteredDotsIcon } from "@phosphor-icons/react/ChatCenteredDots";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { MonitorIcon } from "@phosphor-icons/react/Monitor";
import { NotePencilIcon } from "@phosphor-icons/react/NotePencil";
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { XIcon } from "@phosphor-icons/react/X";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import {
	FeedbackPriorityBadge,
	FeedbackStatusBadge,
	FeedbackTypeBadge,
} from "@/features/feedback/components/feedback-badges";
import {
	formatFeedbackDateTime,
	getFeedbackInitials,
	titleCaseFeedbackValue,
} from "@/features/feedback/lib/feedback";
import type {
	FeedbackItem,
	FeedbackPriority,
	FeedbackStatus,
} from "@/features/feedback/types";
import { cn } from "@/lib/utils";

type FeedbackDetailProps = {
	item: FeedbackItem;
	domId: string;
	onStatusChange: (id: string, status: FeedbackStatus) => void;
	onPriorityChange: (id: string, priority: FeedbackPriority) => void;
	onSaveNote: (id: string, note: string) => void;
	onClose?: () => void;
};

function FeedbackDetail({
	item,
	domId,
	onStatusChange,
	onPriorityChange,
	onSaveNote,
	onClose,
}: FeedbackDetailProps) {
	const [note, setNote] = useState(item.adminNote);
	const noteIsDirty = note.trim() !== item.adminNote.trim();

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<FeedbackDetailHeader
				item={item}
				onStatusChange={onStatusChange}
				onClose={onClose}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<UserMessageSection item={item} domId={domId} />
				<SubmissionContextSection item={item} domId={domId} />
				<WorkflowSection
					item={item}
					domId={domId}
					onStatusChange={onStatusChange}
					onPriorityChange={onPriorityChange}
				/>
				<InternalNoteSection
					itemId={item.id}
					domId={domId}
					note={note}
					noteIsDirty={noteIsDirty}
					onNoteChange={setNote}
					onSaveNote={onSaveNote}
				/>
				<ActivitySection item={item} domId={domId} />
			</div>
		</div>
	);
}

function FeedbackDetailHeader({
	item,
	onStatusChange,
	onClose,
}: Pick<FeedbackDetailProps, "item" | "onStatusChange" | "onClose">) {
	const canManage = useAdminPermission({ feedback: ["manage"] });

	async function copyFeedbackId() {
		try {
			await navigator.clipboard.writeText(item.id);
			toast.success("Feedback ID copied");
		} catch {
			toast.error("Feedback ID could not be copied");
		}
	}

	return (
		<header className="border-b px-5 py-5 sm:px-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-1.5">
					<FeedbackTypeBadge type={item.type} />
					<FeedbackStatusBadge status={item.status} />
					<FeedbackPriorityBadge priority={item.priority} />
				</div>
				<div className="flex items-center gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Copy feedback ID"
						onClick={() => void copyFeedbackId()}
					>
						<CopyIcon aria-hidden="true" />
					</Button>
					{canManage ? (
						<Button
							type="button"
							variant={item.status === "resolved" ? "outline" : "default"}
							size="sm"
							onClick={() =>
								onStatusChange(
									item.id,
									item.status === "resolved" ? "reviewing" : "resolved",
								)
							}
						>
							<CheckCircleIcon aria-hidden="true" />
							{item.status === "resolved" ? "Reopen" : "Resolve"}
						</Button>
					) : null}
					{onClose ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Close feedback details"
							onClick={onClose}
						>
							<XIcon aria-hidden="true" />
						</Button>
					) : null}
				</div>
			</div>

			<p className="mt-5 text-muted-foreground text-xs">
				<span className="font-mono">{item.id}</span> ·{" "}
				{formatFeedbackDateTime(item.createdAt)}
			</p>
			<h2 className="mt-2 max-w-[32ch] font-semibold text-xl leading-snug tracking-tight sm:text-2xl">
				{item.title}
			</h2>

			<div className="mt-4 flex items-center gap-3">
				<Avatar className="size-9 border">
					<AvatarImage src={item.reporter.avatarUrl} alt="" />
					<AvatarFallback>
						{getFeedbackInitials(item.reporter.name)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{item.reporter.name}</p>
					<p className="truncate text-muted-foreground text-xs">
						{item.reporter.email}
					</p>
				</div>
				<Badge variant="outline" className="font-normal text-muted-foreground">
					{item.reporter.plan} plan
				</Badge>
			</div>
		</header>
	);
}

function UserMessageSection({
	item,
	domId,
}: Pick<FeedbackDetailProps, "item" | "domId">) {
	return (
		<section
			className="border-b px-5 py-5 sm:px-6"
			aria-labelledby={`message-${domId}`}
		>
			<h3 id={`message-${domId}`} className="font-medium text-sm">
				User message
			</h3>
			<div className="mt-3 rounded-2xl rounded-tl-md border bg-muted/35 px-4 py-3.5">
				<p className="text-sm leading-6">{item.message}</p>
			</div>

			{item.attachment ? (
				<div className="mt-3 flex items-center gap-3 rounded-xl border p-3">
					<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
						<PaperclipIcon aria-hidden="true" size={17} />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-xs">
							{item.attachment.name}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{titleCaseFeedbackValue(item.attachment.type)} ·{" "}
							{item.attachment.size}
						</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Open ${item.attachment.name}`}
						onClick={() => toast.info("Attachment preview is mock data")}
					>
						<ArrowSquareOutIcon aria-hidden="true" />
					</Button>
				</div>
			) : null}
		</section>
	);
}

function SubmissionContextSection({
	item,
	domId,
}: Pick<FeedbackDetailProps, "item" | "domId">) {
	function openMockPage() {
		toast.info("Page context is mock data", {
			description: item.context.path,
		});
	}

	return (
		<section
			className="border-b px-5 py-5 sm:px-6"
			aria-labelledby={`context-${domId}`}
		>
			<div className="flex items-end justify-between gap-4">
				<div>
					<h3 id={`context-${domId}`} className="font-medium text-sm">
						Submission context
					</h3>
					<p className="mt-1 text-muted-foreground text-xs">
						Captured automatically with the report.
					</p>
				</div>
				<Button type="button" variant="ghost" size="sm" onClick={openMockPage}>
					<ArrowSquareOutIcon aria-hidden="true" />
					Open page
				</Button>
			</div>

			<div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
				<ContextItem
					icon={MonitorIcon}
					label="Project"
					value={item.context.project}
					detail={item.context.page}
				/>
				<ContextItem
					icon={BrowserIcon}
					label="Browser"
					value={item.context.browser}
					detail={item.context.path}
				/>
				<ContextItem
					icon={DeviceMobileIcon}
					label="Device"
					value={item.context.device}
					detail={item.context.viewport}
				/>
				<div className="min-w-0">
					<p className="text-muted-foreground text-xs">Tags</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{item.tags.map((tag) => (
							<Badge
								key={tag}
								variant="outline"
								className="bg-muted/35 font-normal text-muted-foreground"
							>
								{tag}
							</Badge>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function WorkflowSection({
	item,
	domId,
	onStatusChange,
	onPriorityChange,
}: Pick<
	FeedbackDetailProps,
	"item" | "domId" | "onStatusChange" | "onPriorityChange"
>) {
	const canManage = useAdminPermission({ feedback: ["manage"] });

	return (
		<section
			className="border-b px-5 py-5 sm:px-6"
			aria-labelledby={`workflow-${domId}`}
		>
			<h3 id={`workflow-${domId}`} className="font-medium text-sm">
				Workflow
			</h3>
			<div className="mt-3 grid gap-3 sm:grid-cols-2">
				<div className="grid gap-2">
					<label htmlFor={`status-${domId}`} className="font-medium text-xs">
						Status
					</label>
					<Select
						value={item.status}
						disabled={!canManage}
						onValueChange={(value) =>
							onStatusChange(item.id, value as FeedbackStatus)
						}
					>
						<SelectTrigger id={`status-${domId}`} className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(["new", "reviewing", "planned", "resolved"] as const).map(
								(status) => (
									<SelectItem key={status} value={status}>
										{titleCaseFeedbackValue(status)}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-2">
					<label htmlFor={`priority-${domId}`} className="font-medium text-xs">
						Priority
					</label>
					<Select
						value={item.priority}
						disabled={!canManage}
						onValueChange={(value) =>
							onPriorityChange(item.id, value as FeedbackPriority)
						}
					>
						<SelectTrigger id={`priority-${domId}`} className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(["urgent", "high", "medium", "low"] as const).map(
								(priority) => (
									<SelectItem key={priority} value={priority}>
										{titleCaseFeedbackValue(priority)}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
				</div>
			</div>
		</section>
	);
}

function InternalNoteSection({
	itemId,
	domId,
	note,
	noteIsDirty,
	onNoteChange,
	onSaveNote,
}: {
	itemId: string;
	domId: string;
	note: string;
	noteIsDirty: boolean;
	onNoteChange: (note: string) => void;
	onSaveNote: FeedbackDetailProps["onSaveNote"];
}) {
	const canManage = useAdminPermission({ feedback: ["manage"] });

	return (
		<section
			className="border-b px-5 py-5 sm:px-6"
			aria-labelledby={`note-${domId}`}
		>
			<div className="flex items-center gap-2">
				<NotePencilIcon
					aria-hidden="true"
					className="text-muted-foreground"
					size={16}
				/>
				<label
					id={`note-${domId}`}
					htmlFor={`note-input-${domId}`}
					className="font-medium text-sm"
				>
					Internal note
				</label>
			</div>
			<p className="mt-1 text-muted-foreground text-xs">
				Only administrators can see this note.
			</p>
			<Textarea
				id={`note-input-${domId}`}
				value={note}
				placeholder="Add investigation details, a decision, or the next step…"
				className="mt-3 min-h-24 resize-y bg-background"
				onChange={(event) => onNoteChange(event.target.value)}
				disabled={!canManage}
			/>
			<div className="mt-3 flex justify-end">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!canManage || !noteIsDirty}
					onClick={() => onSaveNote(itemId, note.trim())}
				>
					Save note
				</Button>
			</div>
		</section>
	);
}

function ActivitySection({
	item,
	domId,
}: Pick<FeedbackDetailProps, "item" | "domId">) {
	return (
		<section
			className="px-5 py-5 sm:px-6"
			aria-labelledby={`activity-${domId}`}
		>
			<h3 id={`activity-${domId}`} className="font-medium text-sm">
				Activity
			</h3>
			<div className="mt-4 space-y-0">
				{item.activity.map((activity, index) => (
					<div key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
						{index < item.activity.length - 1 ? (
							<span
								aria-hidden="true"
								className="absolute top-3 bottom-0 left-[5px] w-px bg-border"
							/>
						) : null}
						<span
							aria-hidden="true"
							className={cn(
								"relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-background bg-muted-foreground ring-1 ring-border",
								activity.tone === "accent" && "bg-primary ring-primary/25",
								activity.tone === "success" &&
									"bg-emerald-600 ring-emerald-600/25 dark:bg-emerald-400",
							)}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<p className="font-medium text-xs">{activity.label}</p>
								<time
									dateTime={activity.createdAt}
									className="text-muted-foreground text-xs"
								>
									{formatFeedbackDateTime(activity.createdAt)}
								</time>
							</div>
							<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
								{activity.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function ContextItem({
	icon: Icon,
	label,
	value,
	detail,
}: {
	icon: typeof MonitorIcon;
	label: string;
	value: string;
	detail: string;
}) {
	return (
		<div className="flex min-w-0 gap-2.5">
			<div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted/55 text-muted-foreground">
				<Icon aria-hidden="true" size={14} />
			</div>
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="mt-0.5 truncate font-medium text-xs">{value}</p>
				<p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
					{detail}
				</p>
			</div>
		</div>
	);
}

function FeedbackDetailEmpty() {
	return (
		<div className="grid min-h-[640px] flex-1 place-items-center bg-muted/10 px-8 text-center">
			<div className="max-w-xs">
				<div className="mx-auto grid size-12 place-items-center rounded-full border bg-background text-muted-foreground">
					<ChatCenteredDotsIcon aria-hidden="true" size={21} />
				</div>
				<h2 className="mt-4 font-semibold text-base">Select a conversation</h2>
				<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
					Choose feedback from the inbox to inspect the message, context, and
					workflow history.
				</p>
			</div>
		</div>
	);
}

export { FeedbackDetail, FeedbackDetailEmpty };
