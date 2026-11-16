/**
 * Templates list page at `/templates`: the starter template grid with a
 * search field, the kind filter, and the category chips.
 * The route file imports it by path and passes the validated search params.
 * Reads the static catalog of packages/contracts and filters it with
 * lib/helpers.ts. It calls no API. Each card opens the detail page.
 */
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { useNavigate } from "@tanstack/react-router";
import { STARTER_TEMPLATES } from "@wandit/contracts/v2/starter-template-catalog";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/features/projects";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { StarterTemplateKind } from "../api/dto";
import { StarterTemplateCard } from "../components/starter-template-card";
import {
	filterStarterTemplates,
	usedStarterTemplateCategories,
} from "../lib/helpers";
import { SEARCH_TEXT_MAX_LENGTH, type TemplatesSearch } from "../lib/schemas";

// The segments of the kind filter, in display order. An undefined kind shows the two kinds.
const KIND_SEGMENTS = [
	{ kind: undefined, labelKey: "templates.filters.all" },
	{ kind: "website", labelKey: "templates.filters.websites" },
	{ kind: "app", labelKey: "templates.filters.apps" },
] as const satisfies readonly {
	kind: StarterTemplateKind | undefined;
	labelKey: TranslationKey;
}[];

// The kind filter is one pill with segments, like the status filter of the dashboard.
const SEGMENT_CLASS = "h-7 px-3";
const SEGMENT_IDLE_CLASS =
	"text-night/60 hover:text-night dark:text-foreground/60 dark:hover:text-foreground";
// A category is a loose tag with a hairline, so the two filters do not look the same.
const TAG_CLASS = "h-8 shrink-0 px-3.5 ring-1";
const TAG_IDLE_CLASS =
	"bg-white text-night/65 ring-night/10 hover:text-night hover:ring-night/25 dark:bg-card dark:text-foreground/65 dark:ring-white/10 dark:hover:text-foreground dark:hover:ring-white/25";

type TemplatesPageProps = {
	/** Validated `?q=&kind=&category=` of the URL, from the route file. It is the filter state. */
	search: TemplatesSearch;
};

/** The list of starter templates. The filter state is in the URL, so a link or a reload keeps it. */
export default function TemplatesPage({ search }: TemplatesPageProps) {
	const { t, locale } = useTranslation();
	const navigate = useNavigate();
	// The input holds its own text, so typing does not wait for the router. The URL gets the same text.
	const [searchText, setSearchText] = useState(search.q ?? "");
	// A link to `/templates` with no query (the sidebar item) clears the URL while this page stays mounted.
	useEffect(() => {
		if (search.q === undefined) setSearchText("");
	}, [search.q]);

	const categories = useMemo(
		() =>
			usedStarterTemplateCategories(STARTER_TEMPLATES)
				.map((category) => ({
					category,
					label: t(`templates.categories.${category}`),
				}))
				.sort((left, right) => left.label.localeCompare(right.label, locale)),
		[locale, t],
	);
	const results = useMemo(
		() =>
			filterStarterTemplates(STARTER_TEMPLATES, search, locale, (category) =>
				t(`templates.categories.${category}`),
			),
		[search, locale, t],
	);

	// A filter change replaces the history entry, so Back leaves the page in one step.
	function setSearch(patch: TemplatesSearch) {
		void navigate({
			to: "/templates",
			search: { ...search, ...patch },
			replace: true,
		});
	}

	function clearFilters() {
		setSearchText("");
		void navigate({ to: "/templates", search: {}, replace: true });
	}

	return (
		<DashboardShell titleKey="templates.title">
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
					<div className="flex items-center gap-2.5">
						<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] rtl:tracking-normal dark:text-foreground">
							{t("templates.title")}
						</h2>
						{/* role="status": a screen reader hears the new count after a filter change. */}
						<span
							role="status"
							className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60"
						>
							{t("templates.resultCount", { count: results.length })}
						</span>
					</div>
					<div className="ms-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
						{/* On a phone the search takes the full row, and the kind filter sits under it. */}
						<div className="relative w-full sm:w-56">
							<MagnifyingGlassIcon
								aria-hidden
								weight="bold"
								className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-night/45 dark:text-foreground/50"
							/>
							<Input
								type="search"
								value={searchText}
								maxLength={SEARCH_TEXT_MAX_LENGTH}
								onChange={(event) => {
									setSearchText(event.target.value);
									// An empty text leaves the URL without `q`.
									setSearch({ q: event.target.value || undefined });
								}}
								placeholder={t("templates.searchPlaceholder")}
								aria-label={t("templates.searchPlaceholder")}
								className="h-10 rounded-full border-night/10 bg-white ps-10 text-sm dark:border-border dark:bg-card"
							/>
						</div>
						<fieldset
							aria-label={t("templates.filters.kindLabel")}
							className="flex min-w-0 items-center gap-1 rounded-full bg-night/[0.05] p-1 dark:bg-white/[0.06]"
						>
							{KIND_SEGMENTS.map(({ kind, labelKey }) => (
								<FilterChip
									key={labelKey}
									isActive={search.kind === kind}
									label={t(labelKey)}
									className={SEGMENT_CLASS}
									idleClassName={SEGMENT_IDLE_CLASS}
									onClick={() => setSearch({ kind })}
								/>
							))}
						</fieldset>
					</div>
				</div>
				<p className="mt-1 max-w-2xl text-night/60 text-sm leading-relaxed dark:text-foreground/60">
					{t("templates.intro")}
				</p>
				{/* The row scrolls sideways on a phone and wraps from `md`. py-1 keeps the focus outline of a chip inside the scroll box. */}
				<fieldset
					aria-label={t("templates.filters.categoryLabel")}
					className="-mx-4 mt-4 flex min-w-0 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
				>
					<FilterChip
						isActive={search.category === undefined}
						label={t("templates.filters.allCategories")}
						className={TAG_CLASS}
						idleClassName={TAG_IDLE_CLASS}
						onClick={() => setSearch({ category: undefined })}
					/>
					{categories.map(({ category, label }) => (
						<FilterChip
							key={category}
							isActive={search.category === category}
							label={label}
							className={TAG_CLASS}
							idleClassName={TAG_IDLE_CLASS}
							onClick={() => setSearch({ category })}
						/>
					))}
				</fieldset>
				<div className="mt-5">
					{results.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-14 text-center dark:border-white/15">
							<span
								aria-hidden
								className="grid size-12 place-items-center rounded-full bg-white text-night/70 shadow-[0_1px_0_rgb(11_16_51/0.1)] dark:bg-white/10 dark:text-foreground/70"
							>
								<MagnifyingGlassIcon weight="duotone" className="size-5" />
							</span>
							<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
								{t("templates.noResults.title")}
							</h3>
							<p className="mt-1 max-w-xs text-night/60 text-sm dark:text-foreground/60">
								{t("templates.noResults.body")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="mt-4 rounded-full font-grotesk"
								onClick={clearFilters}
							>
								{t("templates.filters.clear")}
							</Button>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
							{results.map((starterTemplate) => (
								<StarterTemplateCard
									key={starterTemplate.id}
									starterTemplate={starterTemplate}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</DashboardShell>
	);
}

/** One filter button. The selected one is a night pill (spark in dark mode), like the dashboard filter. */
function FilterChip({
	isActive,
	label,
	className,
	idleClassName,
	onClick,
}: {
	isActive: boolean;
	label: string;
	/** Size classes of the look: a segment of the kind filter, or a category tag. */
	className: string;
	/** Color classes while the chip is not selected. The selected colors are the same for the two looks. */
	idleClassName: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={isActive}
			className={cn(
				"whitespace-nowrap rounded-full font-grotesk font-semibold text-xs transition-colors duration-150",
				"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
				className,
				isActive
					? "bg-night text-paper ring-night dark:bg-spark dark:text-night dark:ring-spark"
					: idleClassName,
			)}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
