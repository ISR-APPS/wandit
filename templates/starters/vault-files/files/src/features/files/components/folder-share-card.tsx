// The "Share of its folder" card of the file page: one bar of the file bytes against all live bytes of its folder.
// FileDetailPage renders it under the profile card. The percent at the end gives the same value as text.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

// 0.1 %, the smallest share that the one-decimal percent format shows.
const MIN_SHOWN_SHARE = 0.001;

type FolderShareCardProps = {
	/** Bytes of the current version of the file. */
	fileBytes: number;
	/** Bytes of all live files of its folder, this file included. */
	folderBytes: number;
};

/** A 0 byte folder gives an empty bar and 0 %, never a division by zero. */
export function FolderShareCard({
	fileBytes,
	folderBytes,
}: FolderShareCardProps) {
	const { t, locale } = useT();
	const share = folderBytes > 0 ? fileBytes / folderBytes : 0;
	const format = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	// A small file in a large folder rounds to "0%". "< 0.1%" tells the reader that the file is not empty.
	const percent =
		share > 0 && share < MIN_SHOWN_SHARE
			? `< ${format.format(MIN_SHOWN_SHARE)}`
			: format.format(share);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.folderShare")}</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={share * 100}
					aria-label={`${t("files.folderShare")}: ${percent}`}
				/>
				<span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
					{percent}
				</span>
			</CardContent>
		</Card>
	);
}
