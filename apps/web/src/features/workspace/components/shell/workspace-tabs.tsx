// Segmented control switching the workspace's polymorphic right pane
// (Canvas | Assets | Leads | Settings) — the active pill slides with motion.

import { cn } from "@wandit/ui/lib/utils";
import { motion } from "motion/react";
import { useId } from "react";

import { useTranslation } from "@/lib/i18n";
import { WORKSPACE_TABS } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

export function WorkspaceTabs({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { tab, setTab, project } = useWorkspace();
	const pillId = useId();

	return (
		// The tabs navigate (they drive the ?tab= search param), so nav is the
		// honest semantic wrapper; buttons stay aria-pressed toggles.
		<nav
			aria-label={t("workspace.tabsAriaLabel")}
			className={cn(
				"flex items-center gap-0.5 rounded-full border border-border bg-muted p-[3px]",
				className,
			)}
		>
			{WORKSPACE_TABS.map((def) => {
				const isActive = tab === def.value;
				const label = t(`workspace.tabs.${def.value}`);
				return (
					<button
						key={def.value}
						type="button"
						aria-pressed={isActive}
						onClick={() => setTab(def.value)}
						className={cn(
							// Icon + label pills with a thin 1.7 stroke (dc reference).
							"relative flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
							isActive
								? "font-medium text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{isActive ? (
							<motion.span
								aria-hidden
								layoutId={`workspace-tab-pill-${pillId}`}
								transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
								className="absolute inset-0 rounded-full bg-background shadow-segment"
							/>
						) : null}
						<def.icon
							className="relative size-3.5 shrink-0"
							strokeWidth={1.7}
						/>
						<span className="relative">{label}</span>
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
