/**
 * The "Plan" chip of a prompt box. On, the agent asks a few questions and
 * shows a plan before it builds (Plan Mode). The builder composer and the
 * dashboard prompt box (features/projects, through the barrel) render it.
 * The caller owns the state. A tooltip explains the mode.
 */

import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";

/** Props of the Plan chip. The caller wraps it in a TooltipProvider. */
export type PlanModeToggleProps = {
	/** True while Plan Mode is on. */
	isPlanMode: boolean;
	onPlanModeChange: (isPlanMode: boolean) => void;
	/** True while the prompt box cannot send, for example during a send. */
	disabled?: boolean;
	/** `md` is 36 px high, for the dashboard hero box. `sm` is 32 px, for the builder composer. */
	size?: "sm" | "md";
};

/**
 * A pressable chip. Off, it is the soft navy chip of the prompt boxes. On,
 * it takes an ember tint and a filled icon (spark in dark mode).
 */
export function PlanModeToggle({
	isPlanMode,
	onPlanModeChange,
	disabled = false,
	size = "sm",
}: PlanModeToggleProps) {
	const { t } = useTranslation();
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={isPlanMode}
					disabled={disabled}
					onClick={() => onPlanModeChange(!isPlanMode)}
					className={cn(
						"gap-1.5 rounded-full font-grotesk font-medium shadow-none transition-colors duration-200",
						// The kit `sm` size pads a button with an svg child through `has-[>svg]`, so the padding uses the same variant.
						size === "md"
							? "h-9 text-[13.5px] has-[>svg]:ps-3 has-[>svg]:pe-3.5"
							: "h-8 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-3",
						isPlanMode
							? "border-ember/30 bg-ember/[0.1] text-ember-text hover:bg-ember/[0.15] hover:text-ember-text dark:border-spark/35 dark:bg-spark/[0.12] dark:text-spark dark:hover:bg-spark/[0.18] dark:hover:text-spark"
							: "border-transparent bg-night/[0.05] text-night/75 hover:bg-night/[0.09] hover:text-night dark:border-transparent dark:bg-white/[0.06] dark:text-foreground/75 dark:hover:bg-white/[0.1] dark:hover:text-foreground",
					)}
				>
					<ListChecksIcon
						weight={isPlanMode ? "fill" : "bold"}
						className="size-4 shrink-0"
						aria-hidden
					/>
					{t("appBuilder.chat.plan.toggle.label")}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-64 text-center">
				{t("appBuilder.chat.plan.toggle.hint")}
			</TooltipContent>
		</Tooltip>
	);
}
