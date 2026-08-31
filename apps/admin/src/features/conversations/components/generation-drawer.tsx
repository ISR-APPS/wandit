import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type {
	GenerationAttemptDetail,
	GenerationSurface,
} from "@/features/conversations/api/conversations.dto";
import { useGenerationAttemptQuery } from "@/features/conversations/api/conversations.queries";
import { formatConversationDateTime } from "@/features/conversations/lib/conversation-formatters";
import { sentryEventUrl } from "@/features/conversations/lib/external-links";

const ATTEMPT_SKELETON_KEYS = [
	"attempt-id",
	"status",
	"source",
	"provider",
	"request-id",
	"project-id",
	"user-id",
	"created-at",
] as const;

export type SelectedGenerationAttempt = {
	surface: GenerationSurface;
	attemptId: string;
};

type GenerationDrawerProps = {
	selection: SelectedGenerationAttempt | null;
	onOpenChange: (open: boolean) => void;
};

export function GenerationDrawer({
	selection,
	onOpenChange,
}: GenerationDrawerProps) {
	const query = useGenerationAttemptQuery(
		selection ?? { surface: "image", attemptId: "none" },
		{ enabled: selection !== null },
	);

	return (
		<Sheet open={selection !== null} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-xl">
				<SheetHeader className="border-b">
					<SheetTitle>Generation attempt</SheetTitle>
					<SheetDescription>
						Safe attempt metadata and failure correlation fields.
					</SheetDescription>
				</SheetHeader>
				<div className="px-4 pb-6">
					{query.isPending ? (
						<GenerationDrawerSkeleton />
					) : query.isError || !query.data ? (
						<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
							<p className="font-medium text-sm">Attempt could not be loaded</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{query.error instanceof Error
									? query.error.message
									: "Retry after closing this panel."}
							</p>
						</div>
					) : (
						<GenerationAttemptContent detail={query.data} />
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function GenerationAttemptContent({
	detail,
}: {
	detail: GenerationAttemptDetail;
}) {
	const sentryUrl = sentryEventUrl(detail.sentryEventId);

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline">{detail.surface}</Badge>
				<Badge variant={detail.kind ? "destructive" : "secondary"}>
					{detail.kind ?? detail.status}
				</Badge>
			</div>

			<dl className="grid gap-4 sm:grid-cols-2">
				<AttemptField label="Attempt ID" value={detail.id} mono />
				<AttemptField label="Status" value={detail.status} />
				<AttemptField label="Source" value={detail.source} />
				<AttemptField label="Provider" value={detail.provider} />
				<AttemptField label="Request ID" value={detail.requestId} mono />
				<AttemptField label="Project ID" value={detail.projectId} mono />
				<AttemptField label="User ID" value={detail.userId} mono />
				<AttemptField
					label="Created"
					value={formatConversationDateTime(detail.createdAt)}
				/>
				<AttemptField
					label="Updated"
					value={formatConversationDateTime(detail.updatedAt)}
				/>
			</dl>

			{detail.providerMessage || detail.error ? (
				<div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
					{detail.providerMessage ? (
						<div>
							<p className="text-muted-foreground text-xs">Provider message</p>
							<p className="mt-1 whitespace-pre-wrap break-words">
								{detail.providerMessage}
							</p>
						</div>
					) : null}
					{detail.error ? (
						<div>
							<p className="text-muted-foreground text-xs">Stored error</p>
							<p className="mt-1 whitespace-pre-wrap break-words">
								{detail.error}
							</p>
						</div>
					) : null}
				</div>
			) : null}

			{sentryUrl ? (
				<a
					href={sentryUrl}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
				>
					Open Sentry event
					<ExternalLinkIcon aria-hidden="true" className="size-4" />
				</a>
			) : null}

			<div>
				<p className="mb-2 font-medium text-sm">Safe raw fields</p>
				<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 font-mono text-[11px] leading-5">
					{JSON.stringify(detail.raw, null, 2)}
				</pre>
			</div>
		</div>
	);
}

function AttemptField({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string | null;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd
				className={
					mono ? "mt-1 break-all font-mono text-xs" : "mt-1 break-words text-sm"
				}
			>
				{value ?? "—"}
			</dd>
		</div>
	);
}

function GenerationDrawerSkeleton() {
	return (
		<div className="space-y-5" role="status" aria-label="Loading attempt">
			<Skeleton className="h-6 w-36" />
			<div className="grid gap-4 sm:grid-cols-2">
				{ATTEMPT_SKELETON_KEYS.map((key) => (
					<div key={key} className="space-y-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-4 w-full" />
					</div>
				))}
			</div>
		</div>
	);
}
