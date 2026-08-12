import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Spark } from "@/components/logo";
import {
	InsufficientCreditsDialog,
	OutOfCreditsBanner,
	useOutOfCredits,
} from "@/features/credits";
import { PendingInvitesBanner } from "@/features/workspaces/components/pending-invites-banner";
import { useTranslation } from "@/lib/i18n";
import type { Project } from "../api/dto";
import { useProjectsQuery } from "../api/projects.queries";
import { ProjectCard } from "../components/project-card";
import { PromptBox } from "../components/prompt-box";
import { DashboardShell } from "../components/shell/dashboard-shell";
import { GRID_SKELETON_COUNT } from "../lib/constants";
import { useCreateProjectWithPrompt } from "../lib/hooks";

type StatusFilter = "all" | "published" | "drafts";

function matchesFilter(project: Project, filter: StatusFilter): boolean {
	if (filter === "all") return true;
	if (filter === "published") return project.status === "published";
	return project.status !== "published";
}

function CardSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<Skeleton className="aspect-video rounded-none" />
			<div className="space-y-2.5 p-3.5">
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-3 w-1/2" />
			</div>
		</div>
	);
}

function EmptyState({ onCta }: { onCta: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="relative flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-dots"
			/>
			<div className="relative flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
				<Spark className="size-5 text-primary" />
			</div>
			<h3 className="relative mt-4 font-display font-semibold text-lg">
				{t("projects.emptyTitle")}
			</h3>
			<p className="relative mt-1 max-w-xs text-muted-foreground text-sm">
				{t("projects.emptyBody")}
			</p>
			<Button onClick={onCta} className="relative mt-5">
				{t("projects.emptyCta")}
			</Button>
		</div>
	);
}

function NoResultsState({
	query,
	onClear,
}: {
	query: string;
	onClear: () => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
			<h3 className="font-display font-semibold text-base">
				{t("projects.noResultsTitle")}
			</h3>
			<p className="mt-1 max-w-xs text-muted-foreground text-sm">
				{query
					? t("projects.noResultsBody", { query })
					: t("projects.noResultsBodyEmpty")}
			</p>
			<Button variant="outline" size="sm" onClick={onClear} className="mt-4">
				{t("projects.clearFilters")}
			</Button>
		</div>
	);
}

export default function DashboardPage() {
	const { t } = useTranslation();
	const { data: projects, isPending } = useProjectsQuery();
	const {
		create,
		isCreating,
		insufficientOpen,
		setInsufficientOpen,
		cost,
		restoreKey,
		restoredPrompt,
		restoredComposer,
	} = useCreateProjectWithPrompt({ autostartStashedPrompt: true });

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
				{/* Prompt section */}
				<section className="relative py-10 md:py-14">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-dots"
					/>
					<div className="relative mx-auto w-full max-w-2xl">
						<h2 className="text-center font-display font-semibold text-2xl tracking-tight md:text-3xl">
							{t("projects.promptHeading")}
						</h2>
						<div ref={promptSectionRef} className="mt-6">
							<OutOfCreditsBanner active={promptLocked}>
								<PromptBox
									key={restoreKey}
									variant="hero"
									showPriceTag
									showModes
									attachmentsEnabled
									disabled={promptLocked}
									initialValue={restoredPrompt}
									initialComposer={restoredComposer}
									onSubmit={create}
									isSubmitting={isCreating}
								/>
							</OutOfCreditsBanner>
						</div>
						<InsufficientCreditsDialog
							open={insufficientOpen}
							onOpenChange={setInsufficientOpen}
							cost={cost}
						/>
					</div>
				</section>

				{/* Toolbar */}
				<section>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
						<div className="flex items-baseline gap-2">
							<h2 className="font-display font-semibold text-lg tracking-tight">
								{t("projects.toolbarTitle")}
							</h2>
							{projects ? (
								<span className="font-mono text-muted-foreground text-xs">
									{projects.length}
								</span>
							) : null}
						</div>
						<div className="ms-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
							<div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
								<Search
									aria-hidden
									className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder={t("projects.searchPlaceholder")}
									className="h-8 ps-8 text-sm"
									aria-label={t("projects.searchPlaceholder")}
								/>
							</div>
							<Tabs
								value={filter}
								onValueChange={(value) => setFilter(value as StatusFilter)}
							>
								<TabsList className="h-8">
									<TabsTrigger value="all" className="text-xs">
										{t("projects.filterAll")}
									</TabsTrigger>
									<TabsTrigger value="published" className="text-xs">
										{t("projects.filterPublished")}
									</TabsTrigger>
									<TabsTrigger value="drafts" className="text-xs">
										{t("projects.filterDrafts")}
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>

					{/* Grid */}
					<div className="mt-5">
						{isPending ? (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
								{Array.from({ length: GRID_SKELETON_COUNT }, (_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
									<CardSkeleton key={i} />
								))}
							</div>
						) : filtered.length > 0 ? (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
