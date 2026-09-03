import type { AiErrorData } from "@wandit/contracts";
import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { titleCaseIdentifier } from "@/features/conversations/lib/conversation-formatters";
import { sentryEventUrl } from "@/features/conversations/lib/external-links";
import { cn } from "@/lib/utils";

export type InspectorAiError = AiErrorData & {
	sentryEventId?: string | null;
};

type AiErrorAlertProps = {
	failure: InspectorAiError;
	label?: string;
	compact?: boolean;
};

const fallbackFailureCopy: Partial<Record<AiErrorData["kind"], string>> = {
	auth_config: "The provider is not configured for this operation.",
	billing: "The operation stopped because billing could not be completed.",
	cancelled: "The operation was cancelled before it finished.",
	capacity: "The provider did not have capacity for this request.",
	connector_account: "The connected account could not complete this request.",
	connector_rejected: "The connector rejected this request.",
	connector_unreachable: "The connector could not be reached.",
	content_moderated: "The provider blocked this request for safety reasons.",
	invalid_request: "The provider rejected the request as invalid.",
	model_not_found: "The requested model was not available.",
	network: "A network error interrupted the operation.",
	provider_error: "The provider returned an error.",
	rate_limited: "The provider rate limit was reached.",
	timeout: "The operation timed out before it finished.",
};

export function AiErrorAlert({
	failure,
	label = "AI failure",
	compact = false,
}: AiErrorAlertProps) {
	const sentryUrl = sentryEventUrl(failure.sentryEventId ?? null);
	const sentence =
		failure.providerMessage ??
		fallbackFailureCopy[failure.kind] ??
		"The AI operation did not complete successfully.";
	const provider = providerName(failure);

	return (
		<div
			className={cn(
				"border-destructive/35 border-s-2 bg-destructive/5 text-sm",
				compact ? "px-2.5 py-2" : "rounded-md border-y border-e px-3 py-2.5",
			)}
			data-ai-error="true"
		>
			<div className="flex min-w-0 items-start gap-2">
				<TriangleAlertIcon
					aria-hidden="true"
					className="mt-0.5 size-3.5 shrink-0 text-destructive"
				/>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<span className="font-medium text-destructive text-xs">
							{label}
						</span>
						<Badge
							variant="outline"
							className="border-destructive/30 bg-destructive/5 px-1.5 py-0 text-destructive"
						>
							{titleCaseIdentifier(failure.kind)}
						</Badge>
					</div>
					<p
						className={cn(
							"mt-1 whitespace-pre-wrap break-words leading-5",
							compact && "line-clamp-2 text-xs",
						)}
					>
						{sentence}
					</p>
					<div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
						<span className="truncate">{provider}</span>
						{failure.requestId ? (
							<>
								<span aria-hidden="true">·</span>
								<code
									className="max-w-56 truncate font-mono"
									title={failure.requestId}
								>
									{failure.requestId}
								</code>
							</>
						) : null}
					</div>
				</div>
				{sentryUrl ? (
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className="-me-1 -mt-1 shrink-0 text-destructive"
					>
						<a
							href={sentryUrl}
							target="_blank"
							rel="noreferrer"
							aria-label="Open this failure in Sentry"
						>
							<ExternalLinkIcon aria-hidden="true" />
						</a>
					</Button>
				) : null}
			</div>
		</div>
	);
}

function providerName(failure: InspectorAiError): string {
	if (failure.providerLabel) {
		return failure.providerLabel;
	}

	if (failure.source.startsWith("provider:")) {
		return titleCaseIdentifier(failure.source.slice("provider:".length));
	}

	if (failure.source !== "unknown" && failure.source !== "ours") {
		return titleCaseIdentifier(failure.source);
	}

	return "Provider unknown";
}
