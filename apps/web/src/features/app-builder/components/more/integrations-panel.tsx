/**
 * Integrations panel of the More view. It holds one card: the GitHub sync of
 * the project. The card shows one of four states. The App is not set up, the
 * user is not connected, the user can create a repo, or the repo is linked.
 * A project viewer sees the status read-only: a note in place of Connect and
 * Create, and no Unlink.
 * Rendered by components/more/more-view.tsx inside PanelShell. Reads
 * github.queries.ts and calls github.mutations.ts.
 */

import { GithubLogoIcon } from "@phosphor-icons/react/GithubLogo";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery } from "@tanstack/react-query";
import {
	createGithubRepositoryBodySchema,
	type GithubAccountResponse,
	type GithubAuthorizeBody,
	type ProjectGithubLink,
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
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@wandit/ui/components/field";
import { Input } from "@wandit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useId, useState } from "react";

import { hasProjectRole } from "@/features/project-sharing";
import { slugify } from "@/features/workspace";
import { getApiErrorMessage } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import {
	useCreateGithubRepository,
	useStartGithubAuthorize,
	useUnlinkGithubRepository,
} from "../../api/github.mutations";
import {
	githubAccountQuery,
	projectGithubStatusQuery,
} from "../../api/github.queries";
import { SHORT_SHA_LENGTH } from "../../lib/constants";
import {
	PANEL_CARD_CLASS,
	PANEL_CARD_ROW_CLASS,
	PANEL_CARD_TITLE_CLASS,
	PANEL_FIELD_LABEL_CLASS,
	PANEL_HINT_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "./panel-shell";

/** Props from components/more/more-view.tsx. The view renders this panel when the More nav selects "integrations". */
export type IntegrationsPanelProps = {
	/** The project the page reads from appProjectQuery. Its name gives the default repo name. */
	project: AppProject;
	/** True while the More view is on screen. The view stays mounted, so the account query waits for it. */
	isActive: boolean;
};

/** Repo name for a project name with no latin letters, for example an Arabic name. The user can change it. */
const FALLBACK_REPO_NAME = "wandit-app";

/** GitHub refuses a longer repo name. The regex of `createGithubRepositoryBodySchema` has the same limit. */
const GITHUB_REPO_NAME_MAX_LENGTH = 100;

/** The sync rules that can surprise a user: the branch, the conflict winner, and the workflow guard of the worker. */
const SYNC_NOTES = [
	"appBuilder.github.notes.mainOnly",
	"appBuilder.github.notes.githubWins",
	"appBuilder.github.notes.workflows",
] as const satisfies readonly TranslationKey[];

/** The GitHub card in the state of the project status, and the notes of the sync. */
export function IntegrationsPanel({
	project,
	isActive,
}: IntegrationsPanelProps) {
	const { t } = useTranslation();
	// The page reads the same status query for the update banner, so this read hits the cache.
	const status = useQuery(projectGithubStatusQuery(project.id));
	// Product rule: connect, link, and unlink need the editor role (workspaces-sharing.md 2.2).
	const canEdit = hasProjectRole(project.access, "editor");
	// The account route can call GitHub. Only the create form reads it, so it waits for that state.
	const account = useQuery(
		githubAccountQuery(
			isActive &&
				canEdit &&
				status.data?.appConfigured === true &&
				status.data.link === null,
		),
	);

	// A failed poll keeps the last status on screen. Only a first load without a status shows the error.
	if (status.data === undefined) {
		return status.isError ? (
			<PanelMessage
				icon={WarningCircleIcon}
				text={getApiErrorMessage(status.error)}
			/>
		) : (
			<Skeleton className="h-[148px] rounded-[20px] bg-night/[0.06] dark:bg-white/[0.07]" />
		);
	}

	if (!status.data.appConfigured) {
		return (
			<PanelMessage
				icon={GithubLogoIcon}
				title={t("appBuilder.github.title")}
				text={t("appBuilder.github.notConfigured")}
			/>
		);
	}

	const { link } = status.data;
	return (
		<>
			<section className={cn(PANEL_CARD_CLASS, "p-5")}>
				<div className="flex items-center gap-3.5">
					<span
						aria-hidden
						className="grid size-9 shrink-0 place-items-center rounded-full bg-night text-paper dark:bg-white/[0.08] dark:text-foreground"
					>
						<GithubLogoIcon weight="fill" className="size-[18px]" />
					</span>
					<div className="min-w-0">
						<h2 className={PANEL_CARD_TITLE_CLASS}>
							{t("appBuilder.github.title")}
						</h2>
						<p className={PANEL_HINT_CLASS}>{t("appBuilder.github.hint")}</p>
					</div>
				</div>
				{link !== null ? (
					<LinkedRepository
						projectId={project.id}
						link={link}
						canUnlink={canEdit}
					/>
				) : !canEdit ? (
					<p
						className={cn(PANEL_CARD_ROW_CLASS, PANEL_HINT_CLASS, "mt-5 pt-4")}
					>
						{t("sharing.readOnly.editorsOnly")}
					</p>
				) : account.data === undefined ? (
					account.isError ? (
						<p className="mt-4 font-sans text-[13px] text-destructive">
							{getApiErrorMessage(account.error)}
						</p>
					) : (
						<Skeleton className="mt-5 h-10 rounded-full" />
					)
				) : account.data.connected ? (
					<CreateRepositoryForm project={project} account={account.data} />
				) : (
					<ConnectRow />
				)}
			</section>
			<ul className="flex flex-col gap-1.5 px-1 font-sans text-[13px] text-night/60 dark:text-foreground/60">
				{SYNC_NOTES.map((note) => (
					<li key={note} className="flex items-start gap-2">
						<InfoIcon
							aria-hidden
							weight="fill"
							className="mt-px size-4 shrink-0 text-ember-text"
						/>
						{t(note)}
					</li>
				))}
			</ul>
		</>
	);
}

/**
 * The builder URL that GitHub sends the user back to: this page with the
 * Integrations panel open. The API refuses a URL on another origin.
 */
function integrationsReturnUrl(): string {
	const url = new URL(window.location.href);
	url.searchParams.set("view", "more");
	url.searchParams.set("panel", "integrations");
	return url.toString();
}

/**
 * Starts a GitHub connect or App install and leaves for GitHub. The button
 * stays off after a success too. A second click stores a new OAuth state, so
 * the first return fails as `invalid_state`. Back from GitHub turns it on again.
 */
function useLeaveForGithub() {
	const authorize = useStartGithubAuthorize();
	const { reset } = authorize;
	// Back from GitHub can restore this page from the bfcache with the success
	// still set. The user is on this page again, so the buttons turn on.
	useEffect(() => {
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) {
				reset();
			}
		};
		window.addEventListener("pageshow", onPageShow);
		return () => window.removeEventListener("pageshow", onPageShow);
	}, [reset]);
	return {
		isLeaving: authorize.isPending || authorize.isSuccess,
		leave: (flow: GithubAuthorizeBody["flow"]) =>
			authorize.mutate({ returnUrl: integrationsReturnUrl(), flow }),
	};
}

/** The user has no GitHub token: one hint and the Connect button. */
function ConnectRow() {
	const { t } = useTranslation();
	const { isLeaving, leave } = useLeaveForGithub();
	return (
		<div
			className={cn(
				PANEL_CARD_ROW_CLASS,
				"mt-5 flex flex-wrap items-center justify-between gap-4 pt-4",
			)}
		>
			<p className={PANEL_HINT_CLASS}>{t("appBuilder.github.connectHint")}</p>
			<Button
				className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
				disabled={isLeaving}
				onClick={() => leave("authorize")}
			>
				<GithubLogoIcon weight="fill" aria-hidden />
				{t("appBuilder.github.connect")}
			</Button>
		</div>
	);
}

/** The owner, the repo name, and Private, then "Create repository". Owners are the App installations of the user. */
function CreateRepositoryForm({
	project,
	account,
}: {
	project: AppProject;
	/** The account answer with `connected: true`. */
	account: GithubAccountResponse;
}) {
	const { t } = useTranslation();
	const { isLeaving, leave } = useLeaveForGithub();
	const create = useCreateGithubRepository(project.id);
	const ownerId = useId();
	const nameId = useId();
	const nameErrorId = useId();
	const privateId = useId();
	// Undefined until the user picks an owner. Until then, the first installation is the owner.
	const [installationId, setInstallationId] = useState<number | undefined>(
		undefined,
	);
	const [name, setName] = useState(() =>
		slugify(project.name, FALLBACK_REPO_NAME),
	);
	// Product rule: a new repo is private unless the user turns it public.
	const [isPrivate, setIsPrivate] = useState(true);
	// A refetch can drop the picked installation, so the pick falls back to the first one.
	const owner =
		account.installations.find(
			(installation) => installation.id === installationId,
		) ?? account.installations[0];
	// The route schema checks the name, so Create never sends a name that the route schema refuses.
	const isNameValid =
		createGithubRepositoryBodySchema.shape.name.safeParse(name).success;

	return (
		<div className={cn(PANEL_CARD_ROW_CLASS, "mt-5 flex flex-col gap-4 pt-4")}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				{account.login !== null ? (
					<PanelChip>
						{t("appBuilder.github.connectedAs", { login: account.login })}
					</PanelChip>
				) : null}
				<Button
					variant="outline"
					size="sm"
					className={cn(PANEL_SECONDARY_BUTTON_CLASS, "ms-auto")}
					disabled={isLeaving}
					onClick={() => leave("install")}
				>
					{t("appBuilder.github.addOwner")}
				</Button>
			</div>
			{owner === undefined ? (
				<p className={PANEL_HINT_CLASS}>
					{t("appBuilder.github.noInstallations")}
				</p>
			) : (
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!isNameValid) return;
						create.mutate({
							installationId: owner.id,
							name,
							private: isPrivate,
						});
					}}
				>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<Field className="gap-2">
							<FieldLabel htmlFor={ownerId} className={PANEL_FIELD_LABEL_CLASS}>
								{t("appBuilder.github.owner")}
							</FieldLabel>
							<Select
								value={String(owner.id)}
								onValueChange={(value) => {
									const next = account.installations.find(
										(installation) => String(installation.id) === value,
									);
									if (next) setInstallationId(next.id);
								}}
							>
								{/* A GitHub login reads left to right in every locale. */}
								<SelectTrigger
									id={ownerId}
									dir="ltr"
									className={cn(
										PANEL_SECONDARY_BUTTON_CLASS,
										// A field, not a button: no lift and no press.
										"w-full rounded-full px-4 shadow-none active:translate-y-0 data-[size=default]:h-10",
									)}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{account.installations.map((installation) => (
										<SelectItem
											key={installation.id}
											value={String(installation.id)}
										>
											{installation.accountLogin}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field className="gap-2">
							<FieldLabel htmlFor={nameId} className={PANEL_FIELD_LABEL_CLASS}>
								{t("appBuilder.github.repoName")}
							</FieldLabel>
							{/* A repo name holds latin letters only, so it reads left to right in every locale. */}
							<Input
								id={nameId}
								dir="ltr"
								value={name}
								maxLength={GITHUB_REPO_NAME_MAX_LENGTH}
								aria-invalid={!isNameValid}
								aria-describedby={isNameValid ? undefined : nameErrorId}
								className={cn(PANEL_INPUT_CLASS, "font-mono text-[13px]")}
								onChange={(event) => setName(event.target.value)}
							/>
							{isNameValid ? null : (
								<FieldDescription
									id={nameErrorId}
									className="font-sans text-[13px] text-destructive"
								>
									{t("appBuilder.github.repoNameInvalid")}
								</FieldDescription>
							)}
						</Field>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-4">
						<label htmlFor={privateId} className="flex items-center gap-3">
							<Switch
								id={privateId}
								checked={isPrivate}
								onCheckedChange={setIsPrivate}
							/>
							<span>
								<span className="block font-grotesk font-medium text-[14px] text-night dark:text-foreground">
									{t("appBuilder.github.private")}
								</span>
								<span className={cn(PANEL_HINT_CLASS, "block")}>
									{t("appBuilder.github.privateHelp")}
								</span>
							</span>
						</label>
						<Button
							type="submit"
							className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
							disabled={!isNameValid || create.isPending}
						>
							{t("appBuilder.github.create")}
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}

/** The linked repo: its link, the last synced commit, the last sync error, and Unlink with a confirm. */
function LinkedRepository({
	projectId,
	link,
	canUnlink,
}: {
	projectId: string;
	link: ProjectGithubLink;
	/** False for a project viewer: the Unlink button does not show. */
	canUnlink: boolean;
}) {
	const { t } = useTranslation();
	const unlink = useUnlinkGithubRepository(projectId);
	const repoPath = `${link.repoOwner}/${link.repoName}`;

	return (
		<div className={cn(PANEL_CARD_ROW_CLASS, "mt-5 flex flex-col gap-3 pt-4")}>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="min-w-0">
					{/* An owner/repo path reads left to right in every locale. */}
					<a
						href={link.htmlUrl}
						target="_blank"
						rel="noreferrer"
						dir="ltr"
						className="block truncate font-medium font-mono text-[13.5px] text-night underline-offset-4 hover:underline dark:text-foreground"
					>
						{repoPath}
					</a>
					<p className={PANEL_HINT_CLASS}>
						{link.lastSyncedSha === null
							? t("appBuilder.github.neverSynced")
							: t("appBuilder.github.lastSynced", {
									sha: link.lastSyncedSha.slice(0, SHORT_SHA_LENGTH),
								})}
					</p>
				</div>
				{canUnlink ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={PANEL_SECONDARY_BUTTON_CLASS}
								disabled={unlink.isPending}
							>
								{t("appBuilder.github.unlink")}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{t("appBuilder.github.unlinkConfirmTitle", {
										repo: repoPath,
									})}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{t("appBuilder.github.unlinkConfirmBody")}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>
									{t("appBuilder.github.cancel")}
								</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={() => unlink.mutate()}
								>
									{t("appBuilder.github.unlink")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>
			{link.lastError !== null ? (
				<p
					role="alert"
					className="flex items-start gap-2 font-sans text-[13px] text-destructive"
				>
					<WarningCircleIcon
						aria-hidden
						weight="fill"
						className="mt-px size-4 shrink-0"
					/>
					{t(`appBuilder.github.syncErrors.${link.lastError}`)}
				</p>
			) : null}
		</div>
	);
}
