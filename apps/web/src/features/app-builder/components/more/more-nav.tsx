/**
 * Section nav of the More view: Analytics, then the Backend group of the
 * seven Cloud panels, then the App group of the other panels of the kind.
 * The rows copy the pill look of the dashboard sidebar.
 * Rendered by components/more/more-view.tsx, which owns the open panel and
 * the URL change. Reads MORE_PANEL_META, CLOUD_PANELS, and panelsForKind.
 */

import type { Icon } from "@phosphor-icons/react";
import { cn } from "@wandit/ui/lib/utils";
import { type ReactNode, useId } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProjectKind } from "../../api/dto";
import {
	CLOUD_PANEL_ICONS,
	CLOUD_PANELS,
	MORE_PANEL_META,
	type ProjectPanel,
} from "../../lib/constants";
import { isDisabledMorePanel, panelsForKind } from "../../lib/helpers";
import { PanelChip } from "./panel-shell";

/** Props of MoreNav. More view passes the resolved open panel and the Cloud gate. */
export type MoreNavProps = {
	/** Web apps list Domains, mobile apps list App stores. */
	kind: AppProjectKind;
	/** The open panel. Its row is the night pill and gets aria-current. */
	active: ProjectPanel;
	/** True when the Backend group shows. The page reads it from useCloudTabEnabled. */
	showBackendGroup: boolean;
	onSelect: (panel: ProjectPanel) => void;
};

// A copy of NAV_BUTTON_CLASS of the dashboard sidebar
// (projects/components/shell/app-sidebar.tsx). The rows are 36 px high, not
// 40 px, so 15 rows and 2 headings fit an 800 px window.
const NAV_ROW_CLASS = cn(
	"flex h-9 w-full shrink-0 items-center gap-2.5 rounded-full ps-1 pe-3 font-grotesk font-medium text-[14px] text-night/75 outline-none transition-colors duration-150",
	"hover:bg-night/[0.06] hover:text-night focus-visible:ring-2 focus-visible:ring-ring/50",
	"aria-[current=page]:bg-night aria-[current=page]:text-paper",
	"dark:text-foreground/75 dark:hover:bg-white/[0.06] dark:hover:text-foreground",
	"dark:aria-[current=page]:bg-spark dark:aria-[current=page]:text-night",
	// On phones the nav is one strip of pills, each as wide as its label.
	"max-md:w-auto",
);

/** The More panels in nav order. A disabled panel is a muted "Soon" row that selects nothing. */
export function MoreNav({
	kind,
	active,
	showBackendGroup,
	onSelect,
}: MoreNavProps) {
	const { t } = useTranslation();
	const backendHeadingId = useId();
	const appHeadingId = useId();
	// Analytics is listed for every kind. It stays alone at the top, as the overview of the app.
	const appPanels = panelsForKind(kind).filter(
		(panel) => panel !== "analytics",
	);

	function moreRow(panel: (typeof appPanels)[number]): ReactNode {
		const meta = MORE_PANEL_META[panel];
		if (isDisabledMorePanel(panel)) {
			return (
				<button
					key={panel}
					type="button"
					disabled
					className={cn(
						NAV_ROW_CLASS,
						"cursor-not-allowed opacity-55 hover:bg-transparent hover:text-night/75 dark:hover:bg-transparent dark:hover:text-foreground/75",
					)}
				>
					<NavIcon icon={meta.icon} isActive={false} />
					<span className="truncate">{t(meta.title)}</span>
					<PanelChip className="ms-auto h-5 px-2 text-[11px]">
						{t("appBuilder.soon")}
					</PanelChip>
				</button>
			);
		}
		return (
			<NavRow
				key={panel}
				icon={meta.icon}
				label={t(meta.title)}
				isActive={panel === active}
				onClick={() => onSelect(panel)}
			/>
		);
	}

	return (
		<nav
			aria-label={t("appBuilder.moreNavAriaLabel")}
			className="flex gap-1 md:flex-col md:gap-0.5"
		>
			<NavRow
				icon={MORE_PANEL_META.analytics.icon}
				label={t(MORE_PANEL_META.analytics.title)}
				isActive={active === "analytics"}
				onClick={() => onSelect("analytics")}
			/>
			{/* The Backend group follows Analytics: the backend is the main content of a project. */}
			{showBackendGroup ? (
				<NavGroup
					headingId={backendHeadingId}
					heading={t("appBuilder.panels.backend.title")}
				>
					{CLOUD_PANELS.map((cloudPanel) => (
						<NavRow
							key={cloudPanel}
							icon={CLOUD_PANEL_ICONS[cloudPanel]}
							label={t(`workspace.cloud.panels.${cloudPanel}`)}
							isActive={cloudPanel === active}
							onClick={() => onSelect(cloudPanel)}
						/>
					))}
				</NavGroup>
			) : null}
			{/* The App heading ends the Backend group, so Sign-in does not read as a backend item. */}
			<NavGroup
				headingId={appHeadingId}
				heading={t("appBuilder.panels.app.title")}
			>
				{appPanels.map(moreRow)}
			</NavGroup>
		</nav>
	);
}

/** A labelled group of rows. A fieldset gives the group role and its name; Biome rejects role="group" on a div. */
function NavGroup({
	headingId,
	heading,
	children,
}: {
	/** Id of the heading, from useId. The fieldset reads its name from it. */
	headingId: string;
	/** Translated group name, for example "Backend". */
	heading: string;
	children: ReactNode;
}) {
	return (
		<fieldset
			aria-labelledby={headingId}
			className="flex shrink-0 gap-1 md:flex-col md:gap-0.5"
		>
			{/* On phones the nav is one strip: the heading hides and the rows join the strip. */}
			<p
				id={headingId}
				className="hidden px-3 pt-4 pb-1 font-grotesk font-medium text-[12px] text-night/45 md:block dark:text-foreground/45"
			>
				{heading}
			</p>
			{children}
		</fieldset>
	);
}

/** One clickable row of the nav. The open panel is the night pill. */
function NavRow({
	icon,
	label,
	isActive,
	onClick,
}: {
	icon: Icon;
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
			className={NAV_ROW_CLASS}
		>
			<NavIcon icon={icon} isActive={isActive} />
			<span className="truncate">{label}</span>
		</button>
	);
}

/** The icon in its circle. On the open row the circle is spark (night in dark mode) and the icon is filled. */
function NavIcon({
	icon: RowIcon,
	isActive,
}: {
	icon: Icon;
	isActive: boolean;
}) {
	return (
		<span
			className={cn(
				"grid size-7 shrink-0 place-items-center rounded-full transition-colors",
				isActive && "bg-spark text-night dark:bg-night dark:text-spark",
			)}
		>
			<RowIcon
				aria-hidden
				weight={isActive ? "fill" : "duotone"}
				className="size-[18px]"
			/>
		</span>
	);
}
