import { InfoIcon } from "lucide-react";
import type { ReactElement } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type MetricInfoTooltipProps = {
	label: string;
	content: string;
	trigger?: ReactElement;
};

function MetricInfoTooltip({
	label,
	content,
	trigger,
}: MetricInfoTooltipProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{trigger ?? (
					<button
						type="button"
						aria-label={`About ${label}`}
						className="inline-flex size-3 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<InfoIcon aria-hidden="true" className="size-3" />
					</button>
				)}
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6} className="max-w-[280px]">
				{content}
			</TooltipContent>
		</Tooltip>
	);
}

export type { MetricInfoTooltipProps };
export { MetricInfoTooltip };
