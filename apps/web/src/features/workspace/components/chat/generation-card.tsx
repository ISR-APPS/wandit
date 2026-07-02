// Inline artifact card in the chat — the version a generation produced.
// Running: shimmering placeholder; complete: click to view in the canvas.

import { cn } from "@my-better-t-app/ui/lib/utils";
import { Check, Loader2 } from "lucide-react";

import { thumbGradient } from "@/features/projects";
import type { GenerationPart } from "../../api/dto";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

export function GenerationCard({ part }: { part: GenerationPart }) {
	const { project, activeVersion, selectVersion } = useWorkspace();
	const isRunning = part.status === "running";
	const isActive =
		!isRunning &&
		part.versionId !== null &&
		activeVersion?.id === part.versionId;

	const thumbBackground = thumbGradient(
		(project?.thumbnailSeed ?? 7) + part.versionNumber * 17,
	);

	const body = (
		<>
			<div
				aria-hidden
				className="relative size-10 shrink-0 overflow-hidden rounded-lg"
				style={{ background: thumbBackground }}
			>
				<div className="pointer-events-none absolute inset-0 bg-grain" />
				<span className="absolute inset-0 grid place-items-center font-bold font-display text-sm text-white/85">
					v{part.versionNumber}
				</span>
			</div>
			<div className="min-w-0 flex-1 text-left">
				<p className="truncate font-medium text-sm">
					{WORKSPACE_COPY.chat.versionCardKind}
					<span className="ml-1.5 font-mono text-muted-foreground text-xs tabular-nums">
						v{part.versionNumber}
					</span>
				</p>
				<p dir="auto" className="truncate text-muted-foreground text-xs">
					{isRunning
						? WORKSPACE_COPY.canvas.generatingTitle(part.versionNumber)
						: part.summary}
				</p>
			</div>
			{isRunning ? (
				<Loader2 className="size-4 shrink-0 animate-spin text-primary" />
			) : isActive ? (
				<span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10">
					<Check className="size-3 text-primary" />
				</span>
			) : null}
		</>
	);

	if (isRunning) {
		return (
			<div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-primary/25 bg-card p-3">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-ember opacity-[0.06]"
				/>
				{body}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => {
				if (part.versionId) {
					selectVersion(part.versionId, { focusCanvas: true });
				}
			}}
			className={cn(
				"flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-150",
				"hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				isActive && "border-primary/40",
			)}
		>
			{body}
		</button>
	);
}
