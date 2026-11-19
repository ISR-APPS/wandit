// The help articles page behind login. The /app layout checks the session first.
// The loader fills the article list and the help center figures. Thin: the page and its states live in the articles feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ArticlesPage,
	ArticlesPageError,
	ArticlesPageSkeleton,
	articleFiguresQueryOptions,
	articlesQueryOptions,
	articlesSearchSchema,
} from "~/features/articles";

/** /app/articles: every help article. `?collection=` filters a collection, `?article=` opens the sheet of one article. */
export const Route = createFileRoute("/app/articles")({
	validateSearch: articlesSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(articlesQueryOptions()),
			context.queryClient.query(articleFiguresQueryOptions()),
		]),
	pendingComponent: ArticlesPageSkeleton,
	errorComponent: ArticlesPageError,
	component: ArticlesPage,
});
