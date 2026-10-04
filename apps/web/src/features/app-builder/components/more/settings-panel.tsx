/**
 * Settings panel of the More view: the project name and its read-only facts
 * (URL, type, app languages, template version), a link to the Secrets panel,
 * the spending limits, and the delete zone. Rendered by
 * components/more/more-view.tsx inside PanelShell, which draws the title.
 * Renames and deletes through the projects feature (V1 PATCH and DELETE),
 * and reads and saves the caps through projectCostCapsQuery and useUpdateCostCaps.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ProjectCostCaps } from "@wandit/contracts";
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
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@wandit/ui/components/field";
import { Input } from "@wandit/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@wandit/ui/components/input-group";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { useId, useState } from "react";
import { toast } from "sonner";

import {
	PROJECT_NAME_MAX_LENGTH,
	useDeleteProject,
	useRenameProject,
} from "@/features/projects";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useUpdateCostCaps } from "../../api/app-builder.mutations";
import {
	appBuilderKeys,
	projectCostCapsQuery,
} from "../../api/app-builder.queries";
import type { AppProject } from "../../api/dto";
import { CLOUD_EMPTY_CELL } from "../../lib/constants";
import { costCapToDraft, toCostCapsBody } from "../../lib/helpers";
import { KindBadge } from "../shell/project-menu";

export type SettingsPanelProps = {
	/** The project the page reads from appProjectQuery. Its fields fill the form. */
	project: AppProject;
	/** Opens the Secrets panel of the Backend group. undefined while the Backend group is hidden, so the link does not show. */
	onOpenSecrets: (() => void) | undefined;
};

export function SettingsPanel({ project, onOpenSecrets }: SettingsPanelProps) {
	const { t } = useTranslation();
	// The API gives the caps and the delete only to owners and admins; a personal workspace counts as owner.
	const { actorCanManageWorkspace } = useWorkspace();

	return (
		<>
			<ProjectSection project={project} />
			{onOpenSecrets ? (
				<section className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
					<div>
						<h2 className="font-semibold">
							{t("appBuilder.settings.secretsTitle")}
						</h2>
						<p className="text-muted-foreground text-xs">
							{t("appBuilder.settings.secretsHelp")}
						</p>
					</div>
					<Button variant="outline" size="sm" onClick={onOpenSecrets}>
						{t("appBuilder.settings.openSecrets")}
					</Button>
				</section>
			) : null}
			<section className="rounded-2xl border bg-card p-4">
				<h2 className="font-semibold">
					{t("appBuilder.settings.limitsTitle")}
				</h2>
				{actorCanManageWorkspace ? (
					<SpendingLimits projectId={project.id} />
				) : (
					<p className="mt-1 text-muted-foreground text-xs">
						{t("appBuilder.settings.limitsManagersOnly")}
					</p>
				)}
			</section>
			<DeleteZone project={project} canDelete={actorCanManageWorkspace} />
		</>
	);
}

/** The name field, saved on blur, and the facts that never change after creation. */
function ProjectSection({ project }: { project: AppProject }) {
	const { t, locale } = useTranslation();
	const queryClient = useQueryClient();
	const rename = useRenameProject();
	const nameId = useId();
	const projectUrlId = useId();
	const languageNames = new Intl.DisplayNames([locale], { type: "language" });

	return (
		<section className="rounded-2xl border bg-card p-4">
			<h2 className="mb-3 font-semibold">{t("appBuilder.settings.project")}</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={nameId}>
						{t("appBuilder.settings.name")}
					</FieldLabel>
					{/* The key resets the draft when another project loads or a save changes the name. */}
					<Input
						key={project.name}
						id={nameId}
						defaultValue={project.name}
						maxLength={PROJECT_NAME_MAX_LENGTH}
						dir="auto"
						onBlur={(event) => {
							const input = event.currentTarget;
							const name = input.value.trim();
							// An empty name would leave the project without a title, so the field takes the saved name back.
							if (name === "") {
								input.value = project.name;
								return;
							}
							if (name === project.name) return;
							// mutateAsync, not mutate callbacks: a blur from a nav click unmounts this panel, and the cache write must still run.
							void rename.mutateAsync({ id: project.id, name }).then(
								(renamed) => {
									// The projects feature updates its own caches. The builder reads the project from its own query.
									queryClient.setQueryData<AppProject | null>(
										appBuilderKeys.project(project.id),
										(current) =>
											current ? { ...current, name: renamed.name } : current,
									);
									toast.success(t("appBuilder.settings.nameSaved"));
								},
								(error: unknown) => toast.error(getApiErrorMessage(error)),
							);
						}}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={projectUrlId}>
						{t("appBuilder.settings.projectUrl")}
					</FieldLabel>
					{/* The project URL is the builder link, not the published domain. */}
					<InputGroup className="h-9 rounded-md">
						<InputGroupAddon>
							<InputGroupText>
								{t("appBuilder.settings.projectUrlPrefix")}
							</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id={projectUrlId}
							readOnly
							value={project.id}
							className="font-semibold"
						/>
					</InputGroup>
				</Field>
			</div>
			<dl className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm">
				<div className="flex items-center justify-between gap-4">
					<dt>
						<p className="font-medium">
							{t("appBuilder.settings.projectType")}
						</p>
						<p className="text-muted-foreground text-xs">
							{t("appBuilder.settings.projectTypeHelp")}
						</p>
					</dt>
					<dd>
						<KindBadge kind={project.kind} />
					</dd>
				</div>
				<div className="flex items-center justify-between gap-4">
					<dt className="font-medium">{t("appBuilder.settings.languages")}</dt>
					<dd className="flex flex-wrap justify-end gap-1.5">
						{project.languages.length === 0
							? CLOUD_EMPTY_CELL
							: project.languages.map((language) => (
									<Badge key={language} variant="secondary">
										{capitalize(languageNames.of(language) ?? language, locale)}
									</Badge>
								))}
					</dd>
				</div>
				<div className="flex items-center justify-between gap-4">
					<dt className="font-medium">
						{t("appBuilder.settings.templateVersion")}
					</dt>
					{/* A version number reads left to right in every locale. */}
					<dd dir="ltr" className="font-mono text-xs">
						{project.templateVersion ?? CLOUD_EMPTY_CELL}
					</dd>
				</div>
			</dl>
		</section>
	);
}

/** Loads the caps of the project, then shows the form. The caller renders it only for an owner or an admin. */
function SpendingLimits({ projectId }: { projectId: string }) {
	const caps = useQuery(projectCostCapsQuery(projectId));

	if (caps.data === undefined) {
		return caps.isError ? (
			<p className="mt-1 text-destructive text-xs">
				{getApiErrorMessage(caps.error)}
			</p>
		) : (
			<Skeleton className="mt-3 h-24" />
		);
	}
	// A save writes new caps into the query. The new key resets the drafts to the stored values.
	return (
		<SpendingLimitsForm
			key={`${caps.data.perTurnCapCredits}:${caps.data.monthlyCapCredits}`}
			projectId={projectId}
			caps={caps.data}
		/>
	);
}

/** The two cap fields in credits (2 decimals at most), and Save. Save is on only for a valid change. */
function SpendingLimitsForm({
	projectId,
	caps,
}: {
	projectId: string;
	/** The stored caps from projectCostCapsQuery, in centi-credits. */
	caps: ProjectCostCaps;
}) {
	const { t } = useTranslation();
	const update = useUpdateCostCaps(projectId);
	const perTurnId = useId();
	const monthlyId = useId();
	const errorId = useId();
	const [perTurnCredits, setPerTurnCredits] = useState(() =>
		costCapToDraft(caps.perTurnCapCredits),
	);
	const [monthlyCredits, setMonthlyCredits] = useState(() =>
		costCapToDraft(caps.monthlyCapCredits),
	);
	const body = toCostCapsBody({ perTurnCredits, monthlyCredits });
	// Each field alone, with "" in the other one, so only the wrong field is marked invalid.
	const isPerTurnValid =
		toCostCapsBody({ perTurnCredits, monthlyCredits: "" }) !== null;
	const isMonthlyValid =
		toCostCapsBody({ perTurnCredits: "", monthlyCredits }) !== null;
	const isChanged =
		body !== null &&
		(body.perTurnCapCredits !== caps.perTurnCapCredits ||
			body.monthlyCapCredits !== caps.monthlyCapCredits);

	return (
		<form
			className="mt-3 flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (!body || !isChanged) return;
				update.mutate(body, {
					onSuccess: () => toast.success(t("appBuilder.settings.limitsSaved")),
				});
			}}
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={perTurnId}>
						{t("appBuilder.settings.perTurnLimit")}
					</FieldLabel>
					<InputGroup className="h-9 rounded-md">
						<InputGroupInput
							id={perTurnId}
							type="number"
							inputMode="decimal"
							min={0.01}
							step={0.01}
							value={perTurnCredits}
							placeholder={t("appBuilder.settings.perTurnDefault")}
							aria-invalid={!isPerTurnValid}
							aria-describedby={isPerTurnValid ? undefined : errorId}
							onChange={(event) => setPerTurnCredits(event.target.value)}
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>
								{t("appBuilder.settings.creditsUnit")}
							</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<FieldDescription>
						{t("appBuilder.settings.perTurnHelp")}
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor={monthlyId}>
						{t("appBuilder.settings.monthlyLimit")}
					</FieldLabel>
					<InputGroup className="h-9 rounded-md">
						<InputGroupInput
							id={monthlyId}
							type="number"
							inputMode="decimal"
							min={0.01}
							step={0.01}
							value={monthlyCredits}
							placeholder={t("appBuilder.settings.monthlyNone")}
							aria-invalid={!isMonthlyValid}
							aria-describedby={isMonthlyValid ? undefined : errorId}
							onChange={(event) => setMonthlyCredits(event.target.value)}
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>
								{t("appBuilder.settings.creditsUnit")}
							</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<FieldDescription>
						{t("appBuilder.settings.monthlyHelp")}
					</FieldDescription>
				</Field>
			</div>
			<div className="flex items-center justify-between gap-3">
				<p id={errorId} role="alert" className="text-destructive text-xs">
					{body === null ? t("appBuilder.settings.limitsInvalid") : null}
				</p>
				<Button
					type="submit"
					size="sm"
					disabled={!isChanged || update.isPending}
				>
					{t("appBuilder.settings.limitsSave")}
				</Button>
			</div>
		</form>
	);
}

/** Delete with a confirm dialog, then the dashboard. A member sees the button off with the reason. */
function DeleteZone({
	project,
	canDelete,
}: {
	project: AppProject;
	/** True for a workspace owner or admin. The API refuses the delete to a member. */
	canDelete: boolean;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const deleteProject = useDeleteProject();

	return (
		<section className="flex items-center justify-between gap-4 rounded-2xl border border-destructive/40 p-4">
			<div>
				<h2 className="font-semibold">
					{t("appBuilder.settings.deleteTitle")}
				</h2>
				<p className="text-muted-foreground text-xs">
					{canDelete
						? t("appBuilder.settings.deleteHelp")
						: t("appBuilder.settings.deleteManagersOnly")}
				</p>
			</div>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="destructive"
						disabled={!canDelete || deleteProject.isPending}
					>
						{t("appBuilder.settings.delete")}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("appBuilder.settings.deleteConfirmTitle", {
								name: project.name,
							})}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("appBuilder.settings.deleteConfirmBody")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("appBuilder.settings.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								// mutateAsync, not mutate callbacks: the cache write must run also when this panel unmounts first.
								void deleteProject.mutateAsync(project.id).then(
									() => {
										toast.success(t("appBuilder.settings.deleted"));
										// null means "no such project" to appProjectQuery, so Back opens the not-found screen.
										// It runs also when Back cancels a slow navigation.
										void navigate({ to: "/dashboard" }).finally(() =>
											queryClient.setQueryData<AppProject | null>(
												appBuilderKeys.project(project.id),
												null,
											),
										);
									},
									(error: unknown) => toast.error(getApiErrorMessage(error)),
								);
							}}
						>
							{t("appBuilder.settings.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}

/** Intl gives French language names in lower case ("arabe"). A badge label starts with a capital, like the other labels. */
function capitalize(text: string, locale: string): string {
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
