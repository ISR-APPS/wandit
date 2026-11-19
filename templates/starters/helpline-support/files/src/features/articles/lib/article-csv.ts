// The CSV columns of an article export. The header "Export CSV" and the "Export selected" bulk action use them.
// The callers pass them to toCsv of the helpdesk feature in their click handlers.
import type { CsvColumn } from "~/features/helpdesk";
import type { TranslationKey } from "~/shared/i18n";
import type { ArticleListItem } from "../api/articles.queries";

/**
 * The columns of an article file. Counts and shares stay plain numbers, so a spreadsheet can sum them.
 * `t` is the translate function of useT().
 */
export function articleCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<ArticleListItem>[] {
	return [
		{ header: t("articles.slug"), value: (row) => row.id },
		{ header: t("articles.article"), value: (row) => row.title },
		{
			header: t("articles.collection"),
			value: (row) => t(`articles.collections.${row.collection}`),
		},
		{
			header: t("articles.status"),
			value: (row) =>
				t(`articles.states.${row.isDraft ? "draft" : "published"}`),
		},
		{ header: t("articles.author"), value: (row) => row.authorName },
		{ header: t("articles.views"), value: (row) => String(row.views30d) },
		{
			header: t("articles.helpful"),
			value: (row) => (row.helpful === null ? "" : String(row.helpful)),
		},
		{ header: t("articles.linked"), value: (row) => String(row.linkedTickets) },
		{ header: t("articles.updated"), value: (row) => row.updatedAt },
	];
}
