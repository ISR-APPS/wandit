// Dashboard grid card: gradient thumbnail, name, status badge, lead count,
// updated-at, hover actions (open / view live / rename / delete).

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@my-better-t-app/ui/components/alert-dialog";
import { Badge } from "@my-better-t-app/ui/components/badge";
import { Button } from "@my-better-t-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@my-better-t-app/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@my-better-t-app/ui/components/dropdown-menu";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@my-better-t-app/ui/components/tooltip";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
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

import { relativeTime } from "@/lib/relative-time";
import type { Project } from "../api/dto";
import { useDeleteProject, useRenameProject } from "../api/projects.mutations";
import { PROJECT_NAME_MAX_LENGTH, PROJECTS_COPY } from "../lib/constants";
import { thumbGradient } from "../lib/helpers";

function StatusBadge({ status }: { status: Project["status"] }) {
	if (status === "published") {
		return (
			<Badge variant="success" className="font-mono text-[10px]">
				<span
					aria-hidden
					className="size-1.5 shrink-0 rounded-full bg-current"
				/>
				{PROJECTS_COPY.statusPublished}
			</Badge>
		);
	}
	if (status === "publishing") {
		return (
			<Badge className="animate-pulse font-mono text-[10px]">
				{PROJECTS_COPY.statusPublishing}
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="font-mono text-[10px]">
			{PROJECTS_COPY.statusDraft}
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
					toast.success(PROJECTS_COPY.renameSuccess);
					onOpenChange(false);
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display">
						{PROJECTS_COPY.renameTitle}
					</DialogTitle>
					<DialogDescription>
						{PROJECTS_COPY.renameDescription}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`rename-${project.id}`}>
							{PROJECTS_COPY.renameLabel}
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
							{PROJECTS_COPY.renameCancel}
						</Button>
						<Button type="submit" disabled={!name.trim() || rename.isPending}>
							{rename.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{PROJECTS_COPY.renameSave}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function ProjectCard({ project }: { project: Project }) {
	const navigate = useNavigate();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const deleteProject = useDeleteProject();

	const isPublished = project.status === "published";
	const glyph = project.name.trim().charAt(0).toUpperCase() || "✦";

	const handleDelete = () => {
		deleteProject.mutate(project.id, {
			onSuccess: () => toast.success(PROJECTS_COPY.deleteSuccess),
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
					<span className="absolute right-4 bottom-0 select-none font-bold font-display text-8xl text-white/15 leading-none">
						{glyph}
					</span>
					<div className="absolute top-2 left-2">
						<StatusBadge status={project.status} />
					</div>
				</div>
				<div className="p-3.5">
					<h3 className="truncate font-display font-semibold text-sm">
						{project.name}
					</h3>
					<div className="mt-1.5 flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
						<Users aria-hidden className="size-3 shrink-0" />
						<span>
							{project.leadCount} {PROJECTS_COPY.leadsSuffix}
						</span>
						<span aria-hidden className="text-muted-foreground/50">
							·
						</span>
						<span>{relativeTime(project.updatedAt)}</span>
					</div>
					{isPublished && project.publishedSlug ? (
						<div className="mt-1.5 truncate font-mono text-primary text-xs">
							{project.publishedSlug}
							{PROJECTS_COPY.publishedDomain}
						</div>
					) : null}
				</div>
			</Link>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="secondary"
						size="icon-sm"
						aria-label={PROJECTS_COPY.cardMenuLabel}
						onClick={(e) => e.stopPropagation()}
						className="absolute top-2 right-2 size-7 opacity-0 shadow-sm transition-opacity duration-150 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
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
						{PROJECTS_COPY.menuOpen}
					</DropdownMenuItem>
					{isPublished ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<div>
									<DropdownMenuItem disabled>
										<ExternalLink />
										{PROJECTS_COPY.menuViewLive}
									</DropdownMenuItem>
								</div>
							</TooltipTrigger>
							<TooltipContent side="right">
								{PROJECTS_COPY.menuViewLiveMock}
							</TooltipContent>
						</Tooltip>
					) : null}
					<DropdownMenuItem onSelect={() => setRenameOpen(true)}>
						<PenLine />
						{PROJECTS_COPY.menuRename}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setDeleteOpen(true)}
					>
						<Trash2 />
						{PROJECTS_COPY.menuDelete}
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
							{PROJECTS_COPY.deleteTitle}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{PROJECTS_COPY.deleteDescription(project.name)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{PROJECTS_COPY.deleteCancel}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{PROJECTS_COPY.deleteConfirm}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
