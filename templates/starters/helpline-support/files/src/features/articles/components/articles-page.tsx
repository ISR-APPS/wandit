// The articles page behind login: four help center figures, then every help article in a table.
// The /app/articles route renders it after its loaders. A title opens the article sheet (?article=).
// The collection filter lives in the URL (?collection=). The route also uses the skeleton and the error below.
// It follows the product list page of the kit system: figure cards, then the table with its toolbar.
import {
	BookOpenTextIcon,
	DownloadSimpleIcon,
	ThumbsUpIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ARTICLE_COLLECTIONS,
	copyToClipboard,
	downloadCsv,
	toCsv,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type ArticleFigure,
	type ArticleListItem,
	articleFiguresQueryOptions,
	articlesQueryOptions,
} from "../api/articles.queries";
import { articleCsvColumns } from "../lib/article-csv";
import { ArticleFigureCard } from "./article-figure-card";
import { ArticleSheet } from "./article-sheet";

const route = getRouteApi("/app/articles");

// Ten rows per page, as the product list of the kit. The 25 articles fill 3 pages.
const ARTICLES_PAGE_SIZE = 10;

/** The status filter values. A draft is not public yet. */
const ARTICLE_STATES = ["published", "draft"] as const;

/** The list page. The filter buttons narrow the rows; then RecordTable searches, sorts, and pages them. */
export function ArticlesPage() {
	const { t, locale } = useT();
	const { data: articles } = useSuspenseQuery(articlesQueryOptions());
	const { data: figures } = useSuspenseQuery(articleFiguresQueryOptions());
	const { collection, article: articleId } = route.useSearch();
	const navigate = route.useNavigate();
	const [state, setState] = useState<string | null>(null);
	const [author, setAuthor] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const authors = [...new Set(articles.map((row) => row.authorName))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const stateOf = (row: ArticleListItem) =>
		row.isDraft ? "draft" : "published";
	const rows = articles.filter(
		(row) =>
			(collection === undefined || row.collection === collection) &&
			(state === null || stateOf(row) === state) &&
			(author === null || row.authorName === author),
	);
	const selected = articles.find((row) => row.id === articleId) ?? null;

	const openArticle = (id: string | undefined) =>
		navigate({ search: (previous) => ({ ...previous, article: id }) });
	const figureValue = (figure: ArticleFigure) =>
		figure.value === null
			? "–"
			: figure.id === "helpful"
				? percent.format(figure.value)
				: number.format(figure.value);

	const columns: RecordColumn<ArticleListItem>[] = [
		{
			id: "title",
			header: t("articles.article"),
			sortValue: (row) => row.title,
			// The button covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the sheet.
			cell: (row) => (
				<span className="relative flex min-w-64 items-center gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
						<BookOpenTextIcon className="size-5 text-muted-foreground" />
					</span>
					<button
						type="button"
						onClick={() => openArticle(row.id)}
						className="line-clamp-2 max-w-sm text-start after:absolute after:-inset-2 hover:underline"
						dir="auto"
					>
						{row.title}
					</button>
				</span>
			),
		},
		{
			id: "views",
			header: t("articles.views"),
			hideable: true,
			sortValue: (row) => row.views30d,
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.views30d)}</span>
			),
		},
		{
			id: "collection",
			header: t("articles.collection"),
			hideable: true,
			sortValue: (row) => ARTICLE_COLLECTIONS.indexOf(row.collection),
			cell: (row) => (
				<span className="whitespace-nowrap">
					{t(`articles.collections.${row.collection}`)}
				</span>
			),
		},
		{
			id: "linked",
			header: t("articles.linked"),
			hideable: true,
			sortValue: (row) => row.linkedTickets,
			cell: (row) => (
				<span className="tabular-nums">{number.format(row.linkedTickets)}</span>
			),
		},
		{
			id: "id",
			header: t("articles.slug"),
			hideable: true,
			cell: (row) => <span className="text-muted-foreground">{row.id}</span>,
		},
		{
			id: "helpful",
			header: t("articles.helpful"),
			hideable: true,
			cell: (row) =>
				row.helpful === null ? (
					<span className="text-muted-foreground">–</span>
				) : (
					<span className="flex items-center gap-1.5 tabular-nums">
						<ThumbsUpIcon className="size-4 text-warning" />
						{percent.format(row.helpful)}
					</span>
				),
		},
		{
			id: "status",
			header: t("articles.status"),
			sortValue: (row) => stateOf(row),
			cell: (row) =>
				row.isDraft ? (
					<Badge variant="warning">{t("articles.states.draft")}</Badge>
				) : (
					<Badge variant="success">{t("articles.states.published")}</Badge>
				),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("articles.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("articles.csv", toCsv(rows, articleCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{figures.map((figure) => (
					<ArticleFigureCard
						key={figure.id}
						label={t(`articles.figures.${figure.id}`)}
						value={figureValue(figure)}
						change={figure.change}
					/>
				))}
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.title} ${row.summary} ${row.id}`}
				searchPlaceholder={t("articles.searchPlaceholder")}
				pageSize={ARTICLES_PAGE_SIZE}
				noResults={t("articles.noResults")}
				selectable
				toolbar={
					<>
						<RecordFilter
							label={t("articles.status")}
							options={ARTICLE_STATES.map((value) => ({
								value,
								label: t(`articles.states.${value}`),
							}))}
							value={state}
							onValueChange={setState}
						/>
						<RecordFilter
							label={t("articles.collection")}
							options={ARTICLE_COLLECTIONS.map((value) => ({
								value,
								label: t(`articles.collections.${value}`),
							}))}
							value={collection ?? null}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										collection: ARTICLE_COLLECTIONS.find(
											(option) => option === value,
										),
									}),
								})
							}
						/>
						<RecordFilter
							label={t("articles.author")}
							options={authors.map((value) => ({ value, label: value }))}
							value={author}
							onValueChange={setAuthor}
						/>
					</>
				}
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"articles-selected.csv",
								toCsv(selectedRows, articleCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openArticle(row.id)}>
							{t("articles.openArticle")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("articles.copyId")}
						</DropdownMenuItem>
					</>
				)}
			/>
			<ArticleSheet article={selected} onClose={() => openArticle(undefined)} />
		</div>
	);
}

// Placeholder keys of the figure row and the table rows. Fixed keys, because they never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the articles loader runs. The route sets it as pendingComponent. */
export function ArticlesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_FIGURES.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<div className="grid gap-2 rounded-md border p-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the articles page when its loader fails. Try again runs the loader again. */
export function ArticlesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("articles.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
