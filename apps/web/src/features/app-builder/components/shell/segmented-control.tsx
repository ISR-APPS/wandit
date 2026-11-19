/**
 * Pill group with one active option. The work bar uses it as the view switcher.
 * The mobile stage, the dev view of the chat, and the theme sheet use it too.
 * Rendered by top-bar.tsx, phone-preview.tsx, chat-pane.tsx, and theme-sheet.tsx.
 * Pure presentation: the caller owns the value. An icon-only option shows
 * its label in a kit Tooltip, so the page must mount a TooltipProvider.
 */

import type { Icon } from "@phosphor-icons/react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";

export type SegmentedOption<T extends string> = {
	value: T;
	label: string;
	/** Phosphor icon. It shows in the bold weight in both states, so a switch changes only the segment under it. */
	icon?: Icon;
	/** Show the icon only. The label stays as the accessible name and shows in a tooltip. */
	iconOnly?: boolean;
};

export type SegmentedControlProps<T extends string> = {
	options: readonly SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** Accessible name of the whole group. */
	ariaLabel: string;
	className?: string;
};

/**
 * The track is a flat ink pill. The active option is a white pill with a
 * short shadow on it, and a spark pill in dark mode. The whole control is
 * 32 px high, like a bar button.
 */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	ariaLabel,
	className,
}: SegmentedControlProps<T>) {
	return (
		<fieldset
			aria-label={ariaLabel}
			className={cn(
				"flex shrink-0 items-center gap-0.5 rounded-full bg-night/[0.05] p-0.5 dark:bg-white/[0.06]",
				className,
			)}
		>
			{options.map((option) => {
				const isActive = option.value === value;
				const button = (
					<button
						key={option.value}
						type="button"
						aria-pressed={isActive}
						aria-label={option.iconOnly ? option.label : undefined}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex h-7 items-center gap-1.5 rounded-full font-grotesk font-medium text-[13px] outline-none transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
							option.iconOnly ? "w-8 justify-center" : "px-3",
							isActive
								? "bg-white text-night shadow-raised dark:bg-spark dark:text-night"
								: "text-night/60 hover:text-night dark:text-foreground/60 dark:hover:text-foreground",
						)}
					>
						{option.icon ? (
							<option.icon
								aria-hidden
								weight="bold"
								className="size-4 shrink-0"
							/>
						) : null}
						{option.iconOnly ? null : <span>{option.label}</span>}
					</button>
				);
				if (!option.iconOnly) return button;
				return (
					<Tooltip key={option.value}>
						<TooltipTrigger asChild>{button}</TooltipTrigger>
						<TooltipContent side="bottom">{option.label}</TooltipContent>
					</Tooltip>
				);
			})}
		</fieldset>
	);
}
