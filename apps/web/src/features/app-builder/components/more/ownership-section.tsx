/**
 * Transfer ownership and Move to another workspace, two cards of the V2
 * Settings panel (workspaces-sharing.md 5 and 6). settings-panel.tsx renders
 * them when the API sends `project.access`. The transfer and move routes go
 * through the project-sharing feature; this file then refreshes the builder
 * project and the project lists.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	PERSONAL_WORKSPACE,
	type ProjectAccess,
	type ProjectMoveBlockedReason,
	projectMoveBlockedDetailsSchema,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Checkbox } from "@wandit/ui/components/checkbox";
import { Label } from "@wandit/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import {
	projectSharingQuery,
	useMoveProject,
	useTransferProject,
	workspaceMembersQuery,
} from "@/features/project-sharing";
import { projectKeys } from "@/features/projects";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { appBuilderKeys } from "../../api/app-builder.queries";
import type { AppProject } from "../../api/dto";
import {
	PANEL_CARD_CLASS,
	PANEL_CARD_TITLE_CLASS,
	PANEL_HINT_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
} from "./panel-shell";

type OwnershipSectionProps = {
	project: AppProject;
	/** The caller's access, from `project.access`. The caller decides which card shows. */
	access: ProjectAccess;
};

/** Shows each card only to the roles that the API accepts. */
export function OwnershipSection({ project, access }: OwnershipSectionProps) {
	const { workspaces } = useWorkspace();
	// Product rule: a transfer is for the owner of a team project. A personal
	// workspace owner owns every project in it.
	const canTransfer =
		access.workspace.kind === "team" && access.role === "owner";
	// Product rule: only the workspace owner of the source moves a project out.
	// In a personal workspace, only its owner has the project role `owner`.
	const canMove =
		access.workspace.kind === "personal"
			? access.role === "owner"
			: workspaces.some(
					(workspace) =>
						workspace.id === access.workspace.id &&
						workspace.roles.includes("owner"),
				);

	return (
		<>
			{canTransfer ? <TransferCard project={project} access={access} /> : null}
			{canMove ? <MoveCard project={project} access={access} /> : null}
		</>
	);
}

/** Card frame with its title and hint. */
function OwnershipCard({
	title,
	hint,
	children,
}: {
	title: string;
	hint: string;
	children: ReactNode;
}) {
	return (
		<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 p-5")}>
			<div>
				<h2 className={PANEL_CARD_TITLE_CLASS}>{title}</h2>
				<p className={PANEL_HINT_CLASS}>{hint}</p>
			</div>
			{children}
		</section>
	);
}

/** Picks an owner, admin, or editor of the workspace, confirms, and transfers. */
function TransferCard({ project, access }: OwnershipSectionProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const selectId = useId();
	const members = useQuery(workspaceMembersQuery(access.workspace.id));
	// The sharing state names the current owner, who is no candidate.
	const sharing = useQuery(projectSharingQuery(project.id));
	const transfer = useTransferProject(project.id);
	const [newOwnerUserId, setNewOwnerUserId] = useState<string | null>(null);
	const title = t("sharing.settings.transferTitle");
	const hint = t("sharing.settings.transferHelp", {
		workspace: access.workspace.name,
	});

	if (members.data === undefined || sharing.data === undefined) {
		const error = members.error ?? sharing.error;
		return (
			<OwnershipCard title={title} hint={hint}>
				{error === null ? (
					<Skeleton className="h-10 rounded-full" />
				) : (
					<p className="font-sans text-[13px] text-destructive">
						{getApiErrorMessage(error)}
					</p>
				)}
			</OwnershipCard>
		);
	}

	const ownerUserId = sharing.data.owner.userId;
	// Product rule: the new owner is an owner, admin, or editor of the workspace.
	const candidates = members.data.filter(
		(member) =>
			member.userId !== ownerUserId &&
			member.roles.some((role) => role !== "viewer"),
	);
	const picked = candidates.find((member) => member.userId === newOwnerUserId);

	if (candidates.length === 0) {
		return (
			<OwnershipCard title={title} hint={hint}>
				<p className={PANEL_HINT_CLASS}>
					{t("sharing.settings.transferNoCandidates")}
				</p>
			</OwnershipCard>
		);
	}

	return (
		<OwnershipCard title={title} hint={hint}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Label htmlFor={selectId} className="sr-only">
					{t("sharing.settings.transferPerson")}
				</Label>
				<Select value={newOwnerUserId ?? ""} onValueChange={setNewOwnerUserId}>
					<SelectTrigger
						id={selectId}
						className={cn(PANEL_INPUT_CLASS, "w-full sm:w-72")}
					>
						<SelectValue
							placeholder={t("sharing.settings.transferPlaceholder")}
						/>
					</SelectTrigger>
					<SelectContent>
						{candidates.map((member) => (
							<SelectItem key={member.userId} value={member.userId}>
								{member.name || member.email}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
							disabled={picked === undefined || transfer.isPending}
						>
							{t("sharing.settings.transferSubmit")}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("sharing.settings.transferConfirmTitle", {
									name: picked?.name || picked?.email || "",
								})}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("sharing.settings.transferConfirmBody")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								{t("sharing.settings.cancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									if (picked === undefined) return;
									// mutateAsync, not mutate callbacks: the cache write must run also when this panel unmounts first.
									void transfer.mutateAsync(picked.userId).then(
										() => {
											toast.success(t("sharing.settings.transferred"));
											setNewOwnerUserId(null);
											// The caller's project role can drop, so the builder and the dashboard cards read the access again.
											void queryClient.invalidateQueries({
												queryKey: appBuilderKeys.project(project.id),
											});
											void queryClient.invalidateQueries({
												queryKey: projectKeys.all,
											});
										},
										(error: unknown) => toast.error(getApiErrorMessage(error)),
									);
								}}
							>
								{t("sharing.settings.transferSubmit")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</OwnershipCard>
	);
}

/** Picks a destination workspace, asks about the collaborators, confirms, and moves. */
function MoveCard({ project, access }: OwnershipSectionProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { workspaces } = useWorkspace();
	const selectId = useId();
	const keepId = useId();
	const move = useMoveProject(project.id);
	const [destinationId, setDestinationId] = useState<string | null>(null);
	const [keepCollaborators, setKeepCollaborators] = useState(false);
	// The reason of the last 409 PROJECT_MOVE_BLOCKED, shown under the form.
	const [blockedReason, setBlockedReason] =
		useState<ProjectMoveBlockedReason | null>(null);
	// Product rule: a destination is another workspace where the caller can
	// create projects. A viewer cannot.
	const destinations = workspaces.filter(
		(workspace) =>
			workspace.id !== access.workspace.id &&
			workspace.roles.some((role) => role !== "viewer"),
	);
	const destination = destinations.find(
		(workspace) => workspace.id === destinationId,
	);
	const title = t("sharing.settings.moveTitle");
	const hint = t("sharing.settings.moveHelp");

	if (destinations.length === 0) {
		return (
			<OwnershipCard title={title} hint={hint}>
				<p className={PANEL_HINT_CLASS}>
					{t("sharing.settings.moveNoDestinations")}
				</p>
			</OwnershipCard>
		);
	}

	return (
		<OwnershipCard title={title} hint={hint}>
			<div className="flex flex-col gap-3">
				<Label htmlFor={selectId} className="sr-only">
					{t("sharing.settings.moveDestination")}
				</Label>
				<Select value={destinationId ?? ""} onValueChange={setDestinationId}>
					<SelectTrigger
						id={selectId}
						className={cn(PANEL_INPUT_CLASS, "w-full sm:w-72")}
					>
						<SelectValue placeholder={t("sharing.settings.movePlaceholder")} />
					</SelectTrigger>
					<SelectContent>
						{destinations.map((workspace) => (
							<SelectItem key={workspace.id} value={workspace.id}>
								{workspace.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-2">
					<Checkbox
						id={keepId}
						checked={keepCollaborators}
						onCheckedChange={(checked) =>
							setKeepCollaborators(checked === true)
						}
					/>
					<Label htmlFor={keepId} className="font-sans text-[13px]">
						{t("sharing.settings.moveKeepCollaborators")}
					</Label>
				</div>
				<div className="flex items-center justify-between gap-3">
					<p role="alert" className="font-sans text-[13px] text-destructive">
						{blockedReason === null
							? null
							: t(`sharing.settings.moveBlocked.${blockedReason}`)}
					</p>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
								disabled={destination === undefined || move.isPending}
							>
								{t("sharing.settings.moveSubmit")}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{t("sharing.settings.moveConfirmTitle", {
										workspace: destination?.name ?? "",
									})}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{t("sharing.settings.moveConfirmBody")}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>
									{t("sharing.settings.cancel")}
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => {
										if (destination === undefined) return;
										setBlockedReason(null);
										// mutateAsync, not mutate callbacks: the cache write must run also when this panel unmounts first.
										void move
											.mutateAsync({
												// The contract names the caller's own personal workspace `personal`.
												destinationWorkspaceId: destination.isOwnPersonal
													? PERSONAL_WORKSPACE
													: destination.id,
												keepCollaborators,
											})
											.then(
												() => {
													toast.success(t("sharing.settings.moved"));
													setDestinationId(null);
													// The project changes workspace: its access and every project list change.
													void queryClient.invalidateQueries({
														queryKey: appBuilderKeys.project(project.id),
													});
													void queryClient.invalidateQueries({
														queryKey: projectKeys.all,
													});
												},
												(error: unknown) => {
													const reason = moveBlockedReasonOf(error);
													if (reason === null) {
														toast.error(getApiErrorMessage(error));
													} else {
														setBlockedReason(reason);
													}
												},
											);
									}}
								>
									{t("sharing.settings.moveSubmit")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</OwnershipCard>
	);
}

/** The reason of a 409 PROJECT_MOVE_BLOCKED answer, or null for every other error. */
function moveBlockedReasonOf(error: unknown): ProjectMoveBlockedReason | null {
	if (!isApiClientError(error) || error.code !== "PROJECT_MOVE_BLOCKED") {
		return null;
	}
	// The details cross the HTTP boundary, so the contract schema decides.
	const details = projectMoveBlockedDetailsSchema.safeParse(error.details);
	return details.success ? details.data.reason : null;
}
