/**
 * Dashboard page at `/dashboard`: the prompt box that creates a project and
 * the project grid with search and status filters. The route file imports
 * it by path. Calls the projects queries, the V1 and V2 create hooks, the
 * credits banners, and the landing key button and platform word. It owns
 * the app type and the Plan chip of a V2 create.
 */
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import type { TargetPlatform } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import { cn } from "@wandit/ui/lib/utils";
import { useMemo, useRef, useState } from "react";

import { Spark } from "@/components/logo";
import {
	useCreateAppProjectWithPrompt,
	useV2BuilderEnabled,
} from "@/features/app-builder";
import { promptStash } from "@/features/auth";
import {
	InsufficientCreditsDialog,
	OutOfCreditsBanner,
	useOutOfCredits,
} from "@/features/credits";
import { KeycapButton, PlatformToken } from "@/features/landing";
import { PendingInvitesBanner } from "@/features/workspaces/components/pending-invites-banner";
import { useDictionary, useTranslation } from "@/lib/i18n";
import type { Project } from "../api/dto";
import { useProjectsQuery } from "../api/projects.queries";
import { ProjectCard, ProjectCardSkeleton } from "../components/project-card";
import { PromptBox } from "../components/prompt-box";
import { DashboardShell } from "../components/shell/dashboard-shell";
import { GRID_SKELETON_COUNT } from "../lib/constants";
import {
	useAutostartStashedPrompt,
	useCreateProjectWithPrompt,
} from "../lib/hooks";

type StatusFilter = "all" | "published" | "drafts";

function matchesFilter(project: Project, filter: StatusFilter): boolean {
	if (filter === "all") return true;
	if (filter === "published") return project.status === "published";
	return project.status !== "published";
}

/** No project yet: a night app tile, like the ideas wall of the landing, and the build key. */
function EmptyState({ onCta }: { onCta: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
			>
				<Spark className="size-7 text-spark" />
			</span>
			<h3 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
				{t("projects.emptyTitle")}
			</h3>
			<p className="mt-2 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("projects.emptyBody")}
			</p>
			<KeycapButton
				size="md"
				type="button"
				onClick={onCta}
				// Night focus shows on the light page, white focus on the dark page.
				className="mt-6 focus-visible:outline-night dark:focus-visible:outline-white"
			>
				<Spark className="size-4" />
				{t("projects.emptyCta")}
			</KeycapButton>
		</div>
	);
}

/** The search or the filter hides every project. Same dashed frame as the empty state, smaller. */
function NoResultsState({
	query,
	onClear,
}: {
	/** The trimmed search text. Empty when only the status filter hides the projects. */
	query: string;
	onClear: () => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-14 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-white text-night/70 shadow-[0_1px_0_rgb(11_16_51/0.1)] dark:bg-white/10 dark:text-foreground/70"
			>
				<MagnifyingGlassIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("projects.noResultsTitle")}
			</h3>
			<p className="mt-1 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{query
					? t("projects.noResultsBody", { query })
					: t("projects.noResultsBodyEmpty")}
			</p>
			<Button
				variant="outline"
				size="sm"
				onClick={onClear}
				className="mt-4 rounded-full font-grotesk"
			>
				{t("projects.clearFilters")}
			</Button>
		</div>
	);
}

export default function DashboardPage() {
	const { t } = useTranslation();
	const landingHero = useDictionary().landing.hero;
	const { data: projects, isPending } = useProjectsQuery();
	// Product rule: a user in the V2 rollout builds an app with the V2 engine;
	// every other user builds a V1 page. Both hooks run so the switch is safe.
	// LIMIT: while the public settings load, the switch answers V1, so a
	// stashed landing prompt that autostarts in that window makes a V1 page.
	// Upgrade: expose the loading state from useV2BuilderEnabled and hold
	// the autostart until it is known.
	const v2Enabled = useV2BuilderEnabled();
	// A landing draft carries the app type the visitor picked. Read it on the
	// first render: the autostart below creates with this state, and it can
	// run before an effect could set it. The title word and the mode menu of
	// the prompt box both show and set this one state.
	const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>(
		() => promptStash.peek()?.targetPlatform ?? "web",
	);
	// Product rule: Plan Mode is on by default for a new V2 app. A landing
	// draft carries its own mode, read on the first render for the same reason.
	const [isPlanMode, setIsPlanMode] = useState(
		() => (promptStash.peek()?.mode ?? "plan") === "plan",
	);
	const v1Flow = useCreateProjectWithPrompt();
	const v2Flow = useCreateAppProjectWithPrompt(
		targetPlatform,
		isPlanMode ? "plan" : "build",
	);
	const { create, isCreating, insufficientOpen, setInsufficientOpen } =
		v2Enabled ? v2Flow : v1Flow;
	// Post-auth handoff: restore the stashed landing prompt and, when the
	// draft is fresh and eligible, create the project without another click.
	const { restoreKey, restoredPrompt, restoredComposer, isAutostarting } =
		useAutostartStashedPrompt(create);

	const { outOfCredits } = useOutOfCredits();
	const promptLocked = outOfCredits;

	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<StatusFilter>("all");
	const promptSectionRef = useRef<HTMLDivElement>(null);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (projects ?? []).filter(
			(project) =>
				matchesFilter(project, filter) &&
				(!q ||
					project.name.toLowerCase().includes(q) ||
					project.prompt.toLowerCase().includes(q)),
		);
	}, [projects, query, filter]);

	const hasProjects = (projects?.length ?? 0) > 0;
	const isFiltering = query.trim().length > 0 || filter !== "all";

	const focusPrompt = () => {
		promptSectionRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		promptSectionRef.current
			?.querySelector("textarea")
			?.focus({ preventScroll: true });
	};

	const clearFilters = () => {
		setQuery("");
		setFilter("all");
	};

	return (
		<DashboardShell>
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				<PendingInvitesBanner className="mt-6" />
				{/* The prompt panel repeats the ember hero of the landing page. The first
				    screen after sign-in then looks like the landing. */}
				<section className="relative mt-4 mb-12 overflow-hidden rounded-[2rem] bg-ember px-4 py-10 md:mt-6 md:px-10 md:py-14">
					<Spark className="pointer-events-none absolute -end-12 -top-12 size-56 text-white/10 md:-end-8 md:-top-10" />
					<div className="relative mx-auto w-full max-w-2xl">
						{/* Large bold white text passes 3:1 on ember; small text would not. */}
						<h2 className="text-balance text-center font-extrabold font-grotesk text-[clamp(2rem,4.2vw,3.25rem)] text-white leading-[0.95] tracking-[-0.045em] rtl:leading-[1.3] rtl:tracking-normal">
							{/* A V2 user builds an app, so the dashboard repeats the landing
							    sentence. The platform word sets the app type of the new project. */}
							{v2Enabled ? (
								<>
									{/* On a phone the token takes its own line, and the lead words stay together. */}
									<span className="whitespace-nowrap">
										{landingHero.leadStart}
									</span>{" "}
									<PlatformToken
										platform={targetPlatform}
										onFlip={() =>
											setTargetPlatform((current) =>
												current === "mobile" ? "web" : "mobile",
											)
										}
									/>
								</>
							) : (
								t("projects.promptHeading")
							)}
						</h2>
						{/* The box is a key on an ember-deep edge, like the landing box. It
						    rises a little while its textarea has the focus. */}
						<div
							ref={promptSectionRef}
							className={cn(
								"mt-7 rounded-3xl shadow-[0_7px_0_var(--color-ember-deep)] transition-[translate,box-shadow] duration-150 ease-out has-[textarea:focus]:-translate-y-0.5 has-[textarea:focus]:shadow-[0_9px_0_var(--color-ember-deep)]",
								// The credits strip paints with the primary color, which is the
								// ember of this panel. Night replaces it while the strip shows.
								// The box is disabled then, so its own primary parts do not matter.
								promptLocked &&
									"text-night [--primary-foreground:var(--color-paper)] [--primary:var(--color-night)]",
							)}
						>
							<OutOfCreditsBanner active={promptLocked} className="rounded-3xl">
								<PromptBox
									key={restoreKey}
									variant="hero"
									showModes
									platformChoice={
										v2Enabled
											? { value: targetPlatform, onChange: setTargetPlatform }
											: undefined
									}
									planChoice={
										v2Enabled
											? { value: isPlanMode, onChange: setIsPlanMode }
											: undefined
									}
									attachmentsEnabled
									disabled={promptLocked}
									initialValue={restoredPrompt}
									initialComposer={restoredComposer}
									onSubmit={create}
									isSubmitting={isCreating || isAutostarting}
								/>
							</OutOfCreditsBanner>
						</div>
						<InsufficientCreditsDialog
							open={insufficientOpen}
							onOpenChange={setInsufficientOpen}
						/>
					</div>
				</section>

				{/* Toolbar */}
				<section>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
						<div className="flex items-center gap-2.5">
							<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
								{t("projects.toolbarTitle")}
							</h2>
							{projects ? (
								<span className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
									{projects.length}
								</span>
							) : null}
						</div>
						<div className="ms-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
							{/* On a phone the search takes the full row, so the tabs do not cut its placeholder. */}
							<div className="relative w-full sm:w-56">
								<MagnifyingGlassIcon
									aria-hidden
									weight="bold"
									className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-night/45 dark:text-foreground/50"
								/>
								<Input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder={t("projects.searchPlaceholder")}
									className="h-10 rounded-full border-night/10 bg-white ps-10 text-sm dark:border-border dark:bg-card"
									aria-label={t("projects.searchPlaceholder")}
								/>
							</div>
							<Tabs
								value={filter}
								onValueChange={(value) => setFilter(value as StatusFilter)}
							>
								{/* The selected filter is a night pill, like the language switch of the landing page. */}
								<TabsList className="h-9 rounded-full border-0 bg-night/[0.05] p-1 dark:bg-white/[0.06]">
									{(
										[
											["all", "projects.filterAll"],
											["published", "projects.filterPublished"],
											["drafts", "projects.filterDrafts"],
										] as const
									).map(([value, labelKey]) => (
										<TabsTrigger
											key={value}
											value={value}
											className="rounded-full px-3 font-grotesk font-semibold text-night/60 text-xs hover:text-night data-[state=active]:bg-night data-[state=active]:text-paper data-[state=active]:hover:text-paper dark:text-foreground/60 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-spark dark:data-[state=active]:text-night dark:hover:text-foreground dark:data-[state=active]:hover:text-night"
										>
											{t(labelKey)}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						</div>
					</div>

					{/* Grid */}
					<div className="mt-5">
						{isPending ? (
							<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
								{Array.from({ length: GRID_SKELETON_COUNT }, (_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
									<ProjectCardSkeleton key={i} />
								))}
							</div>
						) : filtered.length > 0 ? (
							<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
								{filtered.map((project) => (
									<ProjectCard key={project.id} project={project} />
								))}
							</div>
						) : hasProjects && isFiltering ? (
							<NoResultsState query={query.trim()} onClear={clearFilters} />
						) : (
							<EmptyState onCta={focusPrompt} />
						)}
					</div>
				</section>
			</div>
		</DashboardShell>
	);
}
