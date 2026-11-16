// The articles page behind login: every help article with its views, votes, and linked tickets, under collection tabs.
// The /app/articles route renders it after its loader. A title opens the article sheet (?article=).
// The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	ARTICLE_COLLECTIONS,
	fillMessage,
	formatUpdateDate,
	PersonAvatar,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	ARTICLE_FIGURE_DAYS,
	type ArticleListItem,
	articlesQueryOptions,
} from "../api/articles.queries";
import { ArticleSheet } from "./article-sheet";

const route = getRouteApi("/app/articles");

// Under this share of "yes" answers, the helpful cell turns red: the article needs a rewrite.
const LOW_HELPFUL = 0.7;

/** The list page. The collection tab filters the rows; then DataTable searches, sorts, and pages them. */
export function ArticlesPage() {
	const { t, locale } = useT();
	const { data: articles } = useSuspenseQuery(articlesQueryOptions());
	const { collection, article: articleId } = route.useSearch();
	const navigate = route.useNavigate();

	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const now = Date.now();
	const tabs = ARTICLE_COLLECTIONS.map((value) => ({
		value,
		count: articles.filter((row) => row.collection === value).length,
	})).filter((tab) => tab.count > 0);
	const activeCollection =
		collection && tabs.some((tab) => tab.value === collection)
			? collection
			: "all";
	const rows =
		activeCollection === "all"
			? articles
			: articles.filter((row) => row.collection === activeCollection);
	const selected = articles.find((row) => row.id === articleId) ?? null;
	const publishedCount = articles.filter((row) => !row.isDraft).length;
	const totalViews = articles.reduce((sum, row) => sum + row.views30d, 0);

	const openArticle = (id: string | undefined) =>
		navigate({ search: (previous) => ({ ...previous, article: id }) });

	const columns: DataTableColumn<ArticleListItem>[] = [
		{
			id: "title",
			header: t("articles.article"),
			sortValue: (row) => row.title,
			// A draft gets its badge here, so no status column takes room. Up to 56rem long titles wrap.
			// On a phone the cell takes the visible card width, and its third line shows the views and the helpful share.
			// The button covers the cell and its padding (after:-inset-2), so a tap anywhere in the cell opens the panel.
			cell: (row) => (
				<div className="relative grid @xl/main:w-auto w-[calc(100cqi-4rem)] @xl/main:min-w-52 @4xl/main:max-w-md @xl/main:max-w-60 justify-items-start gap-0.5 whitespace-normal">
					<button
						type="button"
						onClick={() => openArticle(row.id)}
						className="text-start font-medium after:absolute after:-inset-2 hover:underline"
					>
						{row.title}
					</button>
					<span className="flex items-center gap-2 text-muted-foreground text-xs">
						{t(`articles.collections.${row.collection}`)}
						{row.isDraft ? (
							<Badge variant="warning">{t("articles.draft")}</Badge>
						) : null}
					</span>
					<span className="mt-1 @xl/main:hidden text-muted-foreground text-xs tabular-nums">
						{fillMessage(t("articles.viewsLine"), {
							views: number.format(row.views30d),
							helpful: row.helpful === null ? "—" : percent.format(row.helpful),
						})}
					</span>
				</div>
			),
		},
		{
			id: "views",
			header: t("articles.views"),
			align: "end",
			sortValue: (row) => row.views30d,
			cell: (row) => number.format(row.views30d),
		},
		{
			id: "helpful",
			header: t("articles.helpful"),
			align: "end",
			sortValue: (row) => row.helpful ?? -1,
			cell: (row) =>
				row.helpful === null ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span
						className={cn(
							row.helpful < LOW_HELPFUL && "font-medium text-destructive",
						)}
					>
						{percent.format(row.helpful)}
					</span>
				),
		},
		{
			id: "linked",
			header: t("articles.linked"),
			align: "end",
			sortValue: (row) => row.linkedTickets,
			cell: (row) => (
				<span
					className={cn(row.linkedTickets === 0 && "text-muted-foreground")}
				>
					{number.format(row.linkedTickets)}
				</span>
			),
		},
		{
			id: "updated",
			header: t("articles.updated"),
			align: "end",
			sortValue: (row) => Date.parse(row.updatedAt),
			// The author shows as an avatar beside the date, so no author column takes room. The name is in the title.
			cell: (row) => (
				<span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
					<span title={row.authorName} className="inline-flex">
						<PersonAvatar
							name={row.authorName}
							tone="agent"
							className="size-6"
						/>
						<span className="sr-only">{row.authorName}</span>
					</span>
					{formatUpdateDate(row.updatedAt, now, locale)}
				</span>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("articles.title")}
				description={fillMessage(t("articles.description"), {
					published: number.format(publishedCount),
					drafts: number.format(articles.length - publishedCount),
					views: number.format(totalViews),
					days: number.format(ARTICLE_FIGURE_DAYS),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.title} ${row.summary}`}
						noResults={t("articles.noResults")}
						toolbar={
							<Tabs
								value={activeCollection}
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
								className="max-w-full overflow-x-auto"
							>
								<TabsList>
									<TabsTrigger value="all">
										{t("articles.all")}
										<span className="text-muted-foreground tabular-nums">
											{number.format(articles.length)}
										</span>
									</TabsTrigger>
									{tabs.map((tab) => (
										<TabsTrigger key={tab.value} value={tab.value}>
											{t(`articles.collections.${tab.value}`)}
											<span className="text-muted-foreground tabular-nums">
												{number.format(tab.count)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
			<ArticleSheet article={selected} onClose={() => openArticle(undefined)} />
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the articles loader runs. The route sets it as pendingComponent. */
export function ArticlesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-lg" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
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
