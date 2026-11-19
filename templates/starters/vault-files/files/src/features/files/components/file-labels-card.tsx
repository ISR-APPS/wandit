// The "Labels" card of the file page: outline badges for the kind, the extension, the type group, the folder team, and the version.
// FileDetailPage renders it at the end of the start column. Every badge comes from the file row, never from free text.
import type { FileItem, FolderRow } from "~/features/workspace";
import { fillCount } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type FileLabelsCardProps = {
	file: FileItem;
	/** The folder of the file, or null at the top: then no team badge. */
	folder: FolderRow | null;
};

/** One wrapping row of badges. */
export function FileLabelsCard({ file, folder }: FileLabelsCardProps) {
	const { t, locale } = useT();
	const labels = [
		t(`fileKinds.${file.kind}`),
		`.${file.extension}`,
		t(`fileCategories.${file.category}`),
		...(folder ? [t(`teams.${folder.team}`)] : []),
		fillCount(t("files.versionLabel"), file.versionCount, locale),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.labels")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{labels.map((label) => (
					<Badge key={label} variant="outline">
						{label}
					</Badge>
				))}
			</CardContent>
		</Card>
	);
}
