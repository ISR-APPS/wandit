/**
 * One on/off row of a model card: an icon badge, a title, a hint, and a
 * switch. The Fast mode row of a locked conversation uses it, in
 * chat/model-lock-chip.tsx. The caller owns the state. The thinking row
 * has three levels, so thinking-level-row.tsx draws it.
 */

import type { Icon } from "@phosphor-icons/react";
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

// Amber while on, like the Fast button of the model picker.
const ON_BADGE_CLASS = "bg-amber-400/15 text-amber-600 dark:text-amber-400";
const ON_SWITCH_CLASS = "data-[state=checked]:bg-amber-500";

/** Props of one row. The callers pass translated text. */
export type ModeSwitchRowProps = {
	/** Phosphor icon of the badge: bold while off, fill while on. */
	icon: Icon;
	title: string;
	/** The line under the title while the row is available. */
	hint: string;
	/** Set when the mode cannot change now: the switch is disabled, and this text replaces `hint`. */
	unavailableHint: string | undefined;
	/** The state the next send uses. A disabled row still shows it, for example Fast on while a card waits. */
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

/** Off, the badge is muted. On, the badge and the switch turn amber, and the icon pops once per change. */
export function ModeSwitchRow({
	icon: BadgeIcon,
	title,
	hint,
	unavailableHint,
	checked,
	onCheckedChange,
}: ModeSwitchRowProps) {
	const isReducedMotion = useReducedMotion() === true;
	const switchId = useId();
	const hintId = useId();
	// The popover unmounts the row on close. This state keeps the pop for a change, not for each open.
	const [hasChanged, setHasChanged] = useState(false);
	const isAvailable = unavailableHint === undefined;
	return (
		<div className="mt-3 flex items-center gap-2.5 border-border/60 border-t pt-3">
			<motion.span
				// A new key on each change remounts the badge, so the pop plays once per change.
				key={checked ? "on" : "off"}
				initial={
					isReducedMotion || !checked || !hasChanged ? false : { scale: 0.7 }
				}
				animate={{ scale: 1 }}
				transition={{ type: "spring", stiffness: 520, damping: 18 }}
				aria-hidden
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none",
					checked ? ON_BADGE_CLASS : "bg-muted text-muted-foreground",
					!isAvailable && "opacity-50",
				)}
			>
				<BadgeIcon weight={checked ? "fill" : "bold"} className="size-4" />
			</motion.span>
			<div className="min-w-0 flex-1">
				<label
					htmlFor={switchId}
					className={cn(
						"block font-grotesk font-semibold text-[13px] leading-tight",
						isAvailable ? "cursor-pointer" : "text-muted-foreground",
					)}
				>
					{title}
				</label>
				<p
					id={hintId}
					className="mt-0.5 text-[11px] text-muted-foreground leading-snug"
				>
					{unavailableHint ?? hint}
				</p>
			</div>
			{/* aria-disabled, not disabled: Tab still reaches the switch, so a screen reader reads the hint that says why. */}
			<Switch
				id={switchId}
				checked={checked}
				aria-disabled={!isAvailable}
				onCheckedChange={(isChecked) => {
					if (!isAvailable) return;
					setHasChanged(true);
					onCheckedChange(isChecked);
				}}
				aria-describedby={hintId}
				className={cn(
					"aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
					ON_SWITCH_CLASS,
				)}
			/>
		</div>
	);
}
