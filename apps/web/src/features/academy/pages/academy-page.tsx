/**
 * Academy list page at `/academy`: the guide grid with the category chips.
 * The route file imports it by path. Calls the academy guides query and the
 * helpers that list and filter the categories. Each card opens a guide page.
 */
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { FunnelSimpleIcon } from "@phosphor-icons/react/FunnelSimple";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { useTranslation } from "@/lib/i18n";
import { useAcademyGuidesQuery } from "../api/academy.queries";
import { GuideCard, GuideCardSkeleton } from "../components/guide-card";
import {
	academyCategoryLabel,
	deriveCategories,
	filterGuidesByCategory,
} from "../lib/academy-helpers";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The Academy list. The category filter is local state, so a reload shows all guides again. */
export default function AcademyPage() {
	const { t } = useTranslation();
	const guidesQuery = useAcademyGuidesQuery();
	const [category, setCategory] = useState<string | null>(null);
	const guides = guidesQuery.data ?? [];
	const categories = useMemo(() => deriveCategories(guides), [guides]);
	const filteredGuides = useMemo(
		() => filterGuidesByCategory(guides, category),
		[guides, category],
	);

	return (
		<DashboardShell titleKey="academy.title">
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				<div className="mt-6 flex items-center gap-2.5">
					<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
						{t("academy.title")}
					</h2>
					{guidesQuery.data ? (
						<span className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
							{t("academy.guideCount", { count: guides.length })}
						</span>
					) : null}
				</div>
				<p className="mt-1 max-w-2xl text-night/60 text-sm leading-relaxed dark:text-foreground/60">
					{t("academy.intro")}
				</p>

				{categories.length > 0 ? (
					// The row scrolls sideways on a phone. py-1 keeps the focus outline of a chip inside the scroll box.
					<div className="-mx-4 mt-5 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
						<div className="flex w-max items-center gap-1 rounded-full bg-night/[0.05] p-1 dark:bg-white/[0.06]">
							<CategoryChip
								active={category === null}
								label={t("academy.filters.all")}
								onClick={() => setCategory(null)}
							/>
							{categories.map((item) => (
								<CategoryChip
									key={item}
									active={category === item}
									label={academyCategoryLabel(item, t)}
									onClick={() => setCategory(item)}
								/>
							))}
						</div>
					</div>
				) : null}

				<div className="mt-5">
					{guidesQuery.isPending ? (
						<GuideGrid>
							{SKELETON_KEYS.map((key) => (
								<GuideCardSkeleton key={key} />
							))}
						</GuideGrid>
					) : guidesQuery.isError ? (
						<AcademyError
							retrying={guidesQuery.isFetching}
							onRetry={() => void guidesQuery.refetch()}
						/>
					) : guides.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
							<span
								aria-hidden
								className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
							>
								<GraduationCapIcon
									weight="fill"
									className="size-7 text-spark"
								/>
							</span>
							<h3 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
								{t("academy.empty.title")}
							</h3>
							<p className="mt-2 max-w-xs text-night/60 text-sm dark:text-foreground/60">
								{t("academy.empty.body")}
							</p>
						</div>
					) : filteredGuides.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-14 text-center dark:border-white/15">
							<span
								aria-hidden
								className="grid size-12 place-items-center rounded-full bg-white text-night/70 shadow-[0_1px_0_rgb(11_16_51/0.1)] dark:bg-white/10 dark:text-foreground/70"
							>
								<FunnelSimpleIcon weight="duotone" className="size-5" />
							</span>
							<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
								{t("academy.filters.noneInCategory")}
							</h3>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="mt-4 rounded-full font-grotesk"
								onClick={() => setCategory(null)}
							>
								{t("academy.filters.showAll")}
							</Button>
						</div>
					) : (
						<GuideGrid>
							{filteredGuides.map((guide) => (
								<GuideCard key={guide.id} guide={guide} />
							))}
						</GuideGrid>
					)}
				</div>
			</div>
		</DashboardShell>
	);
}

function GuideGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
			{children}
		</div>
	);
}

/** One category filter. The selected chip is a night pill (spark in dark mode), like the dashboard filter. */
function CategoryChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			className={cn(
				"h-7 rounded-full px-3 font-grotesk font-semibold text-xs transition-colors duration-150",
				"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
				active
					? "bg-night text-paper dark:bg-spark dark:text-night"
					: "text-night/60 hover:text-night dark:text-foreground/60 dark:hover:text-foreground",
			)}
			onClick={onClick}
		>
			<span dir="auto">{label}</span>
		</button>
	);
}

/** The guide list failed to load. The retry icon spins while the refetch runs. */
function AcademyError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	/** True while the query refetches, from `isFetching`. The button is disabled then. */
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-destructive/25 border-solid bg-destructive/[0.035] px-6 py-14 text-center">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
			>
				<WarningIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("academy.error.title")}
			</h3>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4 rounded-full font-grotesk"
				disabled={retrying}
				onClick={onRetry}
			>
				<ArrowClockwiseIcon
					aria-hidden
					weight="bold"
					className={cn(
						"size-3.5",
						retrying && "animate-spin motion-reduce:animate-none",
					)}
				/>
				{t("academy.error.retry")}
			</Button>
		</div>
	);
}
