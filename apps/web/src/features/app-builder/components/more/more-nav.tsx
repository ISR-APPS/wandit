/**
 * Section nav of the More view: one button per panel the project kind has.
 * Rendered by components/more/more-view.tsx, which owns the active panel
 * and the URL change. Reads MORE_PANEL_META and panelsForKind.
 */

import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import type { AppProjectKind } from "../../api/dto";
import { MORE_PANEL_META, type MorePanel } from "../../lib/constants";
import { panelsForKind } from "../../lib/helpers";

export type MoreNavProps = {
	/** Web apps list Domains, mobile apps list App stores. */
	kind: AppProjectKind;
	active: MorePanel;
	onSelect: (panel: MorePanel) => void;
};

export function MoreNav({ kind, active, onSelect }: MoreNavProps) {
	const { t } = useTranslation();

	return (
		<nav
			aria-label={t("appBuilder.moreNavAriaLabel")}
			className="flex gap-0.5 md:flex-col"
		>
			{panelsForKind(kind).map((panel) => {
				const Icon = MORE_PANEL_META[panel].icon;
				const isActive = panel === active;
				return (
					<button
						key={panel}
						type="button"
						aria-current={isActive ? "page" : undefined}
						onClick={() => onSelect(panel)}
						className={cn(
							"flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full",
							isActive
								? "bg-primary/10 font-medium text-ember-strong"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="size-4 shrink-0" strokeWidth={1.7} />
						<span className="truncate">{t(MORE_PANEL_META[panel].title)}</span>
					</button>
				);
			})}
		</nav>
	);
}
