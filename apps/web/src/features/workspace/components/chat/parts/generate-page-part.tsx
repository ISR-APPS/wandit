// In-thread status line for a generate_page call. The page itself NEVER
// renders in chat — generation runs in a background task and the result lands
// in the Page tab (which polls the overview endpoint). This part only tells
// the user what stage the hand-off is at, in the calm StatusMessageHeader
// voice the stream-error state already uses.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import { AlertTriangle } from "lucide-react";

import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GeneratePageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_page" }
>;

export function GeneratePagePart({ part }: { part: GeneratePageToolPart }) {
	// The brief streams in first (it's long), then the tool executes server-side.
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? "Working on your page brief…"
						: "Queueing the build…"
				}
			/>
		);
	}

	if (part.state === "output-error") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Page build failed to start"
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{part.errorText}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;

	if (part.output.status === "queued") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-primary/38 bg-primary/12 text-ember-text"
					kickerClass="text-ember-text"
					kicker="Building your page"
				>
					<SpinnerArc className="size-3" />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{part.output.versionNumber
						? `Building v${part.output.versionNumber} — it will appear in the Page tab.`
						: "Building your page — it will appear in the Page tab."}
				</p>
			</div>
		);
	}

	// "unavailable" — the server is missing R2/Trigger credentials; relay the
	// tool's honest message instead of pretending a page is coming.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

/** Quiet spinner + line while the tool call is still in flight. */
function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}
