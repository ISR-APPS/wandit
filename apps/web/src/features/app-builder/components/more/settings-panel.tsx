/**
 * Settings panel of the More view: project name, URL, description and type,
 * the collaborator list with roles, the environment variables, and the delete
 * zone. Rendered by components/more/more-view.tsx inside PanelShell, which
 * draws the title. Reads projectSettingsQuery; writes through
 * useUpdateAppProject and useSetCollaboratorRole.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
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
import { Field, FieldLabel } from "@wandit/ui/components/field";
import { Input } from "@wandit/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@wandit/ui/components/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Textarea } from "@wandit/ui/components/textarea";
import { cn } from "@wandit/ui/lib/utils";
import { useId } from "react";
import { toast } from "sonner";

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	useSetCollaboratorRole,
	useUpdateAppProject,
} from "../../api/app-builder.mutations";
import { projectSettingsQuery } from "../../api/app-builder.queries";
import type { AppProject, EnvironmentVariable } from "../../api/dto";
import { MORE_PANEL_META } from "../../lib/constants";
import { SegmentedControl } from "../shell/segmented-control";

export type SettingsPanelProps = {
	/** The project the page reads from appProjectQuery. Its fields fill the form. */
	project: AppProject;
};

/** Roles the owner can give. The owner role itself never changes here. */
const EDITABLE_ROLES = ["editor", "viewer"] as const;

/** Twelve dots stand in for a secret value the API never returns. */
const MASKED_SECRET = "••••••••••••";

export function SettingsPanel({ project }: SettingsPanelProps) {
	const { t, locale } = useTranslation();
	const { data: settings } = useSuspenseQuery(projectSettingsQuery(project.id));
	const update = useUpdateAppProject(project.id);
	const setRole = useSetCollaboratorRole(project.id);
	const nameId = useId();
	const projectUrlId = useId();
	const descriptionId = useId();
	const notWired = () => toast(t("appBuilder.mock.notWired"));

	return (
		<>
			<section className="rounded-2xl border bg-card p-4">
				<h2 className="mb-3 font-semibold">
					{t("appBuilder.settings.project")}
				</h2>
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
							dir="auto"
							onBlur={(event) => {
								const name = event.currentTarget.value.trim();
								// An empty name would leave the project without a title in the menu.
								if (name !== "" && name !== project.name) {
									update.mutate({ name });
								}
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
					<Field className="sm:col-span-2">
						<FieldLabel htmlFor={descriptionId}>
							{t("appBuilder.settings.descriptionLabel")}
						</FieldLabel>
						<Textarea
							key={project.description}
							id={descriptionId}
							defaultValue={project.description}
							dir="auto"
							onBlur={(event) => {
								const description = event.currentTarget.value.trim();
								if (description !== project.description) {
									update.mutate({ description });
								}
							}}
						/>
					</Field>
				</div>
				<div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
					<div>
						<p className="font-medium text-sm">
							{t("appBuilder.settings.projectType")}
						</p>
						<p className="text-muted-foreground text-xs">
							{t("appBuilder.settings.projectTypeHelp")}
						</p>
					</div>
					<SegmentedControl
						size="md"
						ariaLabel={t("appBuilder.settings.projectType")}
						value={project.kind}
						onChange={(kind) => update.mutate({ kind })}
						options={[
							{ value: "web", label: t("appBuilder.kind.web") },
							{ value: "mobile", label: t("appBuilder.kind.mobile") },
						]}
					/>
				</div>
			</section>

			<section className="rounded-2xl border bg-card">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<div className="flex items-baseline gap-2">
						<h2 className="font-semibold">
							{t("appBuilder.settings.collaborators")}
						</h2>
						<span className="text-muted-foreground text-xs">
							{t("appBuilder.settings.seats", {
								count: formatNumber(settings.collaborators.length, locale),
								max: formatNumber(settings.collaboratorLimit, locale),
							})}
						</span>
					</div>
					<Button variant="outline" size="sm" onClick={notWired}>
						{t("appBuilder.settings.invite")}
					</Button>
				</div>
				{settings.collaborators.map((collaborator) => (
					<div
						key={collaborator.id}
						className="flex items-center gap-3 border-t px-4 py-3 text-sm"
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-semibold text-xs">
							{collaborator.name.charAt(0)}
						</span>
						<div className="min-w-0 flex-1">
							<p dir="auto">{collaborator.name}</p>
							<p className="text-muted-foreground text-xs" dir="auto">
								{collaborator.pending
									? t("appBuilder.settings.pending")
									: collaborator.subtitle}
							</p>
						</div>
						{/* The owner keeps the project; only the other seats get a role menu. */}
						{collaborator.role === "owner" ? (
							<span className="text-muted-foreground text-xs">
								{t("appBuilder.settings.roles.owner")}
							</span>
						) : (
							<Select
								value={collaborator.role}
								onValueChange={(value) => {
									const role = EDITABLE_ROLES.find(
										(candidate) => candidate === value,
									);
									if (role) {
										setRole.mutate({ collaboratorId: collaborator.id, role });
									}
								}}
							>
								<SelectTrigger
									size="sm"
									className="rounded-full"
									aria-label={t("appBuilder.settings.roleLabel", {
										name: collaborator.name,
									})}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EDITABLE_ROLES.map((role) => (
										<SelectItem key={role} value={role}>
											{t(`appBuilder.settings.roles.${role}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				))}
			</section>

			<section className="rounded-2xl border bg-card">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<div className="flex items-baseline gap-2">
						<h2 className="font-semibold">
							{t("appBuilder.settings.envTitle")}
						</h2>
						<span className="text-muted-foreground text-xs">
							{t("appBuilder.settings.envHelp")}
						</span>
					</div>
					<Button variant="outline" size="sm" onClick={notWired}>
						{t("appBuilder.settings.addVariable")}
					</Button>
				</div>
				{settings.environmentVariables.map((variable) => (
					<div
						key={variable.name}
						className="grid grid-cols-[220px_1fr_auto] items-center gap-4 border-t px-4 py-3 text-sm"
					>
						<span className="font-mono text-xs">{variable.name}</span>
						<span
							className={cn(
								"font-mono text-xs",
								variable.value === null && "text-muted-foreground",
							)}
						>
							{variable.value ?? MASKED_SECRET}
						</span>
						<span className="text-muted-foreground text-xs">
							{variableOrigin(variable, t)}
						</span>
					</div>
				))}
			</section>

			<section className="flex items-center justify-between gap-4 rounded-2xl border border-destructive/40 p-4">
				<div>
					<h2 className="font-semibold">
						{t("appBuilder.settings.deleteTitle")}
					</h2>
					<p className="text-muted-foreground text-xs">
						{t("appBuilder.settings.deleteHelp")}
					</p>
				</div>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="destructive">
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
							<AlertDialogAction variant="destructive" onClick={notWired}>
								{t("appBuilder.settings.delete")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</section>
		</>
	);
}

/** End text of a variable row: the panel that set it, "Public" for a browser value, or nothing. */
function variableOrigin(
	variable: EnvironmentVariable,
	t: ReturnType<typeof useTranslation>["t"],
): string | null {
	if (variable.setBy) {
		return t("appBuilder.settings.setBy", {
			panel: t(MORE_PANEL_META[variable.setBy].title),
		});
	}
	return variable.isPublic ? t("appBuilder.settings.public") : null;
}
