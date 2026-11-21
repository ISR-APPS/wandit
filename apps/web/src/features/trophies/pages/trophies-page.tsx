/**
 * The /trophies account page. It shows the level header with its 7-step path and the build-week strip.
 * It also shows the 3 nearest trophies, and one grid of keys for each track.
 * routes/_auth/trophies.tsx renders it inside DashboardShell. It reads useTrophiesQuery.
 */
import {
	TROPHY_LEVELS,
	TROPHY_POINTS,
	type TrophiesResponse,
	type TrophyRarity,
	type TrophyTrack,
	trophyTracks,
} from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import { Progress } from "@wandit/ui/components/progress";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import { DashboardShell } from "@/features/projects";
import { useDictionary, useTranslation } from "@/lib/i18n";
import { useTrophiesQuery } from "../api/trophies.queries";
import { LevelRing } from "../components/level-ring";
import { TrophyMedallion } from "../components/trophy-medallion";
import { ProgressCount } from "../components/trophy-summary-card";
import {
	levelProgressRatio,
	nearestTrophies,
	nextLevelId,
	type TrophyView,
	toTrophyViews,
} from "../lib/helpers";
import { useTrophyText } from "../lib/hooks";

// The white card of the dashboard pages, the same as on the billing and refer pages.
const CARD_CLASS =
	"rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

const SECTION_TITLE_CLASS =
	"font-bold font-grotesk text-night text-xl tracking-[-0.03em] dark:text-foreground";

// The small capitals above a title. Arabic letters join, so `rtl:` removes the letter spacing.
const EYEBROW_CLASS =
	"font-grotesk font-semibold text-[11px] uppercase tracking-[0.08em] rtl:tracking-normal";

const RARITY_DOT_CLASS = {
	common: "bg-night/30 dark:bg-foreground/40",
	rare: "bg-ember",
	epic: "bg-spark-deep dark:bg-spark",
	legendary: "bg-gradient-ember",
} as const satisfies Record<TrophyRarity, string>;

const GRID_SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Trophies belong to the user, not to a workspace, so every workspace shows the same page. */
export default function TrophiesPage() {
	const { t } = useTranslation();
	// The page is where the user checks progress, so it shows the newest state on each visit.
	const trophiesQuery = useTrophiesQuery({ refetchOnMount: "always" });

	return (
		<DashboardShell titleKey="trophies.page.title">
			<div className="mx-auto w-full max-w-5xl px-4 pb-16 md:px-6">
				{trophiesQuery.isPending ? (
					<div aria-hidden className="mt-4 md:mt-6">
						<Skeleton className="h-72 w-full rounded-[2rem]" />
						<Skeleton className="mt-4 h-36 w-full rounded-[1.5rem]" />
						<div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{GRID_SKELETON_KEYS.map((key) => (
								<Skeleton key={key} className="h-52 rounded-[1.5rem]" />
							))}
						</div>
					</div>
				) : trophiesQuery.isError ? (
					<div
						className={cn(
							CARD_CLASS,
							"mt-6 flex flex-col items-start gap-3 p-6",
						)}
					>
						<p
							role="alert"
							className="text-night/70 text-sm dark:text-foreground/70"
						>
							{t("trophies.page.loadError")}
						</p>
						<Button
							type="button"
							variant="outline"
							className="rounded-full"
							disabled={trophiesQuery.isFetching}
							onClick={() => void trophiesQuery.refetch()}
						>
							{t("trophies.page.retry")}
						</Button>
					</div>
				) : (
					<TrophiesBody response={trophiesQuery.data} />
				)}
			</div>
		</DashboardShell>
	);
}

function TrophiesBody({ response }: { response: TrophiesResponse }) {
	const { t } = useTranslation();
	const views = toTrophyViews(response);

	return (
		<>
			<LevelHeader response={response} views={views} />
			<p className="mt-4 max-w-2xl text-night/60 text-sm dark:text-foreground/60">
				{t("trophies.page.intro")}
			</p>
			<BuildWeeksCard buildWeeks={response.buildWeeks} />
			<NextUp views={views} />
			{trophyTracks.map((track) => {
				const trackViews = views.filter(
					(view) => view.definition.track === track,
				);
				if (trackViews.length === 0) return null;
				return <TrackSection key={track} track={track} views={trackViews} />;
			})}
		</>
	);
}

/** The night panel: the ring, the level name, the points, and the path of the 7 levels. */
function LevelHeader({
	response,
	views,
}: {
	response: TrophiesResponse;
	/** Every trophy of the catalog with the state of the user. */
	views: TrophyView[];
}) {
	const { locale, t } = useTranslation();
	const levelNames = useDictionary().trophies.levels;
	const { level, points } = response;
	const nextId = nextLevelId(level);
	const unlockedCount = views.filter(
		(view) => view.state === "unlocked",
	).length;
	const pointsPhrase = (count: number) =>
		t("trophies.units.points", {
			count,
			countDisplay: formatNumber(count, locale),
		});

	return (
		<section className="relative mt-4 overflow-hidden rounded-[2rem] bg-night px-5 py-8 text-paper md:mt-6 md:px-10 md:py-10 dark:ring-1 dark:ring-white/10">
			<div aria-hidden className="absolute inset-0 bg-grain" />
			<Spark className="pointer-events-none absolute -end-14 -top-14 size-64 text-white/[0.04]" />
			<div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
				<LevelRing
					levelIndex={level.index}
					progressRatio={levelProgressRatio(points, level)}
					size="lg"
					className="text-paper"
				/>
				<div className="min-w-0">
					<p className={cn(EYEBROW_CLASS, "text-spark")}>
						{t("trophies.page.eyebrow")}
					</p>
					<h2 className="mt-2 font-extrabold font-grotesk text-[clamp(2.25rem,5vw,3.5rem)] leading-[0.95] tracking-[-0.045em] rtl:leading-[1.25] rtl:tracking-normal">
						{levelNames[level.id]}
					</h2>
					<p className="mt-3 font-grotesk font-semibold text-paper/80 text-sm">
						{t("trophies.page.level", {
							index: formatNumber(level.index, locale),
						})}
						<span aria-hidden className="mx-2 text-paper/30">
							·
						</span>
						<bdi>
							{t("trophies.page.points", { points: pointsPhrase(points) })}
						</bdi>
						<span aria-hidden className="mx-2 text-paper/30">
							·
						</span>
						{t("trophies.page.unlockedCount", {
							unlocked: formatNumber(unlockedCount, locale),
							total: formatNumber(views.length, locale),
						})}
					</p>
					<p className="mt-1 text-paper/60 text-sm">
						{nextId === null || level.nextLevelPoints === null
							? t("trophies.page.maxLevel")
							: t("trophies.page.toNext", {
									points: pointsPhrase(level.nextLevelPoints - points),
									level: levelNames[nextId],
								})}
					</p>
				</div>
			</div>
			<LevelPath currentIndex={level.index} />
		</section>
	);
}

/** The 7 levels as stops on one line. Reached stops are sparks, the current stop is a lit key. */
function LevelPath({
	currentIndex,
}: {
	/** Position of the level of the user in TROPHY_LEVELS, from 1 to 7. */
	currentIndex: number;
}) {
	const { locale, t } = useTranslation();
	const levelNames = useDictionary().trophies.levels;

	return (
		<ol
			aria-label={t("trophies.page.levelPath")}
			className="relative mt-9 grid grid-cols-7"
		>
			{TROPHY_LEVELS.map((pathLevel, position) => {
				const stopIndex = position + 1;
				const isReached = stopIndex < currentIndex;
				const isCurrent = stopIndex === currentIndex;
				const isLast = stopIndex === TROPHY_LEVELS.length;
				return (
					<li
						key={pathLevel.id}
						aria-current={isCurrent ? "step" : undefined}
						className="relative flex flex-col items-center text-center"
					>
						{/* The segment to the next stop. It is spark when the user already reached the next stop. */}
						{isLast ? null : (
							<span
								aria-hidden
								className={cn(
									"absolute start-1/2 top-4 h-0.5 w-full -translate-y-1/2",
									isReached ? "bg-spark" : "bg-white/15",
								)}
							/>
						)}
						<span aria-hidden className="relative grid h-8 place-items-center">
							{isCurrent ? (
								<span className="grid size-8 place-items-center rounded-full bg-spark text-night shadow-[0_3px_0_var(--color-spark-deep)] ring-4 ring-spark/20">
									<Spark className="size-4" />
								</span>
							) : isReached ? (
								<span className="grid size-5 place-items-center rounded-full bg-night">
									<Spark className="size-4 text-spark" />
								</span>
							) : (
								<span className="size-2 rounded-full bg-white/25 ring-4 ring-night" />
							)}
						</span>
						<span
							className={cn(
								"mt-2 hidden truncate font-grotesk font-semibold text-xs sm:block",
								isCurrent
									? "text-spark"
									: isReached
										? "text-paper/80"
										: "text-paper/40",
							)}
						>
							{levelNames[pathLevel.id]}
						</span>
						<span
							className={cn(
								"mt-0.5 text-[11px] tabular-nums",
								isCurrent ? "text-paper/80" : "text-paper/35",
								// On a phone only the current stop has room for a label.
								isCurrent ? "block" : "hidden sm:block",
							)}
						>
							{/* The phone shows no name row, so the current stop names its level here. */}
							<span className="sm:hidden">{levelNames[pathLevel.id]} · </span>
							<bdi>{formatNumber(pathLevel.minPoints, locale)}</bdi>
						</span>
					</li>
				);
			})}
		</ol>
	);
}

/** The last 12 ISO weeks as keys. A week with a build is a spark key. The current week has an outline. */
function BuildWeeksCard({
	buildWeeks,
}: {
	buildWeeks: TrophiesResponse["buildWeeks"];
}) {
	const { locale, t } = useTranslation();
	const weeksPhrase = (count: number) =>
		t("trophies.units.weeks", {
			count,
			countDisplay: formatNumber(count, locale),
		});
	const builtCount = buildWeeks.recent.filter(Boolean).length;
	const lastIndex = buildWeeks.recent.length - 1;

	return (
		<section className={cn(CARD_CLASS, "mt-6 p-5 sm:p-6")}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
				<h3 className={SECTION_TITLE_CLASS}>{t("trophies.weeks.title")}</h3>
				<p className="flex flex-wrap gap-x-4 font-grotesk font-semibold text-night/70 text-sm dark:text-foreground/70">
					<span>
						{t("trophies.weeks.current", {
							weeks: weeksPhrase(buildWeeks.currentStreak),
						})}
					</span>
					<span className="text-night/45 dark:text-foreground/45">
						{t("trophies.weeks.best", {
							weeks: weeksPhrase(buildWeeks.bestStreak),
						})}
					</span>
				</p>
			</div>
			{/* Oldest week first. In RTL the strip runs from right to left, like the text. */}
			<div
				role="img"
				aria-label={t("trophies.weeks.stripLabel", {
					built: formatNumber(builtCount, locale),
					total: formatNumber(buildWeeks.recent.length, locale),
				})}
				className="mt-5 grid grid-cols-12 gap-1.5 sm:gap-2"
			>
				{buildWeeks.recent.map((isBuilt, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: one item per week, in a fixed order.
						key={index}
						className={cn(
							"aspect-square rounded-md sm:rounded-lg",
							isBuilt
								? "bg-spark shadow-[0_2px_0_var(--color-spark-deep)]"
								: "bg-night/[0.05] shadow-[inset_0_1px_2px_rgb(11_16_51/0.06)] dark:bg-white/[0.06]",
							index === lastIndex &&
								"outline-2 outline-night outline-offset-2 dark:outline-spark",
						)}
					/>
				))}
			</div>
			<p className="mt-4 text-night/50 text-xs dark:text-foreground/50">
				{t("trophies.weeks.caption")}
			</p>
		</section>
	);
}

/** The 3 locked trophies nearest to their target, each with its progress bar. */
function NextUp({ views }: { views: TrophyView[] }) {
	const { locale, t } = useTranslation();
	const trophyText = useTrophyText();
	const nextUp = nearestTrophies(views);

	return (
		<section className="mt-12">
			<h3 className={SECTION_TITLE_CLASS}>{t("trophies.page.nextUp")}</h3>
			{nextUp.length === 0 ? (
				<p className="mt-4 rounded-2xl bg-spark/[0.12] px-4 py-3 text-night text-sm ring-1 ring-spark/30 dark:text-foreground">
					{t("trophies.page.nextUpEmpty")}
				</p>
			) : (
				<ul className="mt-4 grid gap-3 md:grid-cols-3">
					{nextUp.map((view) => {
						const text = trophyText(view.definition);
						return (
							<li
								key={view.definition.id}
								className={cn(CARD_CLASS, "flex items-start gap-4 p-4")}
							>
								<TrophyMedallion
									trophyId={view.definition.id}
									state={view.state}
									progressRatio={view.progressRatio}
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
										{text.name}
									</p>
									<p className="mt-0.5 text-night/60 text-xs dark:text-foreground/60">
										{text.rule}
									</p>
									<Progress
										value={view.progressRatio * 100}
										className="mt-3 h-1.5 bg-night/[0.08] dark:bg-white/10"
										indicatorColor="bg-spark"
										aria-label={text.name}
									/>
									<p className="mt-1.5 text-night/55 text-xs tabular-nums dark:text-foreground/55">
										<ProgressCount
											current={view.current ?? 0}
											target={view.definition.target}
											locale={locale}
										/>
									</p>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

/** One track: its name, its count, and the grid of its trophies. */
function TrackSection({
	track,
	views,
}: {
	track: TrophyTrack;
	/** The trophies of this track, in catalog order. */
	views: TrophyView[];
}) {
	const { locale, t } = useTranslation();
	const unlockedCount = views.filter(
		(view) => view.state === "unlocked",
	).length;
	const headingId = `trophy-track-${track}`;

	return (
		<section aria-labelledby={headingId} className="mt-12">
			<div className="flex items-baseline justify-between gap-3">
				<h3 id={headingId} className={SECTION_TITLE_CLASS}>
					{t(`trophies.tracks.${track}`)}
				</h3>
				<p className="font-grotesk font-semibold text-night/45 text-sm tabular-nums dark:text-foreground/45">
					{t("trophies.page.trackCount", {
						unlocked: formatNumber(unlockedCount, locale),
						total: formatNumber(views.length, locale),
					})}
				</p>
			</div>
			<ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{views.map((view) => (
					<TrophyTile key={view.definition.id} view={view} />
				))}
			</ul>
		</section>
	);
}

/** One trophy: the key, the name, the rule (or the riddle), and the date or the progress. */
function TrophyTile({ view }: { view: TrophyView }) {
	const { locale, t } = useTranslation();
	const trophyText = useTrophyText();
	const text = trophyText(view.definition);
	const { rarity } = view.definition;
	const points = TROPHY_POINTS[rarity];
	const isUnlocked = view.state === "unlocked";
	const isHidden = view.state === "hidden";

	return (
		<li
			className={cn(
				"flex flex-col items-center rounded-[1.5rem] px-3 pt-5 pb-4 text-center",
				isUnlocked
					? CARD_CLASS
					: "bg-night/[0.015] ring-1 ring-night/[0.06] dark:bg-white/[0.02] dark:ring-white/10",
			)}
		>
			<TrophyMedallion
				trophyId={view.definition.id}
				state={view.state}
				progressRatio={view.progressRatio}
				size="lg"
			/>
			<p
				className={cn(
					"mt-5 w-full truncate font-grotesk font-semibold text-[15px] tracking-[-0.01em]",
					isUnlocked
						? "text-night dark:text-foreground"
						: "text-night/70 dark:text-foreground/70",
				)}
			>
				{isHidden ? t("trophies.page.hiddenName") : text.name}
			</p>
			<p
				className={cn(
					"mt-1 min-h-8 text-night/55 text-xs dark:text-foreground/55",
					isHidden && "italic",
				)}
			>
				{isHidden ? text.riddle : text.rule}
			</p>
			<div className="mt-auto flex w-full flex-col items-center gap-2 pt-3">
				{view.state === "locked" ? (
					<p className="text-night/55 text-xs tabular-nums dark:text-foreground/55">
						<ProgressCount
							current={view.current ?? 0}
							target={view.definition.target}
							locale={locale}
						/>
					</p>
				) : isUnlocked && view.unlockedAt !== null ? (
					<p className="font-medium text-night/60 text-xs dark:text-foreground/60">
						{t("trophies.page.earnedOn", {
							date: formatDate(view.unlockedAt, locale, {
								dateStyle: "medium",
							}),
						})}
					</p>
				) : (
					<p className="text-night/45 text-xs dark:text-foreground/45">
						{t("trophies.page.locked")}
					</p>
				)}
				<p className="inline-flex items-center gap-1.5 rounded-full bg-night/[0.04] px-2.5 py-1 font-grotesk font-semibold text-[11px] text-night/65 dark:bg-white/[0.06] dark:text-foreground/65">
					<span
						aria-hidden
						className={cn("size-1.5 rounded-full", RARITY_DOT_CLASS[rarity])}
					/>
					{t(`trophies.rarity.${rarity}`)}
					<span aria-hidden className="text-night/25 dark:text-foreground/25">
						·
					</span>
					<bdi>
						{t("trophies.units.points", {
							count: points,
							countDisplay: formatNumber(points, locale),
						})}
					</bdi>
				</p>
			</div>
		</li>
	);
}
