/**
 * Pill group with one active option: the view switcher, the device and
 * viewport toggles in the top bar, and the small toggles in the More panels.
 * Rendered by top-bar.tsx, payments-panel.tsx, and settings-panel.tsx.
 * Pure presentation: the caller owns the value.
 */

import { cn } from "@wandit/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export type SegmentedOption<T extends string> = {
	value: T;
	label: string;
	icon?: LucideIcon;
	/** Show the icon only. The label stays as the accessible name. */
	iconOnly?: boolean;
};

export type SegmentedControlProps<T extends string> = {
	options: readonly SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** Accessible name of the whole group. */
	ariaLabel: string;
	/** `sm` fits the top bar. `md` fits a panel row. */
	size?: "sm" | "md";
	className?: string;
};

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
				"flex shrink-0 items-center gap-0.5 rounded-full border bg-muted/70 p-[3px] dark:bg-white/5",
				className,
			)}
		>
			{options.map((option) => {
				const isActive = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={isActive}
						aria-label={option.iconOnly ? option.label : undefined}
						title={option.iconOnly ? option.label : undefined}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex items-center gap-1.5 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
							size === "sm" ? "h-[26px] text-[13px]" : "h-8 text-sm",
							option.iconOnly ? "px-2.5" : "px-3",
							isActive
								? "bg-background font-medium text-foreground shadow-segment dark:bg-white/[0.13] dark:shadow-none"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{option.icon ? (
							<option.icon className="size-3.5 shrink-0" strokeWidth={1.8} />
						) : null}
						{option.iconOnly ? null : <span>{option.label}</span>}
					</button>
				);
			})}
		</fieldset>
	);
}
