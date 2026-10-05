/**
 * The project card of the dashboard grid, drawn like an app on a phone home
 * screen. The stage shows the preview in a phone or browser frame, or an app
 * tile with the first letter of the name. dashboard-page.tsx renders the card
 * and ProjectCardSkeleton. The card menu opens, renames, or deletes a project.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { BrowserIcon } from "@phosphor-icons/react/Browser";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { DotsThreeIcon } from "@phosphor-icons/react/DotsThree";
import { GlobeSimpleIcon } from "@phosphor-icons/react/GlobeSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/PencilSimple";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { Link, useNavigate } from "@tanstack/react-router";
import type { TargetPlatform } from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { Project } from "../api/dto";
import { useDeleteProject, useRenameProject } from "../api/projects.mutations";
import { PROJECT_NAME_MAX_LENGTH } from "../lib/constants";
import {
	projectTileGlyph,
	projectTileLook,
	shouldShowProjectPreview,
} from "../lib/helpers";

const STATUS_PILL_CLASS =
	"inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-grotesk font-semibold text-[11px]";

/** The status pill at the top-start corner of the stage. */
function StatusPill({ status }: { status: Project["status"] }) {
	const { t } = useTranslation();
	if (status === "published") {
		return (
			<span
				className={cn(
					STATUS_PILL_CLASS,
					"bg-night text-paper dark:ring-1 dark:ring-white/15",
				)}
			>
				<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-spark" />
				{t("projects.statusPublished")}
			</span>
		);
	}
	if (status === "publishing") {
		return (
			<span
				className={cn(
					STATUS_PILL_CLASS,
					"animate-pulse bg-spark text-night motion-reduce:animate-none",
				)}
			>
				{t("projects.statusPublishing")}
			</span>
		);
	}
	return (
		<span
			className={cn(
				STATUS_PILL_CLASS,
				"bg-white/85 text-night/70 ring-1 ring-night/10 backdrop-blur",
				"dark:bg-card/85 dark:text-foreground/70 dark:ring-white/10",
			)}
		>
			{t("projects.statusDraft")}
		</span>
	);
}

// The meta row shows a phone for a mobile app and a browser for a web app.
const PLATFORM_ICONS = {
	web: BrowserIcon,
	mobile: DeviceMobileIcon,
} as const satisfies Record<TargetPlatform, Icon>;

/**
 * The platform of a V2 project in the card meta row: an icon, then "Web app"
 * or "Mobile app". A V1 page project has no platform, so it shows nothing.
 */
export function PlatformBadge({
	platform,
}: {
	/** `Project.targetPlatform` from the list answer; null on a V1 page project. */
	platform: Project["targetPlatform"];
}) {
	const { t } = useTranslation();
	if (platform === null) {
		return null;
	}
	const PlatformIcon = PLATFORM_ICONS[platform];
	return (
		<span className="inline-flex min-w-0 items-center gap-1">
			<PlatformIcon aria-hidden weight="duotone" className="size-4 shrink-0" />
			<span className="truncate">
				{t(`projects.promptBox.platforms.${platform}.label`)}
			</span>
		</span>
	);
}

function RenameDialog({
	project,
	open,
	onOpenChange,
}: {
	project: Project;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const [name, setName] = useState(project.name);
	const rename = useRenameProject();

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || rename.isPending) return;
		rename.mutate(
			{ id: project.id, name: trimmed },
			{
				onSuccess: () => {
					toast.success(t("projects.renameSuccess"));
					onOpenChange(false);
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm" closeLabel={t("common.close")}>
				<DialogHeader>
					<DialogTitle className="font-display">
						{t("projects.renameTitle")}
					</DialogTitle>
					<DialogDescription>
						{t("projects.renameDescription")}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`rename-${project.id}`}>
							{t("projects.renameLabel")}
						</Label>
						<Input
							id={`rename-${project.id}`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={PROJECT_NAME_MAX_LENGTH}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							{t("projects.renameCancel")}
						</Button>
						<Button type="submit" disabled={!name.trim() || rename.isPending}>
							{rename.isPending ? (
								<CircleNotchIcon
									aria-hidden
									weight="bold"
									className="size-4 animate-spin"
								/>
							) : null}
							{t("projects.renameSave")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** The loading shape of a ProjectCard. The dashboard grid shows it while the project list loads. */
export function ProjectCardSkeleton() {
	return (
		<div className="rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08] dark:bg-card dark:ring-white/10">
			<Skeleton className="aspect-[16/10] rounded-[1.375rem]" />
			<div className="space-y-2.5 px-3 pt-3 pb-2.5">
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-3 w-1/2" />
			</div>
		</div>
	);
}

/** One project in the dashboard grid. A click opens the workspace at /p/$projectId. */
export function ProjectCard({ project }: { project: Project }) {
	const { t, dir } = useTranslation();
	const navigate = useNavigate();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [failedPreviewImageUrl, setFailedPreviewImageUrl] = useState<
		string | null
	>(null);
	const deleteProject = useDeleteProject();

	const isPublished = project.status === "published";
	const glyph = projectTileGlyph(project.name);
	const look = projectTileLook(project.thumbnailSeed);
	const showPreview = shouldShowProjectPreview(
		project.previewImageUrl,
		failedPreviewImageUrl,
	);

	const handleDelete = () => {
		deleteProject.mutate(project.id, {
			onSuccess: () => toast.success(t("projects.deleteSuccess")),
		});
	};

	const previewImage = (
		<img
			key={project.previewImageUrl}
			src={project.previewImageUrl ?? undefined}
			alt=""
			loading="lazy"
			decoding="async"
			onError={() => setFailedPreviewImageUrl(project.previewImageUrl)}
			className="block size-full object-cover object-top"
		/>
	);

	return (
		// The outer div keeps still, so the cursor stays on it while the inner card lifts.
		<div className="group relative">
			{/* h-full: every card in a grid row ends at the same line, also when one has a slug line. */}
			<div className="relative h-full transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-within:-translate-y-1">
				<Link
					to="/p/$projectId"
					params={{ projectId: project.id }}
					className={cn(
						"block h-full rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08]",
						// A solid bottom edge, like a key. It grows when the card lifts.
						"shadow-[0_2px_0_rgb(11_16_51/0.06)] transition-shadow duration-200 group-focus-within:shadow-[0_6px_0_rgb(11_16_51/0.12)] group-hover:shadow-[0_6px_0_rgb(11_16_51/0.12)]",
						"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
						"dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10 dark:group-hover:shadow-[0_6px_0_rgb(0_0_0/0.5)] dark:group-focus-within:shadow-[0_6px_0_rgb(0_0_0/0.5)]",
					)}
				>
					<div
						className="relative aspect-[16/10] overflow-hidden rounded-[1.375rem] [--stage-dot:rgb(11_16_51/0.07)] dark:[--stage-dot:rgb(255_255_255/0.06)]"
						style={{
							// A faint dot grid over a soft tint of the tile colors.
							backgroundImage: `radial-gradient(circle, var(--stage-dot) 1px, transparent 1.5px), linear-gradient(160deg, color-mix(in oklab, ${look.to} 28%, var(--card)), color-mix(in oklab, ${look.from} 14%, var(--card)))`,
							backgroundSize: "14px 14px, auto",
						}}
					>
						{showPreview && project.targetPlatform === "mobile" ? (
							<div
								aria-hidden
								className="absolute inset-x-0 top-[12%] mx-auto aspect-[9/19] w-[36%] overflow-hidden rounded-[1.25rem] border-[5px] border-night bg-night shadow-[0_18px_30px_-12px_rgb(11_16_51/0.5)] transition-transform duration-300 motion-safe:group-hover:-translate-y-1 dark:ring-1 dark:ring-white/10"
							>
								<span className="absolute inset-x-0 top-1 z-10 mx-auto h-1.5 w-1/3 rounded-full bg-night" />
								{previewImage}
							</div>
						) : showPreview ? (
							// A web app or a V1 page: the preview sits in a browser window.
							<div
								aria-hidden
								className="absolute inset-x-[8%] top-[20%] -bottom-3 overflow-hidden rounded-t-xl bg-white shadow-[0_14px_30px_-12px_rgb(11_16_51/0.35)] ring-1 ring-night/10 transition-transform duration-300 motion-safe:group-hover:-translate-y-1 dark:bg-card dark:ring-white/10"
							>
								<div className="flex h-5 items-center gap-1 ps-2.5 *:size-1.5 *:rounded-full *:bg-night/15 dark:*:bg-white/20">
									<span />
									<span />
									<span />
								</div>
								{previewImage}
							</div>
						) : (
							<span
								aria-hidden
								className="absolute inset-0 m-auto grid size-16 select-none place-items-center rounded-[28%] font-extrabold font-grotesk text-[1.75rem] leading-none transition-transform duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-6"
								style={{
									color: look.ink,
									// The glossy tile of the landing ideas wall: a white shine over the two-stop gradient.
									backgroundImage: `radial-gradient(120% 90% at 22% 8%, rgb(255 255 255 / 0.32), transparent 52%), linear-gradient(155deg, ${look.from}, ${look.to})`,
									// The hairline ring keeps the light tiles visible on a light stage.
									boxShadow: `inset 0 0 0 1px rgb(11 16 51 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -3px 8px rgb(0 0 0 / 0.1), 0 12px 22px -12px color-mix(in oklab, ${look.to} 70%, transparent)`,
								}}
							>
								{glyph}
							</span>
						)}
						<div className="absolute start-3 top-3">
							<StatusPill status={project.status} />
						</div>
					</div>
					<div className="px-3 pt-3 pb-2.5">
						<h3 className="truncate font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
							{project.name}
						</h3>
						<div className="mt-1 flex items-center gap-3 text-[13px] text-night/55 dark:text-foreground/55">
							<PlatformBadge platform={project.targetPlatform} />
							<span className="inline-flex min-w-0 items-center gap-1">
								<UsersThreeIcon
									aria-hidden
									weight="duotone"
									className="size-4 shrink-0"
								/>
								<span className="truncate">
									{t("projects.leadCount", { count: project.leadCount })}
								</span>
							</span>
							<span className="ms-auto shrink-0 tabular-nums">
								{relativeTime(project.updatedAt)}
							</span>
						</div>
						{isPublished && project.publishedSlug ? (
							<div className="mt-1.5 inline-flex max-w-full items-center gap-1 font-medium text-[13px] text-ember-text">
								<GlobeSimpleIcon
									aria-hidden
									weight="duotone"
									className="size-3.5 shrink-0"
								/>
								{/* A domain reads left to right, also on an Arabic page. */}
								<span dir="ltr" className="truncate">
									{project.publishedSlug}
									{t("projects.publishedDomain")}
								</span>
							</div>
						) : null}
					</div>
				</Link>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label={t("projects.cardMenuLabel")}
							onClick={(e) => e.stopPropagation()}
							className={cn(
								"absolute end-3.5 top-3.5 grid size-8 place-items-center rounded-full bg-white/90 text-night shadow-sm ring-1 ring-night/10 backdrop-blur transition-[opacity,background-color] duration-150 hover:bg-white",
								// Hidden until the card is hovered or focused. A touch screen has no hover, so it always shows there.
								"opacity-0 pointer-coarse:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
								"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
								"dark:bg-card/90 dark:text-foreground dark:ring-white/10 dark:hover:bg-card",
							)}
						>
							<DotsThreeIcon aria-hidden weight="bold" className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuItem
							onSelect={() =>
								navigate({
									to: "/p/$projectId",
									params: { projectId: project.id },
								})
							}
						>
							<ArrowSquareOutIcon aria-hidden weight="duotone" />
							{t("projects.menuOpen")}
						</DropdownMenuItem>
						{isPublished ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<div>
										<DropdownMenuItem disabled>
											<GlobeSimpleIcon aria-hidden weight="duotone" />
											{t("projects.menuViewLive")}
										</DropdownMenuItem>
									</div>
								</TooltipTrigger>
								<TooltipContent side={dir === "rtl" ? "left" : "right"}>
									{t("projects.menuViewLiveMock")}
								</TooltipContent>
							</Tooltip>
						) : null}
						<DropdownMenuItem onSelect={() => setRenameOpen(true)}>
							<PencilSimpleIcon aria-hidden weight="duotone" />
							{t("projects.menuRename")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setDeleteOpen(true)}
						>
							<TrashIcon aria-hidden weight="duotone" />
							{t("projects.menuDelete")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{renameOpen ? (
				<RenameDialog
					project={project}
					open={renameOpen}
					onOpenChange={setRenameOpen}
				/>
			) : null}

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{t("projects.deleteTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("projects.deleteDescription", { name: project.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("projects.deleteCancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{t("projects.deleteConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
