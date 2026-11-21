/**
 * The thinking control of a model card: a brain badge, the title, a
 * Light | Balanced | Deep toggle group, and the hint of the picked level.
 * Also the brain mark that a chip shows when the level is not Balanced.
 * builder-model-picker.tsx and chat/model-lock-chip.tsx render both. The
 * caller owns the state, through useBuilderModelPick.
 */

import type { IconWeight } from "@phosphor-icons/react";
import { BrainIcon } from "@phosphor-icons/react/Brain";
import { type BuilderThinking, builderThinkingSchema } from "@wandit/contracts";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { cn } from "@wandit/ui/lib/utils";
import { useId } from "react";

import { useTranslation } from "@/lib/i18n";

// The brain gets heavier with the level, so the badge and the chip mark read the level at a glance.
const BRAIN_WEIGHT: Record<BuilderThinking, IconWeight> = {
	light: "regular",
	balanced: "bold",
	deep: "fill",
};

/** Props of the thinking row. */
export type ThinkingLevelRowProps = {
	/** The level the next send uses. A caller passes "balanced" while the control is unavailable, because the server then runs its default. */
	level: BuilderThinking;
	onLevelChange: (level: BuilderThinking) => void;
	/** Set when the model of the next send has no thinking control (Standard): the group is disabled, and this text replaces the level hint. */
	unavailableHint: string | undefined;
};

/** A muted badge on Balanced, an ember badge on Light or Deep. */
export function ThinkingLevelRow({
	level,
	onLevelChange,
	unavailableHint,
}: ThinkingLevelRowProps) {
	const { t } = useTranslation();
	const titleId = useId();
	const hintId = useId();
	const isAvailable = unavailableHint === undefined;
	const isTinted = isAvailable && level !== "balanced";
	return (
		<div className="mt-3 border-border/60 border-t pt-3">
			<div className="flex items-center gap-2.5">
				<span
					aria-hidden
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none",
						isTinted
							? "bg-ember/[0.12] text-ember-text dark:bg-spark/[0.14] dark:text-spark"
							: "bg-muted text-muted-foreground",
						!isAvailable && "opacity-50",
					)}
				>
					<BrainIcon weight={BRAIN_WEIGHT[level]} className="size-4" />
				</span>
				<p
					id={titleId}
					className={cn(
						"min-w-0 flex-1 font-grotesk font-semibold text-[13px] leading-tight",
						!isAvailable && "text-muted-foreground",
					)}
				>
					{t("appBuilder.chat.model.thinking.label")}
				</p>
			</div>
			{/* Radix moves the focus between the items with the arrow keys. */}
			<ToggleGroup
				type="single"
				size="sm"
				spacing={1}
				value={level}
				aria-labelledby={titleId}
				aria-describedby={hintId}
				onValueChange={(value) => {
					if (!isAvailable) return;
					// Radix sends an empty value when the user clicks the picked item again. The level then stays.
					const parsed = builderThinkingSchema.safeParse(value);
					if (parsed.success) onLevelChange(parsed.data);
				}}
				className="mt-2 w-full rounded-full bg-muted p-0.5"
			>
				{builderThinkingSchema.options.map((option) => {
					const name = t(`appBuilder.chat.model.thinking.${option}.name`);
					return (
						// aria-disabled, not disabled: Tab still reaches the group, so a screen reader reads the hint that says why.
						<ToggleGroupItem
							key={option}
							value={option}
							aria-label={name}
							aria-disabled={!isAvailable}
							className="h-7 min-w-0 flex-1 rounded-full px-1 font-grotesk text-[11.5px] text-muted-foreground hover:bg-transparent hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-muted-foreground data-[state=on]:bg-background data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-xs"
						>
							<span className="truncate">{name}</span>
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>
			<p
				id={hintId}
				className="mt-1.5 text-[11px] text-muted-foreground leading-snug"
			>
				{unavailableHint ?? t(`appBuilder.chat.model.thinking.${level}.hint`)}
			</p>
		</div>
	);
}

/** Brain mark of a chip. The callers render it only for a level other than Balanced, where the control is available. */
export function ThinkingMark({
	level,
}: {
	/** The picked level. Balanced is the default, so a chip shows no mark for it. */
	level: Exclude<BuilderThinking, "balanced">;
}) {
	return (
		<BrainIcon
			weight={BRAIN_WEIGHT[level]}
			className="size-3.5 shrink-0 text-ember-text dark:text-spark"
			aria-hidden
		/>
	);
}
