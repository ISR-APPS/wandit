/**
 * Project name and kind chip in the top bar. Opens a menu that lists the
 * open project, the other projects of the user, and a link back to the
 * dashboard. Rendered by components/shell/top-bar.tsx. The list reads
 * appProjectsQuery when the menu opens; the open project comes from the page through props.
 */

import type { Icon } from "@phosphor-icons/react";
import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { appProjectsQuery } from "../../api/app-builder.queries";
import type { AppProject, AppProjectKind } from "../../api/dto";

// The spark tint of the picked row, like ACTIVE_ROW_CLASS of the workspace switcher.
const OPEN_ROW_CLASS = "bg-spark/[0.14] focus:bg-spark/20";

// The project name of a row. It does not grow, so a Latin name stays on the start side of an Arabic page.
const ROW_NAME_CLASS = "min-w-0 truncate";

// The icon of each kind, in the row medallion of the menu.
const KIND_ICONS: Record<AppProjectKind, Icon> = {
	web: GlobeIcon,
	mobile: DeviceMobileIcon,
};

export type ProjectMenuProps = {
	/** The open project, from appProjectQuery in the page. The first row of the menu, with the spark tint and a check. */
	project: AppProject;
};

/** Two mock projects share one name; the kind chip tells them apart in the trigger and the list. */
export function ProjectMenu({ project }: ProjectMenuProps) {
	const { t } = useTranslation();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					// `shrink` beats the kit's shrink-0, so a long name truncates. The cap keeps room for the work controls.
					className="h-9 min-w-0 max-w-72 shrink gap-2 rounded-full px-3 text-night hover:bg-night/[0.05] hover:text-night aria-expanded:bg-night/[0.07] dark:text-foreground dark:aria-expanded:bg-white/[0.08] dark:hover:bg-white/[0.06] dark:hover:text-foreground"
					aria-label={t("appBuilder.topBar.projectMenu")}
				>
					<span
						className="truncate font-grotesk font-semibold text-[15px]"
						dir="auto"
					>
						{project.name}
					</span>
					<KindChip kind={project.kind} className="hidden sm:inline-flex" />
					<CaretUpDownIcon
						aria-hidden
						weight="bold"
						className="hidden size-3.5 text-night/45 sm:block dark:text-foreground/45"
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				<DropdownMenuLabel>
					{t("appBuilder.topBar.projectMenu")}
				</DropdownMenuLabel>
				{/* The open project comes from the page, so it shows even when the list is empty or still loads. */}
				<DropdownMenuItem className={OPEN_ROW_CLASS}>
					<KindMedallion kind={project.kind} isOpen />
					<span className={ROW_NAME_CLASS} dir="auto">
						{project.name}
					</span>
					<KindChip kind={project.kind} className="ms-auto" />
					<CheckIcon
						aria-hidden
						weight="bold"
						className="size-4 shrink-0 text-primary"
					/>
				</DropdownMenuItem>
				<OtherProjects currentId={project.id} />
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/dashboard">
						<SquaresFourIcon aria-hidden weight="duotone" />
						{t("appBuilder.topBar.allProjects")}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * One menu item per other project. Lives inside the menu content, so the
 * query starts when the menu opens and not on every page paint.
 */
function OtherProjects({ currentId }: { currentId: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const projects = useQuery(appProjectsQuery());

	if (projects.isPending) {
		return (
			<>
				<Skeleton className="mx-1 my-1 h-10 rounded-[14px]" />
				<Skeleton className="mx-1 my-1 h-10 rounded-[14px]" />
			</>
		);
	}
	if (projects.isError) {
		return (
			<p className="px-2.5 py-2 text-popover-foreground/55 text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	// The open project already has the first row.
	return projects.data
		.filter((candidate) => candidate.id !== currentId)
		.map((candidate) => (
			<DropdownMenuItem
				key={candidate.id}
				onSelect={() =>
					void navigate({
						to: "/app/$projectId",
						params: { projectId: candidate.id },
					})
				}
			>
				<KindMedallion kind={candidate.kind} />
				<span className={ROW_NAME_CLASS} dir="auto">
					{candidate.name}
				</span>
				<KindChip kind={candidate.kind} className="ms-auto" />
			</DropdownMenuItem>
		));
}

/** The round kind icon at the start of a menu row. The open project gets the spark ground. */
function KindMedallion({
	kind,
	isOpen = false,
}: {
	kind: AppProjectKind;
	/** True on the row of the open project. */
	isOpen?: boolean;
}) {
	const KindIcon = KIND_ICONS[kind];
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-full",
				isOpen
					? "bg-spark text-night"
					: "bg-popover-foreground/[0.05] text-popover-foreground/60",
			)}
		>
			{/* text-current opts out of the menu rule that dims every icon without a text color. */}
			<KindIcon
				weight={isOpen ? "fill" : "duotone"}
				className="size-[18px] text-current"
			/>
		</span>
	);
}

/** The soft "Web app" or "Mobile app" chip, in the trigger and in every menu row. */
function KindChip({
	kind,
	className,
}: {
	kind: AppProjectKind;
	/** Extra classes: `ms-auto` pushes the chip of a row to the end; the trigger hides its chip on a phone. */
	className?: string;
}) {
	const { t } = useTranslation();
	return (
		<span
			className={cn(
				"inline-flex h-5 shrink-0 items-center rounded-full bg-night/[0.05] px-2 font-grotesk font-medium text-[11px] text-night/60 dark:bg-white/[0.07] dark:text-foreground/60",
				className,
			)}
		>
			{t(`appBuilder.kind.${kind}`)}
		</span>
	);
}
