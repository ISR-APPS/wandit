// Reads of help articles: every article with its views, votes, and the tickets that link it,
// and the four figures of the help center against the 30 days before.
// The /app/articles route prefetches both. ArticlesPage and the article sheet read them with useSuspenseQuery.
// The queryFn reads the sample tables. A later turn replaces it with a Supabase select and one SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	type ArticleRow,
	changeRatio,
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
	| "authorId"
	| "helpfulYes"
	| "helpfulNo"
	| "viewsBefore30d"
	| "helpfulYesBefore"
	| "helpfulNoBefore"
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
				.map(
					({
						authorId,
						helpfulYes,
						helpfulNo,
						viewsBefore30d,
						helpfulYesBefore,
						helpfulNoBefore,
						...article
					}) => {
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
								tables.agents.find((agent) => agent.id === authorId)?.name ??
								"",
							helpful: votes === 0 ? null : helpfulYes / votes,
							linkedTickets: linked.length,
							recentTickets: linked.slice(0, 5).map((ticket) => ({
								id: ticket.id,
								subject: ticket.subject,
								status: ticket.status,
							})),
						};
					},
				)
				.sort((first, second) => second.views30d - first.views30d);
		},
	});
}

/** One figure of the help center and its change against the 30 days before. */
export type ArticleFigure = {
	/** Stable id, also the React key and the label key `articles.figures.<id>`. */
	id: "views" | "helpful" | "inReplies" | "updated";
	/** A count, or a share from 0 to 1 for "helpful". null when no answer exists. */
	value: number | null;
	/** Ratio against the 30 days before: 0.12 is +12 %. null when no earlier value exists. */
	change: number | null;
};

// The share of "yes" answers, or null with no answer.
function yesShare(yes: number, no: number): number | null {
	return yes + no === 0 ? null : yes / (yes + no);
}

// A figure from the value of the last 30 days and of the 30 days before. No value on either side: no delta.
function articleFigure(
	id: ArticleFigure["id"],
	current: number | null,
	previous: number | null,
): ArticleFigure {
	return {
		id,
		value: current,
		change:
			current === null || previous === null
				? null
				: changeRatio(current, previous),
	};
}

/** Views, helpful share, tickets with an article in the reply, and updated articles, for the last 30 days. */
export function articleFiguresQueryOptions() {
	return queryOptions({
		queryKey: ["articles", "figures"],
		queryFn: async (): Promise<ArticleFigure[]> => {
			const now = Date.now();
			const { articles, tickets } = getSampleTables();
			const sum = (pick: (row: ArticleRow) => number) =>
				articles.reduce((total, row) => total + pick(row), 0);
			// Age 0 to 29 is the current period, age 30 to 59 the one before.
			const inPeriod = (timestamp: string, offset: 0 | 1) => {
				const age = dayAge(timestamp, now);
				return (
					age >= offset * ARTICLE_FIGURE_DAYS &&
					age < (offset + 1) * ARTICLE_FIGURE_DAYS
				);
			};
			const linkedIn = (offset: 0 | 1) =>
				tickets.filter(
					(ticket) =>
						ticket.articleId !== null && inPeriod(ticket.createdAt, offset),
				).length;
			const updatedIn = (offset: 0 | 1) =>
				articles.filter((row) => inPeriod(row.updatedAt, offset)).length;
			return [
				articleFigure(
					"views",
					sum((row) => row.views30d),
					sum((row) => row.viewsBefore30d),
				),
				articleFigure(
					"helpful",
					yesShare(
						sum((row) => row.helpfulYes),
						sum((row) => row.helpfulNo),
					),
					yesShare(
						sum((row) => row.helpfulYesBefore),
						sum((row) => row.helpfulNoBefore),
					),
				),
				articleFigure("inReplies", linkedIn(0), linkedIn(1)),
				articleFigure("updated", updatedIn(0), updatedIn(1)),
			];
		},
	});
}
