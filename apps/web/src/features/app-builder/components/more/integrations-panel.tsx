/**
 * Integrations panel of the More view: the GitHub sync of the project, and
 * the Download card under it. The GitHub part shows one of four states. The
 * App is not set up, the user is not connected, the user can create a repo,
 * or the repo is linked. The linked state has three cards: the connection
 * table, the sync card with Re-check and Update, and the clone commands. A project viewer sees the status read-only: a note in place of
 * Connect and Create, and no Unlink or Update. The Download card shows for
 * every project and every role.
 * Rendered by components/more/more-view.tsx inside PanelShell. Reads
 * github.queries.ts and calls github.mutations.ts. The Update pull comes from
 * the page through more-view.tsx, so the chat banner and this panel share it.
 */

import type { Icon } from "@phosphor-icons/react";
import { ArrowCircleDownIcon } from "@phosphor-icons/react/ArrowCircleDown";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/ArrowsClockwise";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { GitBranchIcon } from "@phosphor-icons/react/GitBranch";
import { GithubLogoIcon } from "@phosphor-icons/react/GithubLogo";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { LinkBreakIcon } from "@phosphor-icons/react/LinkBreak";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery } from "@tanstack/react-query";
import {
	createGithubRepositoryBodySchema,
	type GithubAccountResponse,
	type GithubAuthorizeBody,
	type ProjectGithubLink,
	type ProjectGithubStatusResponse,
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
} from "@wandit/ui/components/alert-dialog";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useId, useState } from "react";

import { hasProjectRole } from "@/features/project-sharing";
import { slugify } from "@/features/workspace";
import { getApiErrorMessage } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import type { AppProject } from "../../api/dto";
import {
	useCreateGithubRepository,
	useDownloadProjectCode,
	useRecheckGithub,
	useStartGithubAuthorize,
	useUnlinkGithubRepository,
} from "../../api/github.mutations";
import {
	githubAccountQuery,
	projectGithubStatusQuery,
} from "../../api/github.queries";
import { copyToClipboard } from "../../lib/helpers";
import {
	PANEL_CARD_CLASS,
	PANEL_CARD_ROW_CLASS,
	PANEL_CARD_TITLE_CLASS,
	PANEL_FIELD_LABEL_CLASS,
	PANEL_HINT_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PANEL_TABS_LIST_CLASS,
	PANEL_TABS_TRIGGER_CLASS,
	PanelChip,
	PanelMessage,
} from "./panel-shell";

/**
 * The Update pull that pages/app-builder-page.tsx owns. The chat banner and
 * this panel share it, so both buttons lock while it runs, and a success reloads the preview.
 */
export type GithubUpdateControl = {
	/** True while the pull runs. The Update button stays off. */
	isUpdating: boolean;
	/** Starts the pull. The argument is the `headSha` of the last status answer. */
	onUpdate: (expectedHeadSha: ProjectGithubStatusResponse["headSha"]) => void;
};

/** Props from components/more/more-view.tsx. The view renders this panel when the More nav selects "integrations". */
export type IntegrationsPanelProps = {
	/** The project the page reads from appProjectQuery. Its name gives the default repo name and the archive name. */
	project: AppProject;
	/** True while this panel is on screen: the More view is open and the code screen does not cover it. The view stays mounted, so the account query waits for it. */
	isActive: boolean;
	githubUpdate: GithubUpdateControl;
};

/** Repo name and archive name for a project name with no latin letters, for example an Arabic name. The user can change the repo name. */
const FALLBACK_REPO_NAME = "wandit-app";

/** GitHub refuses a longer repo name. The regex of `createGithubRepositoryBodySchema` has the same limit. */
const GITHUB_REPO_NAME_MAX_LENGTH = 100;

/** The sync rules that can surprise a user: the branch, the conflict winner, and the workflow guard of the worker. */
const SYNC_NOTES = [
	"appBuilder.github.notes.mainOnly",
	"appBuilder.github.notes.githubWins",
	"appBuilder.github.notes.workflows",
] as const satisfies readonly TranslationKey[];

/** The GitHub part, then the Download card. The GitHub part can show a loading or error state; the Download card always shows. */
export function IntegrationsPanel({
	project,
	isActive,
	githubUpdate,
}: IntegrationsPanelProps) {
	return (
		<>
			<GithubSection
				project={project}
				isActive={isActive}
				githubUpdate={githubUpdate}
			/>
			<DownloadCodeCard project={project} />
		</>
	);
}

/** The GitHub card or the linked layout in the state of the project status, and the notes of the sync. */
function GithubSection({
	project,
	isActive,
	githubUpdate,
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

	const { link, headSha } = status.data;
	return (
		<>
			{link !== null ? (
				<LinkedRepository
					projectId={project.id}
					link={link}
					headSha={headSha}
					canEdit={canEdit}
					githubUpdate={githubUpdate}
				/>
			) : (
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
					{!canEdit ? (
						<p
							className={cn(
								PANEL_CARD_ROW_CLASS,
								PANEL_HINT_CLASS,
								"mt-5 pt-4",
							)}
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
			)}
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

/** The linked state: the connection table, the sync card, and the clone commands. */
function LinkedRepository({
	projectId,
	link,
	headSha,
	canEdit,
	githubUpdate,
}: {
	projectId: string;
	link: ProjectGithubLink;
	/** `headSha` of the status answer. The Update pull sends it back as `expectedHeadSha`. */
	headSha: ProjectGithubStatusResponse["headSha"];
	/** False for a project viewer: no Unlink and no Update. */
	canEdit: boolean;
	githubUpdate: GithubUpdateControl;
}) {
	return (
		<>
			<RepositoryConnection
				projectId={projectId}
				link={link}
				canUnlink={canEdit}
			/>
			<SyncStatusCard
				projectId={projectId}
				link={link}
				headSha={headSha}
				canUpdate={canEdit}
				githubUpdate={githubUpdate}
			/>
			<CloneRepository link={link} />
		</>
	);
}

/** One table row: the owner avatar and the repo link, the branch, and the status menu with Open and Unlink. */
function RepositoryConnection({
	projectId,
	link,
	canUnlink,
}: {
	projectId: string;
	link: ProjectGithubLink;
	/** False for a project viewer: the menu has no Unlink. */
	canUnlink: boolean;
}) {
	const { t } = useTranslation();
	const unlink = useUnlinkGithubRepository(projectId);
	// The menu item opens the dialog. A dialog inside the menu closes with the menu.
	const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);
	const repoPath = `${link.repoOwner}/${link.repoName}`;
	const hasError = link.lastError !== null;

	return (
		<section className="flex flex-col gap-2.5">
			<h2 className={cn(PANEL_CARD_TITLE_CLASS, "px-1")}>
				{t("appBuilder.github.connection.title")}
			</h2>
			<div className={cn(PANEL_CARD_CLASS, "overflow-hidden px-3")}>
				<Table>
					<TableHeader>
						<TableRow className="border-night/[0.07] hover:bg-transparent dark:border-white/[0.07]">
							<TableHead className={PANEL_FIELD_LABEL_CLASS}>
								{t("appBuilder.github.connection.repository")}
							</TableHead>
							<TableHead className={PANEL_FIELD_LABEL_CLASS}>
								<span className="flex items-center gap-1">
									{t("appBuilder.github.connection.branch")}
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												aria-label={t(
													"appBuilder.github.connection.branchInfo",
												)}
												className="grid place-items-center rounded-full text-night/45 hover:text-night dark:text-foreground/45 dark:hover:text-foreground"
											>
												<InfoIcon aria-hidden className="size-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="top">
											{t("appBuilder.github.connection.branchInfo")}
										</TooltipContent>
									</Tooltip>
								</span>
							</TableHead>
							{/* The status column needs no head: the dot and the word say what it is. */}
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow className="hover:bg-transparent">
							{/* w-full with max-w-0 lets the repo path truncate inside an auto table. */}
							<TableCell className="w-full max-w-0 py-3">
								<div className="flex min-w-0 items-center gap-2.5">
									<Avatar size="sm">
										{/* github.com/<owner>.png redirects to the avatar of the user or the org. */}
										<AvatarImage
											src={`https://github.com/${encodeURIComponent(link.repoOwner)}.png?size=64`}
											alt=""
										/>
										<AvatarFallback className="bg-night text-paper dark:bg-white/[0.08] dark:text-foreground">
											<GithubLogoIcon weight="fill" className="size-3.5" />
										</AvatarFallback>
									</Avatar>
									{/* An owner/repo path reads left to right in every locale. */}
									<a
										href={link.htmlUrl}
										target="_blank"
										rel="noreferrer"
										dir="ltr"
										className="truncate font-medium font-mono text-[13.5px] text-night underline-offset-4 hover:underline dark:text-foreground"
									>
										{repoPath}
									</a>
								</div>
							</TableCell>
							<TableCell className="py-3">
								{/* Product rule: only main syncs, so the branch is a fixed chip and not a picker. */}
								<PanelChip className="font-mono">
									<GitBranchIcon aria-hidden className="size-3.5" />
									main
								</PanelChip>
							</TableCell>
							<TableCell className="py-3 text-end">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className={PANEL_SECONDARY_BUTTON_CLASS}
										>
											<span
												aria-hidden
												className={cn(
													"size-2 rounded-full",
													hasError ? "bg-destructive" : "bg-success",
												)}
											/>
											{t(
												hasError
													? "appBuilder.github.connection.syncError"
													: "appBuilder.github.connection.connected",
											)}
											<CaretDownIcon aria-hidden className="size-3.5" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<a href={link.htmlUrl} target="_blank" rel="noreferrer">
												<ArrowSquareOutIcon aria-hidden />
												{t("appBuilder.github.connection.openOnGithub")}
											</a>
										</DropdownMenuItem>
										{canUnlink ? (
											<DropdownMenuItem
												variant="destructive"
												disabled={unlink.isPending}
												onSelect={() => setIsUnlinkOpen(true)}
											>
												<LinkBreakIcon aria-hidden />
												{t("appBuilder.github.unlink")}
											</DropdownMenuItem>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>
			{canUnlink ? (
				<AlertDialog open={isUnlinkOpen} onOpenChange={setIsUnlinkOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("appBuilder.github.unlinkConfirmTitle", { repo: repoPath })}
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
		</section>
	);
}

/**
 * The sync state, Re-check, and the last sync and check times. The states
 * go in this order: a sync error, no first sync, GitHub ahead, in sync.
 */
function SyncStatusCard({
	projectId,
	link,
	headSha,
	canUpdate,
	githubUpdate,
}: {
	projectId: string;
	link: ProjectGithubLink;
	/** `headSha` of the status answer. The Update pull sends it back as `expectedHeadSha`. */
	headSha: ProjectGithubStatusResponse["headSha"];
	/** Product rule: a pull needs the editor role (workspaces-sharing.md 2.2). */
	canUpdate: boolean;
	githubUpdate: GithubUpdateControl;
}) {
	const { t } = useTranslation();
	const recheck = useRecheckGithub(projectId);
	// relativeTime reads the clock only on a render. A poll with the same data does not render again.
	// This 30 s tick renders the card, so "Checked just now" does not stay on screen after it is false.
	const [, setTick] = useState(0);
	useEffect(() => {
		const tickId = setInterval(() => setTick((tick) => tick + 1), 30_000);
		return () => clearInterval(tickId);
	}, []);
	const isUpdateState =
		link.lastError === null &&
		link.lastSyncedSha !== null &&
		link.updateAvailable;
	// After a sync, `lastSyncedSha` equals our head. A new turn or a pull merge
	// moves our head first, and the sync run pushes it a moment later.
	const isPushPending =
		headSha !== null &&
		link.lastSyncedSha !== null &&
		headSha !== link.lastSyncedSha;
	const times = [
		link.lastSyncedAt === null
			? null
			: t("appBuilder.github.sync.lastSynced", {
					time: relativeTime(link.lastSyncedAt),
				}),
		link.githubCheckedAt === null
			? null
			: t("appBuilder.github.sync.checked", {
					time: relativeTime(link.githubCheckedAt),
				}),
	].filter((part) => part !== null);

	let state: {
		icon: Icon;
		/** Color of the state icon. */
		iconClassName: string;
		title: string;
		text: string;
	};
	if (link.lastError !== null) {
		state = {
			icon: WarningCircleIcon,
			iconClassName: "text-destructive",
			title: t("appBuilder.github.connection.syncError"),
			text: t(`appBuilder.github.syncErrors.${link.lastError}`),
		};
	} else if (link.lastSyncedSha === null) {
		state = {
			icon: ArrowsClockwiseIcon,
			iconClassName: "text-night/55 dark:text-foreground/60",
			title: t("appBuilder.github.sync.firstSyncTitle"),
			text: t("appBuilder.github.sync.firstSyncText"),
		};
	} else if (isUpdateState) {
		state = {
			icon: ArrowCircleDownIcon,
			iconClassName: "text-ember-text",
			title: t("appBuilder.github.sync.updateTitle"),
			text: t("appBuilder.github.sync.updateText"),
		};
	} else if (isPushPending) {
		state = {
			icon: ArrowsClockwiseIcon,
			iconClassName: "text-night/55 dark:text-foreground/60",
			title: t("appBuilder.github.sync.pushPendingTitle"),
			text: t("appBuilder.github.sync.pushPendingText"),
		};
	} else {
		state = {
			icon: CheckCircleIcon,
			iconClassName: "text-success-text",
			title: t("appBuilder.github.sync.inSyncTitle"),
			text: t("appBuilder.github.sync.inSyncText"),
		};
	}
	const StateIcon = state.icon;

	return (
		<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 p-5")}>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-2.5">
					<StateIcon
						aria-hidden
						weight="fill"
						className={cn("mt-px size-5 shrink-0", state.iconClassName)}
					/>
					<div className="min-w-0">
						<p className={PANEL_CARD_TITLE_CLASS}>{state.title}</p>
						<p
							role={link.lastError !== null ? "alert" : undefined}
							className="font-sans text-[14px] text-night/75 dark:text-foreground/75"
						>
							{state.text}
						</p>
						{times.length > 0 ? (
							<p className={cn(PANEL_HINT_CLASS, "mt-1")}>
								{times.join(" · ")}
							</p>
						) : null}
					</div>
				</div>
				<div className="ms-auto flex items-center gap-2">
					{/* Same rule as the chat banner: Update shows on `updateAvailable`, also next to a sync error. */}
					{link.updateAvailable && canUpdate ? (
						<Button
							size="sm"
							className={PANEL_PRIMARY_BUTTON_CLASS}
							disabled={githubUpdate.isUpdating}
							onClick={() => githubUpdate.onUpdate(headSha)}
						>
							{t("appBuilder.github.banner.update")}
						</Button>
					) : null}
					<Button
						variant="outline"
						size="sm"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						disabled={recheck.isPending}
						onClick={() => recheck.mutate()}
					>
						<ArrowsClockwiseIcon
							aria-hidden
							className={cn(recheck.isPending && "animate-spin")}
						/>
						{t("appBuilder.github.sync.recheck")}
					</Button>
				</div>
			</div>
		</section>
	);
}

/** Tabs of the clone card. The labels are protocol and tool names, so they read the same in every locale. */
const CLONE_METHODS = [
	{ value: "https", label: "HTTPS" },
	{ value: "ssh", label: "SSH" },
	{ value: "cli", label: "GitHub CLI" },
] as const;

/** One tab value of CLONE_METHODS. */
type CloneMethod = (typeof CLONE_METHODS)[number]["value"];

/** 2 s: the check icon of the copy button shows that long, then the copy icon comes back. */
const COPIED_RESET_MS = 2_000;

/** The clone command of the repo for one tab, as GitHub shows it on the Code button. */
function cloneCommand(method: CloneMethod, repoPath: string): string {
	switch (method) {
		case "https":
			return `https://github.com/${repoPath}.git`;
		case "ssh":
			return `git@github.com:${repoPath}.git`;
		case "cli":
			return `gh repo clone ${repoPath}`;
	}
}

/** The HTTPS, SSH, and GitHub CLI tabs, a read-only command field, and a copy button. */
function CloneRepository({ link }: { link: ProjectGithubLink }) {
	const { t } = useTranslation();
	const [method, setMethod] = useState<CloneMethod>("https");
	const [isCopied, setIsCopied] = useState(false);
	const command = cloneCommand(method, `${link.repoOwner}/${link.repoName}`);

	useEffect(() => {
		if (!isCopied) return;
		const timer = window.setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
		return () => window.clearTimeout(timer);
	}, [isCopied]);

	const copyLabel = t(
		isCopied
			? "appBuilder.github.clone.copied"
			: "appBuilder.github.clone.copy",
	);

	return (
		<section className="flex flex-col gap-2.5">
			<h2 className={cn(PANEL_CARD_TITLE_CLASS, "px-1")}>
				{t("appBuilder.github.clone.title")}
			</h2>
			<div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3 p-5")}>
				<Tabs
					value={method}
					onValueChange={(value) => {
						const next = CLONE_METHODS.find((item) => item.value === value);
						if (next) {
							setMethod(next.value);
							setIsCopied(false);
						}
					}}
				>
					<TabsList className={PANEL_TABS_LIST_CLASS}>
						{CLONE_METHODS.map((item) => (
							<TabsTrigger
								key={item.value}
								value={item.value}
								className={PANEL_TABS_TRIGGER_CLASS}
							>
								{item.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{/* A command reads left to right in every locale. */}
				<div dir="ltr" className="flex items-center gap-2">
					<Input
						readOnly
						value={command}
						aria-label={t("appBuilder.github.clone.command")}
						className={cn(PANEL_INPUT_CLASS, "font-mono text-[13px]")}
						onFocus={(event) => event.currentTarget.select()}
					/>
					<Button
						variant="outline"
						size="icon-lg"
						className={PANEL_SECONDARY_BUTTON_CLASS}
						aria-label={copyLabel}
						title={copyLabel}
						onClick={() => {
							void copyToClipboard(command).then(setIsCopied);
						}}
					>
						{isCopied ? (
							<CheckIcon aria-hidden className="text-success-text" />
						) : (
							<CopyIcon aria-hidden />
						)}
					</Button>
				</div>
			</div>
		</section>
	);
}

/**
 * The Download card. It shows for every V2 project, with or without a GitHub
 * link. A project viewer may download too.
 */
function DownloadCodeCard({ project }: { project: AppProject }) {
	const { t } = useTranslation();
	const download = useDownloadProjectCode(
		project.id,
		`${slugify(project.name, FALLBACK_REPO_NAME)}.tar.gz`,
	);

	return (
		<section
			className={cn(
				PANEL_CARD_CLASS,
				"flex flex-wrap items-center justify-between gap-4 p-5",
			)}
		>
			<div className="min-w-0">
				<h2 className={PANEL_CARD_TITLE_CLASS}>
					{t("appBuilder.code.download.title")}
				</h2>
				<p className={PANEL_HINT_CLASS}>{t("appBuilder.code.download.hint")}</p>
			</div>
			<Button
				variant="outline"
				className={cn(PANEL_SECONDARY_BUTTON_CLASS, "h-10 px-5")}
				disabled={download.isPending}
				onClick={() => download.mutate()}
			>
				<DownloadSimpleIcon aria-hidden />
				{t("appBuilder.code.download.button")}
			</Button>
		</section>
	);
}
