// Segmented control switching the workspace's polymorphic right pane
// (Canvas | Assets | Leads | Settings) — the active pill slides with motion.

import { cn } from "@wandit/ui/lib/utils";
import { motion } from "motion/react";
import { useId } from "react";

import { WORKSPACE_COPY, WORKSPACE_TABS } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

export function WorkspaceTabs({ className }: { className?: string }) {
	const { tab, setTab, project } = useWorkspace();
	const pillId = useId();

	return (
		// The tabs navigate (they drive the ?tab= search param), so nav is the
		// honest semantic wrapper; buttons stay aria-pressed toggles.
		<nav
			aria-label={WORKSPACE_COPY.tabsAriaLabel}
			className={cn(
				"flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5",
				className,
			)}
		>
			{WORKSPACE_TABS.map((def) => {
				const isActive = tab === def.value;
				const Icon = def.icon;
				return (
					<button
						key={def.value}
						type="button"
						aria-pressed={isActive}
						aria-label={def.label}
						onClick={() => setTab(def.value)}
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
								layoutId={`workspace-tab-pill-${pillId}`}
								transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
								className="absolute inset-0 rounded-md bg-background shadow-xs"
							/>
						) : null}
						<Icon className="relative size-3.5 shrink-0" />
						<span className="relative hidden sm:inline">{def.label}</span>
						{def.value === "leads" && project?.leadCount ? (
							<span className="relative rounded-full bg-primary/10 px-1.5 py-px font-mono text-[10px] text-primary tabular-nums">
								{project.leadCount}
							</span>
						) : null}
					</button>
				);
			})}
		</nav>
	);
}
