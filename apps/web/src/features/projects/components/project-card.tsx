// Dashboard grid card: gradient thumbnail, name, status badge, lead count,
// updated-at, hover actions (open / view live / rename / delete).

import { Link, useNavigate } from "@tanstack/react-router";
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
import { Badge } from "@wandit/ui/components/badge";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	ExternalLink,
	Loader2,
	MoreHorizontal,
	PenLine,
	Trash2,
	Users,
} from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { Project } from "../api/dto";
import { useDeleteProject, useRenameProject } from "../api/projects.mutations";
import { PROJECT_NAME_MAX_LENGTH } from "../lib/constants";
import { thumbGradient } from "../lib/helpers";

function StatusBadge({ status }: { status: Project["status"] }) {
	const { t } = useTranslation();
	if (status === "published") {
		return (
			<Badge variant="success" className="font-mono text-[10px]">
				<span
					aria-hidden
					className="size-1.5 shrink-0 rounded-full bg-current"
				/>
				{t("projects.statusPublished")}
			</Badge>
		);
	}
	if (status === "publishing") {
		return (
			<Badge className="animate-pulse font-mono text-[10px]">
				{t("projects.statusPublishing")}
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="font-mono text-[10px]">
			{t("projects.statusDraft")}
		</Badge>
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
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{t("projects.renameSave")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function ProjectCard({ project }: { project: Project }) {
	const { t, dir } = useTranslation();
	const navigate = useNavigate();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const deleteProject = useDeleteProject();

	const isPublished = project.status === "published";
	const glyph = project.name.trim().charAt(0).toUpperCase() || "✦";

	const handleDelete = () => {
		deleteProject.mutate(project.id, {
			onSuccess: () => toast.success(t("projects.deleteSuccess")),
		});
	};

	return (
		<div className="group relative">
			<Link
				to="/p/$projectId"
				params={{ projectId: project.id }}
				className={cn(
					"block overflow-hidden rounded-xl border bg-card transition-all duration-150",
					"hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				)}
			>
				<div
					aria-hidden
					className="relative aspect-video"
					style={{ background: thumbGradient(project.thumbnailSeed) }}
				>
					<div className="pointer-events-none absolute inset-0 bg-grain" />
					<span className="absolute end-4 bottom-0 select-none font-bold font-display text-8xl text-white/15 leading-none">
						{glyph}
					</span>
					<div className="absolute start-2 top-2">
						<StatusBadge status={project.status} />
					</div>
				</div>
				<div className="p-3.5">
					<h3 className="truncate font-display font-semibold text-sm">
						{project.name}
					</h3>
					<div className="mt-1.5 flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
						<Users aria-hidden className="size-3 shrink-0" />
						<span>{t("projects.leadCount", { count: project.leadCount })}</span>
						<span aria-hidden className="text-muted-foreground/50">
							·
						</span>
						<span>{relativeTime(project.updatedAt)}</span>
					</div>
					{isPublished && project.publishedSlug ? (
						<div className="mt-1.5 truncate font-mono text-primary text-xs">
							{project.publishedSlug}
							{t("projects.publishedDomain")}
						</div>
					) : null}
				</div>
			</Link>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="secondary"
						size="icon-sm"
						aria-label={t("projects.cardMenuLabel")}
						onClick={(e) => e.stopPropagation()}
						className="absolute end-2 top-2 size-7 opacity-0 shadow-sm transition-opacity duration-150 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
					>
						<MoreHorizontal className="size-4" />
					</Button>
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
						<ExternalLink />
						{t("projects.menuOpen")}
					</DropdownMenuItem>
					{isPublished ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<div>
									<DropdownMenuItem disabled>
										<ExternalLink />
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
						<PenLine />
						{t("projects.menuRename")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setDeleteOpen(true)}
					>
						<Trash2 />
						{t("projects.menuDelete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

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
