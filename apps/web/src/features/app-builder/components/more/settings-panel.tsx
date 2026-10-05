/**
 * Settings panel of the More view: project name, URL, description and type,
 * the collaborator list with roles, the environment variables, and the delete
 * zone. Rendered by components/more/more-view.tsx inside PanelShell, which
 * draws the title. Reads projectSettingsQuery; writes through
 * useUpdateAppProject and useSetCollaboratorRole.
 */

import { PlusIcon } from "@phosphor-icons/react/Plus";
import { UserPlusIcon } from "@phosphor-icons/react/UserPlus";
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
import {
	PANEL_CARD_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
} from "./panel-shell";

export type SettingsPanelProps = {
	/** The project the page reads from appProjectQuery. Its fields fill the form. */
	project: AppProject;
};

/** Roles the owner can give. The owner role itself never changes here. */
const EDITABLE_ROLES = ["editor", "viewer"] as const;

/** Twelve dots stand in for a secret value the API never returns. */
const MASKED_SECRET = "••••••••••••";

/** Label above a field of the project card. */
const FIELD_LABEL_CLASS =
	"font-grotesk font-medium text-[13px] text-night/70 dark:text-foreground/70";

/** Title of a card. */
const CARD_TITLE_CLASS =
	"font-grotesk font-semibold text-[15px] text-night dark:text-foreground";

/** Hairline above each row of a card. The settings spec finds a row by this class. */
const CARD_ROW_CLASS = "border-night/[0.07] border-t dark:border-white/[0.07]";

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
			<section className={cn(PANEL_CARD_CLASS, "p-5")}>
				<h2 className={cn(CARD_TITLE_CLASS, "mb-4")}>
					{t("appBuilder.settings.project")}
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field className="gap-2">
						<FieldLabel htmlFor={nameId} className={FIELD_LABEL_CLASS}>
							{t("appBuilder.settings.name")}
						</FieldLabel>
						{/* The key resets the draft when another project loads or a save changes the name. */}
						<Input
							key={project.name}
							id={nameId}
							defaultValue={project.name}
							dir="auto"
							className={PANEL_INPUT_CLASS}
							onBlur={(event) => {
								const name = event.currentTarget.value.trim();
								// An empty name would leave the project without a title in the menu.
								if (name !== "" && name !== project.name) {
									update.mutate({ name });
								}
							}}
						/>
					</Field>
					<Field className="gap-2">
						<FieldLabel htmlFor={projectUrlId} className={FIELD_LABEL_CLASS}>
							{t("appBuilder.settings.projectUrl")}
						</FieldLabel>
						{/* The project URL is the builder link, not the published domain. A URL reads left to right in every locale. */}
						<InputGroup
							dir="ltr"
							className="h-10 rounded-full border-night/[0.12] bg-night/[0.025] shadow-none dark:border-white/[0.12] dark:bg-white/[0.03]"
						>
							<InputGroupAddon className="ps-4">
								<InputGroupText className="font-mono text-[12.5px] text-night/45 dark:text-foreground/45">
									{t("appBuilder.settings.projectUrlPrefix")}
								</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								id={projectUrlId}
								readOnly
								value={project.id}
								className="pe-4 font-medium font-mono text-[12.5px] text-night dark:text-foreground"
							/>
						</InputGroup>
					</Field>
					<Field className="gap-2 sm:col-span-2">
						<FieldLabel htmlFor={descriptionId} className={FIELD_LABEL_CLASS}>
							{t("appBuilder.settings.descriptionLabel")}
						</FieldLabel>
						<Textarea
							key={project.description}
							id={descriptionId}
							defaultValue={project.description}
							dir="auto"
							className="min-h-20 rounded-[16px] border-night/[0.12] bg-white px-4 py-3 shadow-none focus-visible:border-primary/50 focus-visible:ring-primary/15 dark:border-white/[0.12] dark:bg-white/[0.04]"
							onBlur={(event) => {
								const description = event.currentTarget.value.trim();
								if (description !== project.description) {
									update.mutate({ description });
								}
							}}
						/>
					</Field>
				</div>
				<div
					className={cn(
						CARD_ROW_CLASS,
						"mt-5 flex flex-wrap items-center justify-between gap-4 pt-4",
					)}
				>
					<div>
						<p className="font-grotesk font-medium text-[14px] text-night dark:text-foreground">
							{t("appBuilder.settings.projectType")}
						</p>
						<p className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
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

			<section className={PANEL_CARD_CLASS}>
				<div className="flex items-center justify-between gap-3 px-5 py-4">
					<div className="flex items-center gap-2.5">
						<h2 className={CARD_TITLE_CLASS}>
							{t("appBuilder.settings.collaborators")}
						</h2>
						<PanelChip className="tabular-nums">
							{t("appBuilder.settings.seats", {
								count: formatNumber(settings.collaborators.length, locale),
								max: formatNumber(settings.collaboratorLimit, locale),
							})}
						</PanelChip>
					</div>
					<Button
						variant="outline"
						size="sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						onClick={notWired}
					>
						<UserPlusIcon aria-hidden weight="bold" />
						{t("appBuilder.settings.invite")}
					</Button>
				</div>
				{settings.collaborators.map((collaborator) => (
					<div
						key={collaborator.id}
						className={cn(CARD_ROW_CLASS, "flex items-center gap-3 px-5 py-3")}
					>
						<span
							aria-hidden
							className="grid size-9 shrink-0 place-items-center rounded-full bg-cream font-grotesk font-semibold text-[13px] text-night dark:bg-spark/20 dark:text-spark"
						>
							{collaborator.name.charAt(0)}
						</span>
						<div className="min-w-0 flex-1">
							<p
								className="truncate font-grotesk font-medium text-[14px] text-night dark:text-foreground"
								dir="auto"
							>
								{collaborator.name}
							</p>
							<p
								className="truncate font-sans text-[13px] text-night/55 dark:text-foreground/55"
								dir="auto"
							>
								{collaborator.pending
									? t("appBuilder.settings.pending")
									: collaborator.subtitle}
							</p>
						</div>
						{/* The owner keeps the project; only the other seats get a role menu. */}
						{collaborator.role === "owner" ? (
							<PanelChip tone="ember">
								{t("appBuilder.settings.roles.owner")}
							</PanelChip>
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
									className="rounded-full border-night/[0.12] bg-white px-3.5 font-grotesk font-medium text-night shadow-none dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground"
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

			<section className={PANEL_CARD_CLASS}>
				<div className="flex items-center justify-between gap-3 px-5 py-4">
					<div className="min-w-0">
						<h2 className={CARD_TITLE_CLASS}>
							{t("appBuilder.settings.envTitle")}
						</h2>
						<p className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
							{t("appBuilder.settings.envHelp")}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						onClick={notWired}
					>
						<PlusIcon aria-hidden weight="bold" />
						{t("appBuilder.settings.addVariable")}
					</Button>
				</div>
				{settings.environmentVariables.map((variable) => (
					<div
						key={variable.name}
						className={cn(
							CARD_ROW_CLASS,
							"grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]",
						)}
					>
						<span
							dir="ltr"
							className="truncate font-medium font-mono text-[12.5px] text-night dark:text-foreground"
						>
							{variable.name}
						</span>
						<span
							dir="ltr"
							className={cn(
								"truncate font-mono text-[12.5px]",
								variable.value === null
									? "text-night/35 tracking-widest dark:text-foreground/35"
									: "text-night/70 dark:text-foreground/70",
							)}
						>
							{variable.value ?? MASKED_SECRET}
						</span>
						<VariableOrigin variable={variable} />
					</div>
				))}
			</section>

			<section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-destructive/25 bg-destructive/[0.03] p-5 dark:border-destructive/30 dark:bg-destructive/[0.06]">
				<div className="min-w-0 max-w-md">
					<h2 className="font-grotesk font-semibold text-[15px] text-destructive">
						{t("appBuilder.settings.deleteTitle")}
					</h2>
					<p className="mt-0.5 font-sans text-[13px] text-night/60 dark:text-foreground/60">
						{t("appBuilder.settings.deleteHelp")}
					</p>
				</div>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							variant="destructive"
							className="h-10 px-5 font-grotesk font-semibold"
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

/** End chip of a variable row: the panel that set it, "Public" for a browser value, or nothing. */
function VariableOrigin({ variable }: { variable: EnvironmentVariable }) {
	const { t } = useTranslation();
	if (variable.setBy) {
		return (
			<PanelChip>
				{t("appBuilder.settings.setBy", {
					panel: t(MORE_PANEL_META[variable.setBy].title),
				})}
			</PanelChip>
		);
	}
	// A public value reaches the browser of every user, so it gets the warning tone.
	return variable.isPublic ? (
		<PanelChip tone="warning">{t("appBuilder.settings.public")}</PanelChip>
	) : null;
}
