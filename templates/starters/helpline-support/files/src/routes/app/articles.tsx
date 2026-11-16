// The help articles page behind login. The /app layout checks the session first.
// The loader fills the article list. Thin: the page and its states live in the articles feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	ArticlesPage,
	ArticlesPageError,
	ArticlesPageSkeleton,
	articlesQueryOptions,
	articlesSearchSchema,
} from "~/features/articles";

/** /app/articles: every help article. `?collection=` opens a tab, `?article=` opens the sheet of one article. */
export const Route = createFileRoute("/app/articles")({
	validateSearch: articlesSearchSchema,
	loader: ({ context }) => context.queryClient.query(articlesQueryOptions()),
	pendingComponent: ArticlesPageSkeleton,
	errorComponent: ArticlesPageError,
	component: ArticlesPage,
});
