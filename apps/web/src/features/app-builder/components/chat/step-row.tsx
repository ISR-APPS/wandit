/**
 * One row of the activity feed: what the agent did, in plain words, for
 * example "Edited" + `styles.css`, or the model's sentence for a command.
 * The technical detail (diff lines, the command, the SQL) opens behind the
 * chevron. Rendered by chat-message.tsx for each `data-step` part.
 */

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { cn } from "@wandit/ui/lib/utils";
import {
	BookOpen,
	ChevronDown,
	CircleX,
	CloudUpload,
	Database,
	DatabaseZap,
	FilePen,
	FileSearch,
	Globe,
	ImageIcon,
	KeyRound,
	type LucideIcon,
	SquareTerminal,
	Workflow,
	Wrench,
} from "lucide-react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { BuilderDataParts, BuilderStepKind } from "../../api/dto";
import { ShimmerText } from "./shimmer-text";

/** Props of one `data-step` part, as chat-message.tsx passes them. */
export type StepRowProps = BuilderDataParts["step"];

const ICONS: Record<BuilderStepKind, LucideIcon> = {
	edit: FilePen,
	explore: FileSearch,
	run: SquareTerminal,
	web: Globe,
	image: ImageIcon,
	database: Database,
	databaseCheck: DatabaseZap,
	deploy: CloudUpload,
	secret: KeyRound,
	network: Globe,
	guide: BookOpen,
	task: Workflow,
	other: Wrench,
};

/**
 * The dictionary key of a row label. Explore and web rows have one label
 * for a single named target and one for a search; the others have a done
 * and a running label.
 */
function labelKeyOf(
	kind: BuilderStepKind,
	isRunning: boolean,
	hasTarget: boolean,
): TranslationKey {
	switch (kind) {
		case "explore":
			if (isRunning) return "appBuilder.chat.steps.explore.running";
			return hasTarget
				? "appBuilder.chat.steps.explore.one"
				: "appBuilder.chat.steps.explore.many";
		case "web":
			if (isRunning) return "appBuilder.chat.steps.web.running";
			return hasTarget
				? "appBuilder.chat.steps.web.fetch"
				: "appBuilder.chat.steps.web.search";
		default:
			return `appBuilder.chat.steps.${kind}.${isRunning ? "running" : "done"}`;
	}
}

/** One activity row: an icon, a plain label, and a target chip; the detail opens behind the chevron. */
export function StepRow({
	kind,
	state,
	target,
	description,
	detail,
}: StepRowProps) {
	const { t } = useTranslation();
	const isRunning = state === "running";
	// The model writes the command sentence in the user's language, so it
	// replaces the generic label.
	const label = description ?? t(labelKeyOf(kind, isRunning, target !== null));
	const Icon = ICONS[kind];

	const row = (
		<>
			<span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
				{isRunning ? (
					<span
						aria-hidden
						className="size-3 animate-spin rounded-full border-[1.5px] border-stone border-t-foreground motion-reduce:animate-none"
					/>
				) : state === "error" ? (
					<CircleX className="size-4 text-destructive" aria-hidden />
				) : (
					<Icon className="size-4" aria-hidden />
				)}
			</span>
			<span
				dir="auto"
				className={cn(
					"min-w-0 truncate",
					state === "skipped" && "text-muted-foreground",
				)}
			>
				{isRunning ? <ShimmerText>{label}</ShimmerText> : label}
			</span>
			{target !== null ? (
				<span
					dir="ltr"
					className="min-w-0 truncate rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground"
				>
					{target}
				</span>
			) : null}
			{state === "error" ? (
				<span className="shrink-0 text-destructive text-xs">
					{t("appBuilder.chat.stepFailed")}
				</span>
			) : state === "skipped" ? (
				<span className="shrink-0 text-muted-foreground text-xs">
					{t("appBuilder.chat.stepSkipped")}
				</span>
			) : null}
		</>
	);

	if (detail.length === 0) {
		return (
			<div className="flex min-h-8 min-w-0 items-center gap-2.5 py-1 text-sm">
				{row}
			</div>
		);
	}

	return (
		<Collapsible>
			<CollapsibleTrigger className="group flex min-h-8 w-full min-w-0 items-center gap-2.5 rounded-md py-1 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
				{row}
				<ChevronDown
					className="ms-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground group-data-[state=open]:rotate-180 motion-reduce:transition-none"
					aria-hidden
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
				<pre
					dir="ltr"
					className="scroll-warm ms-2 mt-1 mb-2 max-h-72 overflow-auto border-s ps-4 font-mono text-[12px] leading-5"
				>
					{detail.map((line, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: detail lines have no id and never reorder
							key={index}
							data-line-kind={line.kind}
							className={cn(
								"whitespace-pre-wrap break-all px-1",
								line.kind === "add" && "bg-success/10 text-success-text",
								line.kind === "remove" && "bg-destructive/10 text-destructive",
								line.kind === "context" && "text-muted-foreground",
							)}
						>
							{line.text === "" ? " " : line.text}
						</div>
					))}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}
