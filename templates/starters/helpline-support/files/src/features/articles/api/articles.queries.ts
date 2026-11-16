// Reads of help articles: every article with its views, votes, and the tickets that link it.
// The /app/articles route prefetches it. ArticlesPage and the article sheet read it with useSuspenseQuery.
// The queryFn reads the sample tables. A later turn replaces it with a Supabase select and one SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	type ArticleRow,
	dayAge,
	getSampleTables,
	type TicketStatus,
} from "~/features/helpdesk";

/** The days of the article figures: views, votes, and linked tickets. */
export const ARTICLE_FIGURE_DAYS = 30;

/** One ticket whose first reply links the article. */
export type ArticleTicket = {
	id: string;
	subject: string;
	status: TicketStatus;
};

/** One help article with its derived figures. */
export type ArticleListItem = Omit<
	ArticleRow,
	"authorId" | "helpfulYes" | "helpfulNo"
> & {
	authorName: string;
	/** Share of "yes" answers to "Was this helpful?", 0 to 1. null with no answer. */
	helpful: number | null;
	/** Tickets created in the last ARTICLE_FIGURE_DAYS days whose first reply links the article. */
	linkedTickets: number;
	/** The 5 newest of those tickets, newest first. */
	recentTickets: ArticleTicket[];
};

/** Every article, the most viewed first. Drafts have no views, so they come last. */
export function articlesQueryOptions() {
	return queryOptions({
		queryKey: ["articles", "list"],
		queryFn: async (): Promise<ArticleListItem[]> => {
			const now = Date.now();
			const tables = getSampleTables();
			return tables.articles
				.map(({ authorId, helpfulYes, helpfulNo, ...article }) => {
					const linked = tables.tickets
						.filter(
							(ticket) =>
								ticket.articleId === article.id &&
								dayAge(ticket.createdAt, now) < ARTICLE_FIGURE_DAYS,
						)
						.sort(
							(first, second) =>
								Date.parse(second.createdAt) - Date.parse(first.createdAt),
						);
					const votes = helpfulYes + helpfulNo;
					return {
						...article,
						authorName:
							tables.agents.find((agent) => agent.id === authorId)?.name ?? "",
						helpful: votes === 0 ? null : helpfulYes / votes,
						linkedTickets: linked.length,
						recentTickets: linked.slice(0, 5).map((ticket) => ({
							id: ticket.id,
							subject: ticket.subject,
							status: ticket.status,
						})),
					};
				})
				.sort((first, second) => second.views30d - first.views30d);
		},
	});
}
