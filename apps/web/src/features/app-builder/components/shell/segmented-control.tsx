/**
 * Pill group with one active option: the view switcher of the work bar, the
 * target switch of the mobile stage, and the small toggles in the More
 * panels. Rendered by top-bar.tsx, phone-preview.tsx, and settings-panel.tsx.
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
	/** Phosphor icon, in the bold weight in both states. A filled icon reads as a badge on the night pill. */
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
	/** `sm` fits a 48 px bar. `md` fits a panel row. */
	size?: "sm" | "md";
	className?: string;
};

/**
 * The active option is a night pill (a spark pill in dark mode), like the
 * active link of the dashboard sidebar.
 */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	ariaLabel,
	size = "sm",
	className,
}: SegmentedControlProps<T>) {
	return (
		<fieldset
			aria-label={ariaLabel}
			className={cn(
				"flex shrink-0 items-center gap-0.5 rounded-full bg-night/[0.05] p-1 dark:bg-white/[0.06]",
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
							"flex items-center gap-1.5 rounded-full font-grotesk font-medium text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
							size === "sm" ? "h-8" : "h-9",
							option.iconOnly ? "w-9 justify-center" : "px-3",
							isActive
								? "bg-night text-paper dark:bg-spark dark:text-night"
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
