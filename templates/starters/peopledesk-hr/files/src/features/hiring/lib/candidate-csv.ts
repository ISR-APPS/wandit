// The CSV columns of a candidate: the header export and "Export selected" of the hiring page use them.
// The cells are text in the app language. Times stay ISO, so a spreadsheet reads them as dates.
import type { CsvColumn } from "~/features/people";
import type { TranslationKey } from "~/shared/i18n";
import type { Candidate } from "../api/hiring.queries";

/** One column per candidate field that the board and the table show. */
export function candidateCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<Candidate>[] {
	return [
		{ header: t("hiring.candidateId"), value: (row) => row.id },
		{ header: t("hiring.candidate"), value: (row) => row.name },
		{ header: t("hiring.position"), value: (row) => row.positionTitle },
		{ header: t("hiring.stage"), value: (row) => t(`stages.${row.stage}`) },
		{ header: t("hiring.source"), value: (row) => t(`sources.${row.source}`) },
		{
			header: t("hiring.rating"),
			value: (row) => (row.rating === null ? "" : String(row.rating)),
		},
		{ header: t("hiring.currentRole"), value: (row) => row.currentRole },
		{ header: t("hiring.applied"), value: (row) => row.appliedAt },
	];
}
