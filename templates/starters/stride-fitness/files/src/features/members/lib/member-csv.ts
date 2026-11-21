// The CSV columns of a member export. The members page, the home table, and the bulk exports use the same columns.
// The callers pass them to toCsv of the gym feature in their click handlers.
import type { CsvColumn } from "~/features/gym";
import type { TranslationKey } from "~/shared/i18n";
import type { MemberRow } from "./member-rows";

/**
 * The columns of a member file. Dates stay ISO days and counts stay plain numbers,
 * so a spreadsheet can sort them. `t` is the translate function of useT().
 */
export function memberCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<MemberRow>[] {
	// An ISO day (YYYY-MM-DD) in UTC. A spreadsheet reads it as a date in every language.
	const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
	return [
		{ header: t("members.name"), value: (row) => row.fullName },
		{ header: t("members.email"), value: (row) => row.email },
		{ header: t("members.plan"), value: (row) => row.planName },
		{
			header: t("members.status"),
			value: (row) => t(`memberStatuses.${row.status}`),
		},
		{ header: t("members.joined"), value: (row) => isoDay(row.joinedAt) },
		{
			header: t("members.lastVisit"),
			value: (row) => (row.lastVisitAt === null ? "" : isoDay(row.lastVisitAt)),
		},
		{
			header: t("members.visitsWindow"),
			value: (row) => String(row.visitsInWindow),
		},
	];
}
