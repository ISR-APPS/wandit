// Segmented control switching the Assets tab between the Library (grid) and
// Canvas (freeform board) views — visually mirrors WorkspaceTabs' sliding pill.

import { cn } from "@wandit/ui/lib/utils";
import { Frame, LayoutGrid } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { WORKSPACE_COPY } from "../../lib/constants";
import type { AssetsView } from "../../lib/helpers";

const OPTIONS: { value: AssetsView; label: string; icon: typeof LayoutGrid }[] =
	[
		{
			value: "library",
			label: WORKSPACE_COPY.assets.libraryView,
			icon: LayoutGrid,
		},
		{ value: "canvas", label: WORKSPACE_COPY.assets.canvasView, icon: Frame },
	];

export function AssetsViewToggle({
	view,
	onChange,
}: {
	view: AssetsView;
	onChange: (view: AssetsView) => void;
}) {
	const pillId = useId();

	return (
		<fieldset className="m-0 flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
			<legend className="sr-only">
				{WORKSPACE_COPY.assets.viewToggleAriaLabel}
			</legend>
			{OPTIONS.map((option) => {
				const isActive = view === option.value;
				const Icon = option.icon;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={isActive}
						onClick={() => onChange(option.value)}
						className={cn(
							"relative flex h-8 items-center gap-1.5 rounded-md px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
							isActive
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{isActive ? (
							<motion.span
								aria-hidden
								layoutId={`assets-view-pill-${pillId}`}
								transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
								className="absolute inset-0 rounded-md bg-background shadow-xs"
							/>
						) : null}
						<Icon className="relative size-3.5 shrink-0" />
						<span className="relative hidden sm:inline">{option.label}</span>
					</button>
				);
			})}
		</fieldset>
	);
}
