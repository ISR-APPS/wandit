import type { AiErrorData } from "@wandit/contracts";
import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { sentryEventUrl } from "@/features/conversations/lib/external-links";

type InspectorAiError = AiErrorData & {
	sentryEventId?: string | null;
};

type AiErrorAlertProps = {
	failure: InspectorAiError;
	label?: string;
};

export function AiErrorAlert({
	failure,
	label = "AI failure",
}: AiErrorAlertProps) {
	const sentryUrl = sentryEventUrl(failure.sentryEventId ?? null);

	return (
		<div
			className="rounded-lg border border-destructive/30 bg-destructive/7 p-3 text-sm"
			data-ai-error="true"
		>
			<div className="flex flex-wrap items-center gap-2">
				<TriangleAlertIcon
					aria-hidden="true"
					className="size-4 text-destructive"
				/>
				<span className="font-medium text-destructive">{label}</span>
				<Badge variant="destructive">{failure.kind}</Badge>
				<Badge variant="outline">{failure.source}</Badge>
			</div>
			<dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
				<ErrorDetail label="Provider" value={failure.providerLabel} />
				<ErrorDetail label="Request ID" value={failure.requestId} mono />
				{failure.providerMessage ? (
					<div className="sm:col-span-2">
						<dt className="text-muted-foreground text-xs">Provider message</dt>
						<dd className="mt-0.5 whitespace-pre-wrap break-words">
							{failure.providerMessage}
						</dd>
					</div>
				) : null}
			</dl>
			{sentryUrl ? (
				<a
					href={sentryUrl}
					target="_blank"
					rel="noreferrer"
					className="mt-3 inline-flex items-center gap-1 font-medium text-primary text-xs underline-offset-4 hover:underline"
				>
					Sentry event
					<ExternalLinkIcon aria-hidden="true" className="size-3" />
				</a>
			) : null}
		</div>
	);
}

function ErrorDetail({
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
			<dd className={mono ? "mt-0.5 truncate font-mono text-xs" : "mt-0.5"}>
				{value ?? "—"}
			</dd>
		</div>
	);
}
