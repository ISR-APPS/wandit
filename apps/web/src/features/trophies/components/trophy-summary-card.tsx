/**
 * Trophy summary card: the level ring, the level name, and the points to the next level.
 * It also shows the 3 locked trophies nearest to their target, and a link to /trophies.
 * The wallet page renders it. It reads useTrophiesQuery: the session user, in every workspace.
 */
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { Link } from "@tanstack/react-router";
import type { TrophiesResponse } from "@wandit/contracts";
import { formatNumber, type Locale } from "@wandit/internationalization";
import { Progress } from "@wandit/ui/components/progress";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { useDictionary, useTranslation } from "@/lib/i18n";
import { useTrophiesQuery } from "../api/trophies.queries";
import {
	levelProgressRatio,
	nearestTrophies,
	nextLevelId,
	toTrophyViews,
} from "../lib/helpers";
import { useTrophyText } from "../lib/hooks";
import { LevelRing } from "./level-ring";
import { TrophyMedallion } from "./trophy-medallion";

/** `className` lets the wallet page give the card its own frame (ring, radius, shadow). */
export function TrophySummaryCard({ className }: { className?: string }) {
	const { t } = useTranslation();
	// The card is the entry point of the trophies, so it shows the newest state on each visit.
	const trophiesQuery = useTrophiesQuery({ refetchOnMount: "always" });

	return (
		<section className={cn("p-5 sm:p-6", className)}>
			{trophiesQuery.isPending ? (
				<div aria-hidden className="grid gap-4">
					<div className="flex items-center gap-4">
						<Skeleton className="size-14 rounded-full" />
						<div className="grid flex-1 gap-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-6 w-40" />
						</div>
					</div>
					<Skeleton className="h-36 w-full rounded-2xl" />
				</div>
			) : trophiesQuery.isError ? (
				<p role="alert" className="text-muted-foreground text-sm">
					{t("trophies.summary.loadError")}
				</p>
			) : (
				<SummaryBody response={trophiesQuery.data} />
			)}
		</section>
	);
}

function SummaryBody({ response }: { response: TrophiesResponse }) {
	const { locale, t } = useTranslation();
	const levelNames = useDictionary().trophies.levels;
	const trophyText = useTrophyText();
	const { level, points } = response;
	const nextUp = nearestTrophies(toTrophyViews(response));
	const nextId = nextLevelId(level);
	const pointsPhrase = (count: number) =>
		t("trophies.units.points", {
			count,
			countDisplay: formatNumber(count, locale),
		});

	return (
		<>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<LevelRing
					levelIndex={level.index}
					progressRatio={levelProgressRatio(points, level)}
					className="text-night dark:text-foreground"
				/>
				<div className="min-w-0 flex-1">
					<p className="flex items-center gap-2 font-grotesk font-semibold text-[11px] text-night/55 uppercase tracking-[0.08em] rtl:tracking-normal dark:text-foreground/55">
						{t("trophies.summary.title")}
						<span className="rounded-full bg-night/[0.06] px-2 py-0.5 text-[10px] text-night/60 normal-case tracking-normal dark:bg-white/10 dark:text-foreground/60">
							{t("trophies.summary.personal")}
						</span>
					</p>
					<h3 className="mt-1 font-bold font-grotesk text-night text-xl tracking-[-0.03em] dark:text-foreground">
						{t("trophies.page.level", {
							index: formatNumber(level.index, locale),
						})}
						<span
							aria-hidden
							className="mx-1.5 text-night/25 dark:text-foreground/25"
						>
							·
						</span>
						{levelNames[level.id]}
					</h3>
					<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
						{nextId === null || level.nextLevelPoints === null
							? t("trophies.page.maxLevel")
							: t("trophies.page.toNext", {
									points: pointsPhrase(level.nextLevelPoints - points),
									level: levelNames[nextId],
								})}
					</p>
				</div>
				<Link
					to="/trophies"
					className="group/see inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-grotesk font-semibold text-night text-sm outline-offset-2 ring-1 ring-night/10 transition-colors hover:bg-night/[0.04] focus-visible:outline-2 focus-visible:outline-ember dark:text-foreground dark:ring-white/15 dark:hover:bg-white/[0.06]"
				>
					{t("trophies.summary.seeAll")}
					<ArrowRightIcon
						aria-hidden
						weight="bold"
						className="size-3.5 transition-transform group-hover/see:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover/see:-translate-x-0.5"
					/>
				</Link>
			</div>

			{nextUp.length === 0 ? (
				<p className="mt-5 rounded-2xl bg-spark/[0.12] px-4 py-3 text-night text-sm ring-1 ring-spark/30 dark:text-foreground">
					{t("trophies.summary.allEarned")}
				</p>
			) : (
				<ul className="mt-5 grid gap-2">
					{nextUp.map((view) => {
						const text = trophyText(view.definition);
						return (
							<li
								key={view.definition.id}
								className="flex items-center gap-3 rounded-2xl bg-night/[0.02] p-2.5 pe-4 ring-1 ring-night/[0.05] dark:bg-white/[0.03] dark:ring-white/10"
							>
								<TrophyMedallion
									trophyId={view.definition.id}
									state={view.state}
									progressRatio={view.progressRatio}
									size="sm"
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-3">
										<p className="truncate font-grotesk font-semibold text-night text-sm dark:text-foreground">
											{text.name}
										</p>
										<p className="shrink-0 text-night/55 text-xs tabular-nums dark:text-foreground/55">
											<ProgressCount
												current={view.current ?? 0}
												target={view.definition.target}
												locale={locale}
											/>
										</p>
									</div>
									<p className="truncate text-night/55 text-xs dark:text-foreground/55">
										{text.rule}
									</p>
									<Progress
										value={view.progressRatio * 100}
										className="mt-2 h-1.5 bg-night/[0.08] dark:bg-white/10"
										indicatorColor="bg-spark"
										aria-label={text.name}
									/>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</>
	);
}

/**
 * "7 / 10" in locale digits, left to right in every locale. A decimal fact (spent credits) rounds down.
 * The summary card and the trophies page render it.
 */
export function ProgressCount({
	current,
	target,
	locale,
}: {
	/** Fact value, capped at the target by the API. */
	current: number;
	target: number;
	locale: Locale;
}) {
	return (
		<span dir="ltr">
			{formatNumber(Math.floor(current), locale)} /{" "}
			{formatNumber(target, locale)}
		</span>
	);
}
