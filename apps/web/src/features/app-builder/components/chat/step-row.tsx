/**
 * One row of the activity feed: what the agent did, in plain words, for
 * example "Edited" + `styles.css`, or the model's sentence for a command.
 * A state icon leads the row: a green check, an ember spinner, a red
 * warning, or a grey minus for a skipped step. The technical detail (diff
 * lines, the command and its output, the SQL) opens behind the caret. An
 * image the step read or made shows under the row. A secret that has no
 * value gets a link to the Secrets panel. Rendered for each `data-step`
 * part by chat-message.tsx and activity-panel.tsx.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { MinusCircleIcon } from "@phosphor-icons/react/MinusCircle";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { cn } from "@wandit/ui/lib/utils";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { BuilderDataParts, BuilderStepKind } from "../../api/dto";
import { ShimmerText } from "./shimmer-text";

/** Props of one `data-step` part, as chat-message.tsx and activity-panel.tsx pass them. */
export type StepRowProps = BuilderDataParts["step"] & {
	/** Opens the Secrets panel. Absent while the Cloud panels are off; the link then hides. */
	onOpenSecrets?: () => void;
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

/**
 * One activity row: a state icon, a plain label, and a target chip; the
 * detail opens behind the caret. A step image always shows under the row.
 */
export function StepRow({
	kind,
	state,
	target,
	description,
	detail,
	imageUrl,
	isSecretMissing,
	onOpenSecrets,
}: StepRowProps) {
	const { t } = useTranslation();
	const isRunning = state === "running";
	// The model writes the command sentence in the user's language, so it
	// replaces the generic label.
	const label = description ?? t(labelKeyOf(kind, isRunning, target !== null));

	const row = (
		<>
			<span className="grid size-4 shrink-0 place-items-center">
				{isRunning ? (
					<CircleNotchIcon
						weight="bold"
						className="size-4 animate-spin text-ember motion-reduce:animate-none dark:text-spark"
						aria-hidden
					/>
				) : state === "error" ? (
					<WarningCircleIcon
						weight="fill"
						className="size-4 text-destructive"
						aria-hidden
					/>
				) : state === "skipped" ? (
					<MinusCircleIcon
						weight="fill"
						className="size-4 text-night/25 dark:text-foreground/25"
						aria-hidden
					/>
				) : (
					<CheckCircleIcon
						weight="fill"
						className="size-4 text-success"
						aria-hidden
					/>
				)}
			</span>
			<span
				dir="auto"
				className={cn(
					"min-w-0 truncate",
					state === "skipped" && "text-night/45 dark:text-foreground/45",
				)}
			>
				{isRunning ? <ShimmerText>{label}</ShimmerText> : label}
			</span>
			{target !== null ? (
				<span
					dir="ltr"
					className="min-w-0 truncate rounded-md bg-night/[0.05] px-1.5 py-px font-mono text-[12px] text-night/70 dark:bg-white/[0.07] dark:text-foreground/70"
				>
					{target}
				</span>
			) : null}
			{isSecretMissing && onOpenSecrets ? (
				// The agent cannot set a value: the user adds it in the Secrets panel.
				<button
					type="button"
					onClick={onOpenSecrets}
					className="shrink-0 rounded-[6px] font-grotesk font-medium text-[12px] text-ember-text underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ember/30"
				>
					{t("appBuilder.chat.addSecret")}
				</button>
			) : state === "error" ? (
				<span className="shrink-0 text-[12px] text-destructive">
					{t("appBuilder.chat.stepFailed")}
				</span>
			) : state === "skipped" ? (
				<span className="shrink-0 text-[12px] text-night/45 dark:text-foreground/45">
					{t("appBuilder.chat.stepSkipped")}
				</span>
			) : null}
		</>
	);

	// One type scale for every feed row: grotesk 13 px at 70 % ink.
	const rowClass =
		"flex min-h-7 w-full min-w-0 items-center gap-2 py-0.5 font-grotesk text-[13px] text-night/70 dark:text-foreground/70";

	// The alt text is the file name. A generated image has no name, so it is decorative.
	// The max width leaves room for the ms-6 indent under the row icon.
	const image =
		imageUrl === null ? null : (
			<img
				src={imageUrl}
				alt={target ?? ""}
				loading="lazy"
				className="ms-6 mt-1 mb-2 block max-h-48 max-w-[calc(100%-1.5rem)] self-start rounded-[12px] border border-night/[0.08] object-contain dark:border-white/[0.08]"
			/>
		);

	if (detail.length === 0) {
		return (
			<>
				<div className={rowClass}>{row}</div>
				{image}
			</>
		);
	}

	return (
		<Collapsible>
			<CollapsibleTrigger
				className={cn(
					rowClass,
					"group rounded-[8px] text-start outline-none transition-colors duration-150 hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:hover:text-foreground",
				)}
			>
				{row}
				<CaretDownIcon
					weight="bold"
					className="ms-auto size-3 shrink-0 text-night/35 transition-transform group-hover:text-night/70 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-foreground/35 dark:group-hover:text-foreground/70"
					aria-hidden
				/>
			</CollapsibleTrigger>
			{image}
			<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
				<pre
					dir="ltr"
					className="scroll-warm mt-1 mb-2 max-h-72 overflow-auto rounded-[12px] border border-night/[0.08] bg-white py-2 font-mono text-[12px] text-night/80 leading-5 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-foreground/80"
				>
					{detail.map((line, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: detail lines have no id and never reorder
							key={index}
							data-line-kind={line.kind}
							className={cn(
								"whitespace-pre-wrap break-all px-3",
								line.kind === "add" && "bg-success/10 text-success-text",
								line.kind === "remove" && "bg-destructive/10 text-destructive",
								line.kind === "context" &&
									"text-night/55 dark:text-foreground/55",
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
