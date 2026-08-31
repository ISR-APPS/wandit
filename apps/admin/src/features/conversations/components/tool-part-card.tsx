import { BracesIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { titleCaseIdentifier } from "@/features/conversations/lib/conversation-formatters";

type ToolPartCardProps = {
	part: unknown;
	index: number;
};

export function ToolPartCard({ part, index }: ToolPartCardProps) {
	const partRecord = isRecord(part) ? part : null;
	const type = typeof partRecord?.type === "string" ? partRecord.type : "data";
	const state =
		typeof partRecord?.state === "string" ? partRecord.state : undefined;

	return (
		<details className="group rounded-lg border bg-muted/20">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm marker:content-none">
				<ChevronRightIcon
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
				/>
				<BracesIcon
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<span className="min-w-0 flex-1 truncate font-medium">
					{titleCaseIdentifier(type.replace(/^tool-/, ""))}
				</span>
				{state ? <Badge variant="outline">{state}</Badge> : null}
			</summary>
			<section
				className="border-t p-3"
				aria-label={`Message part ${index + 1} JSON`}
			>
				<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px] leading-5">
					{stringifyPart(part)}
				</pre>
			</section>
		</details>
	);
}

function stringifyPart(part: unknown): string {
	try {
		return JSON.stringify(part, null, 2) ?? String(part);
	} catch {
		return String(part);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
