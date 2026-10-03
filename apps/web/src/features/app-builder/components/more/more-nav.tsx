/**
 * Section nav of the More view: one item per panel the project kind has,
 * with the Backend group of the seven Cloud panels under Analytics.
 * Rendered by components/more/more-view.tsx, which owns the open panel and
 * the URL change. Reads MORE_PANEL_META, CLOUD_PANELS, and panelsForKind.
 */

import { Badge } from "@wandit/ui/components/badge";
import { cn } from "@wandit/ui/lib/utils";
import { type LucideIcon, Server } from "lucide-react";
import { Fragment, useId } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProjectKind } from "../../api/dto";
import {
	CLOUD_PANEL_ICONS,
	CLOUD_PANELS,
	MORE_PANEL_META,
	type ProjectPanel,
} from "../../lib/constants";
import { isDisabledMorePanel, panelsForKind } from "../../lib/helpers";

/** Props of MoreNav. More view passes the resolved open panel and the Cloud gate. */
export type MoreNavProps = {
	/** Web apps list Domains, mobile apps list App stores. */
	kind: AppProjectKind;
	/** The open panel. Its item gets the tint and aria-current. */
	active: ProjectPanel;
	/** True when the Backend group shows. The page reads it from useCloudTabEnabled. */
	showBackendGroup: boolean;
	onSelect: (panel: ProjectPanel) => void;
};

/** The More panels in nav order. A disabled panel is a muted "Soon" row that selects nothing. */
export function MoreNav({
	kind,
	active,
	showBackendGroup,
	onSelect,
}: MoreNavProps) {
	const { t } = useTranslation();
	const backendHeadingId = useId();

	return (
		<nav
			aria-label={t("appBuilder.moreNavAriaLabel")}
			className="flex gap-0.5 md:flex-col"
		>
			{panelsForKind(kind).map((panel) => {
				const meta = MORE_PANEL_META[panel];
				return (
					<Fragment key={panel}>
						{isDisabledMorePanel(panel) ? (
							<button
								type="button"
								disabled
								className="flex h-9 shrink-0 cursor-not-allowed items-center gap-2.5 rounded-xl px-3 text-muted-foreground text-sm opacity-60 md:w-full"
							>
								<meta.icon className="size-4 shrink-0" strokeWidth={1.7} />
								<span className="truncate">{t(meta.title)}</span>
								<Badge variant="outline" className="ms-auto">
									{t("appBuilder.soon")}
								</Badge>
							</button>
						) : (
							<NavItem
								icon={meta.icon}
								label={t(meta.title)}
								isActive={panel === active}
								onClick={() => onSelect(panel)}
							/>
						)}
						{/* The Backend group follows Analytics: the backend is the main content of a project. */}
						{panel === "analytics" && showBackendGroup ? (
							// A fieldset gives the group role and its name from the heading. Biome rejects role="group" on a div.
							<fieldset
								aria-labelledby={backendHeadingId}
								className="flex gap-0.5 md:flex-col"
							>
								{/* On phones the nav is one strip: the heading hides and the Cloud items join the strip. */}
								<p
									id={backendHeadingId}
									className="hidden h-9 items-center gap-2.5 px-3 text-muted-foreground text-sm md:flex"
								>
									<Server className="size-4 shrink-0" strokeWidth={1.7} />
									<span className="truncate">
										{t("appBuilder.panels.backend.title")}
									</span>
								</p>
								{/* The start border sits under the center of the heading icon: 12 px padding plus half of 16 px. */}
								<div className="flex gap-0.5 md:ms-5 md:flex-col md:border-s md:ps-2">
									{CLOUD_PANELS.map((cloudPanel) => (
										<NavItem
											key={cloudPanel}
											icon={CLOUD_PANEL_ICONS[cloudPanel]}
											label={t(`workspace.cloud.panels.${cloudPanel}`)}
											isActive={cloudPanel === active}
											onClick={() => onSelect(cloudPanel)}
										/>
									))}
								</div>
							</fieldset>
						) : null}
					</Fragment>
				);
			})}
		</nav>
	);
}

/** One clickable row of the nav. The open panel gets the ember tint. */
function NavItem({
	icon: Icon,
	label,
	isActive,
	onClick,
}: {
	icon: LucideIcon;
	/** Translated panel name. Also the accessible name of the button. */
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-current={isActive ? "page" : undefined}
			onClick={onClick}
			className={cn(
				"flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full",
				isActive
					? "bg-primary/10 font-medium text-ember-strong"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			<Icon className="size-4 shrink-0" strokeWidth={1.7} />
			<span className="truncate">{label}</span>
		</button>
	);
}
