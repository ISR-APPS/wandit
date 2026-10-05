/**
 * Project name and kind chip in the top bar. Opens a searchable list of the
 * open project and the other V2 apps of the active workspace, with a link back
 * to the dashboard. Rendered by components/shell/top-bar.tsx. The list reads
 * useProjectsQuery of the projects feature when the popover opens; the open
 * project comes from the page through props.
 */

import type { Icon } from "@phosphor-icons/react";
import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@wandit/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { useProjectsQuery } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { AppProject, AppProjectKind } from "../../api/dto";

// The spark tint of the open project row, like the current page of the route picker.
const OPEN_ROW_CLASS = "bg-spark/[0.14] data-[selected=true]:bg-spark/20";

// The project name of a row. It does not grow, so a Latin name stays on the start side of an Arabic page.
const ROW_NAME_CLASS = "min-w-0 truncate";

// The icon of each kind, in the row medallion of the list.
const KIND_ICONS: Record<AppProjectKind, Icon> = {
	web: GlobeIcon,
	mobile: DeviceMobileIcon,
};

export type ProjectMenuProps = {
	/** The open project, from appProjectQuery in the page. The first row of the list, with the spark tint and a check. */
	project: AppProject;
};

/** The kind chip tells apart two projects with the same name in the trigger. A row shows the kind icon and the last edit. */
export function ProjectMenu({ project }: ProjectMenuProps) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
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
			</PopoverTrigger>
			{/* The sheet never grows past the screen; on a short screen the list shrinks and the dashboard link stays in view. */}
			<PopoverContent
				align="start"
				aria-label={t("appBuilder.topBar.projectMenu")}
				className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col overflow-hidden p-0"
			>
				<ProjectList project={project} onClose={() => setIsOpen(false)} />
			</PopoverContent>
		</Popover>
	);
}

/** Props of the list inside the popover. */
type ProjectListProps = ProjectMenuProps & {
	/** Closes the popover after a pick or a click on the dashboard link. */
	onClose: () => void;
};

/**
 * The search field, the project rows, and the dashboard link. Lives inside
 * the popover content, so the query starts when the popover opens and the
 * search text clears when it closes. The dashboard shares the cache entry.
 */
function ProjectList({ project, onClose }: ProjectListProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const projects = useProjectsQuery();
	const [query, setQuery] = useState("");

	const normalizedQuery = foldDiacritics(query.trim());
	const isMatch = (name: string) =>
		foldDiacritics(name).includes(normalizedQuery);
	// The list holds V1 pages too. A V1 page opens in the V1 workspace, not here.
	// The open project already has the first row.
	const otherProjects = (projects.data ?? []).filter(
		(candidate) =>
			candidate.engine === "v2_app" &&
			candidate.id !== project.id &&
			isMatch(candidate.name),
	);

	return (
		<>
			<Command
				shouldFilter={false}
				label={t("appBuilder.topBar.projectMenu")}
				className="min-h-0"
			>
				<CommandInput
					value={query}
					onValueChange={setQuery}
					placeholder={t("appBuilder.topBar.searchProjects")}
				/>
				{/* The kit cap shows about six rows. The list scrolls, so the dashboard link below stays in view. */}
				<CommandList
					label={t("appBuilder.topBar.projectMenu")}
					className="min-h-0"
				>
					{/* The open project comes from the page, so it shows even when the list is empty or still loads. */}
					{isMatch(project.name) ? (
						<CommandItem
							value={project.id}
							aria-current="page"
							onSelect={onClose}
							className={OPEN_ROW_CLASS}
						>
							<KindMedallion kind={project.kind} isOpen />
							<span className={ROW_NAME_CLASS} dir="auto" title={project.name}>
								{project.name}
							</span>
							<CheckIcon
								aria-hidden
								weight="bold"
								className="ms-auto size-4 shrink-0 text-primary"
							/>
						</CommandItem>
					) : null}
					{projects.isPending ? (
						<>
							<Skeleton className="my-1 h-10 rounded-[14px]" />
							<Skeleton className="my-1 h-10 rounded-[14px]" />
						</>
					) : projects.isError ? (
						<p className="px-2.5 py-2 text-popover-foreground/55 text-sm">
							{t("errors.generic")}
						</p>
					) : (
						otherProjects.map((candidate) => {
							const kind =
								candidate.targetPlatform === "mobile" ? "mobile" : "web";
							return (
								<CommandItem
									key={candidate.id}
									value={candidate.id}
									onSelect={() => {
										onClose();
										void navigate({
											to: "/app/$projectId",
											params: { projectId: candidate.id },
										});
									}}
								>
									<KindMedallion kind={kind} />
									<span
										className={ROW_NAME_CLASS}
										dir="auto"
										title={candidate.name}
									>
										{candidate.name}
									</span>
									<span className="ms-auto shrink-0 font-normal text-popover-foreground/45 text-xs">
										{relativeTime(candidate.updatedAt)}
									</span>
								</CommandItem>
							);
						})
					)}
					{/* cmdk shows it when no row is mounted. The gate hides it while the list loads. */}
					{projects.isSuccess ? (
						<CommandEmpty>{t("appBuilder.topBar.noProjectMatch")}</CommandEmpty>
					) : null}
				</CommandList>
			</Command>
			{/* Outside the Command, so cmdk does not take its Enter key for the selected row. */}
			<div className="shrink-0 border-popover-foreground/[0.08] border-t p-1.5">
				<Link
					to="/dashboard"
					onClick={onClose}
					className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-2 font-grotesk font-medium text-sm outline-hidden transition-colors hover:bg-popover-foreground/[0.05] focus-visible:bg-popover-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<SquaresFourIcon
						aria-hidden
						weight="duotone"
						className="size-[18px] shrink-0 text-popover-foreground/45"
					/>
					{t("appBuilder.topBar.allProjects")}
				</Link>
			</div>
		</>
	);
}

/** Lower case without accents, so "resume" finds "Résumé". A copy of the private helper of onboarding/phone-step.tsx. */
function foldDiacritics(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase();
}

/** The round kind icon at the start of a row. The open project gets the spark ground. */
function KindMedallion({
	kind,
	isOpen = false,
}: {
	kind: AppProjectKind;
	/** True on the row of the open project. */
	isOpen?: boolean;
}) {
	const { t } = useTranslation();
	const KindIcon = KIND_ICONS[kind];
	return (
		<span
			className={cn(
				"grid size-7 shrink-0 place-items-center rounded-full",
				isOpen
					? "bg-spark text-night"
					: "bg-popover-foreground/[0.05] text-popover-foreground/60",
			)}
		>
			{/* text-current opts out of the row rule that dims every icon without a text color. */}
			<KindIcon
				aria-hidden
				weight={isOpen ? "fill" : "duotone"}
				className="size-4 text-current"
			/>
			{/* The rows have no kind chip, so a screen reader reads the kind here. */}
			<span className="sr-only">{t(`appBuilder.kind.${kind}`)}</span>
		</span>
	);
}

/** The soft "Web app" or "Mobile app" chip of the trigger. */
function KindChip({
	kind,
	className,
}: {
	kind: AppProjectKind;
	/** Extra classes: the trigger hides its chip on a phone. */
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
