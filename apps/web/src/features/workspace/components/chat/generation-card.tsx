// Inline artifact card in the chat — the version a generation produced.
// Running: shimmering placeholder; complete: click to view in the canvas.

/**
 * WHAT THIS FILE IS
 * -----------------
 * When the AI generates a page version, the assistant's chat message doesn't
 * just contain text — it also contains a "generation" part (see GenerationPart
 * in ../../api/dto.ts). This component renders that part as a small card
 * inside the chat transcript, a bit like the file/artifact cards you see in
 * ChatGPT or Claude.
 *
 * WHERE IT SITS IN THE FLOW
 * -------------------------
 * chat-message.tsx (ChatMessageView) walks over a message's `parts` array and
 * renders text parts as paragraphs and generation parts as <GenerationCard>.
 * When the user clicks a completed card, we call `selectVersion` on the
 * workspace store, which switches the canvas ("Page" tab) to show that
 * version. So this card is the bridge from "chat history" to "preview pane".
 *
 * NOTE / GOTCHA
 * -------------
 * The `status: "running"` branch (spinner + shimmer) is currently
 * forward-looking: as of now nothing in the web app produces a running part —
 * The demo path only creates status "complete" cards, and the SSE stream
 * hook (use-project-chat.tsx) doesn't yet emit artifact-updated parts. The
 * running UI will light up once the real streaming events are wired through.
 */

import { cn } from "@wandit/ui/lib/utils";
// lucide-react is the icon library used across the app; each icon is just a
// small React component that renders an inline SVG.
import { Check, Loader2 } from "lucide-react";

// thumbGradient(seed) deterministically turns a number into a CSS gradient
// string — same seed, same colors. Shared with the project cards on the
// dashboard so version thumbnails feel related to their project.
import { thumbGradient } from "@/features/projects";
// i18n hook: t("some.key") looks up the translated string for the current
// language (en/fr/ar). Never hardcode user-facing text — Algeria market means
// Arabic (right-to-left) and French must both work.
import { useTranslation } from "@/lib/i18n";
import type { GenerationPart } from "../../api/dto";
// useWorkspace is a plain React context "store" (not Zustand/Redux): a
// provider higher up holds the workspace state (project, versions, active
// tab...) and this hook reads it. See ../../lib/store.tsx.
import { useWorkspace } from "../../lib/store";

// The inline version card rendered inside an assistant chat message.
// One card = one generated page version. Two visual states:
//   - running:  non-clickable placeholder with a spinner + ember shimmer
//   - complete: a button; clicking it opens that version in the Page tab
export function GenerationCard({ part }: { part: GenerationPart }) {
	const { t } = useTranslation();
	const { project, activeVersion, selectVersion } = useWorkspace();
	const isRunning = part.status === "running";
	// "Active" = this card's version is the one currently shown in the canvas.
	// We show a checkmark on it so the user can see which version they're
	// looking at. The versionId null-check matters because a running part has
	// versionId === null until the job finishes.
	const isActive =
		!isRunning &&
		part.versionId !== null &&
		activeVersion?.id === part.versionId;

	// Build a deterministic gradient for the mini thumbnail. The seed mixes the
	// project's own thumbnailSeed with the version number (times an arbitrary
	// prime-ish 17) so every version of a project gets a different-but-stable
	// color. `?? 7` is just a fallback while the project hasn't loaded yet.
	const thumbBackground = thumbGradient(
		(project?.thumbnailSeed ?? 7) + part.versionNumber * 17,
	);

	// The card's inner content is identical in both states, so we build it once
	// here and wrap it in either a plain <div> (running) or a <button>
	// (complete) below. The <>...</> is a React Fragment: it groups children
	// without adding an extra DOM element.
	const body = (
		<>
			{/* Left: 40px square gradient thumbnail with the version number on
			    top. aria-hidden because it's purely decorative — screen readers
			    get the same "v3" from the text column next to it. */}
			<div
				aria-hidden
				className="relative size-10 shrink-0 overflow-hidden rounded-lg"
				style={{ background: thumbBackground }}
			>
				{/* bg-grain is a custom Tailwind utility that overlays a subtle
				    film-grain texture (part of the "desert light" design
				    language). pointer-events-none so it never eats clicks. */}
				<div className="pointer-events-none absolute inset-0 bg-grain" />
				<span className="absolute inset-0 grid place-items-center font-bold font-display text-sm text-white/85">
					v{part.versionNumber}
				</span>
			</div>
			{/* Middle: title row + summary line. min-w-0 lets the flex child
			    shrink below its content size so `truncate` (ellipsis) can kick
			    in. text-start (not text-left) so it flips correctly in RTL
			    Arabic. */}
			<div className="min-w-0 flex-1 text-start">
				<p className="truncate font-medium text-sm">
					{t("workspace.chat.versionCardKind")}
					{/* ms-1.5 = margin-inline-start, the RTL-safe version of
					    margin-left. tabular-nums keeps digits equal-width so
					    version numbers line up nicely. */}
					<span className="ms-1.5 font-mono text-muted-foreground text-xs tabular-nums">
						v{part.versionNumber}
					</span>
				</p>
				{/* dir="auto" lets the browser pick text direction per-line, so
				    an Arabic summary renders right-to-left even in an English
				    UI. While running we show "Generating vN..." instead of the
				    (not yet available) summary. */}
				<p dir="auto" className="truncate text-muted-foreground text-xs">
					{isRunning
						? t("workspace.page.generatingTitle", { n: part.versionNumber })
						: part.summary}
				</p>
			</div>
			{/* Right: status affordance. Spinner while running, a small check
			    badge when this version is the one open in the canvas, nothing
			    otherwise. */}
			{isRunning ? (
				<Loader2 className="size-4 shrink-0 animate-spin text-primary" />
			) : isActive ? (
				<span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10">
					<Check className="size-3 text-primary" />
				</span>
			) : null}
		</>
	);

	// RUNNING STATE: render a non-interactive <div>. There is nothing to click
	// yet (versionId is still null), so making it a button would be misleading.
	// The absolutely-positioned overlay pulses the ember brand gradient at 6%
	// opacity over the whole card — that's the "shimmer" that says
	// "work in progress".
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

	// COMPLETE STATE: the whole card is a real <button> (keyboard/screen-reader
	// friendly for free). Clicking selects this version in the workspace store;
	// { focusPage: true } also switches the workspace to the "Page" tab so the
	// user immediately sees the version, even if they were on another tab.
	return (
		<button
			type="button"
			onClick={() => {
				// Defensive guard: versionId should always be set once status is
				// "complete", but the type allows null, so we check anyway.
				if (part.versionId) {
					selectVersion(
						{ id: part.versionId, number: part.versionNumber },
						{ focusPage: true },
					);
				}
			}}
			// cn() merges Tailwind class strings and drops falsy entries — it
			// lets us append the conditional `isActive && ...` border cleanly.
			className={cn(
				"flex items-center gap-3 rounded-xl border bg-card p-3 text-start transition-all duration-150",
				// Hover: lift the card 2px and warm up the border/shadow.
				"hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
				// focus-visible = only show the ring for keyboard focus, not
				// mouse clicks.
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				// Currently-viewed version gets a stronger ember border.
				isActive && "border-primary/40",
			)}
		>
			{body}
		</button>
	);
}
