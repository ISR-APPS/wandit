// The first panel of the file page: a large kind mark on the canvas, and the key facts of the file as a list.
// FileDetailPage renders it. It reads the file and the kind facts of fileFacts.
import {
	type FileItem,
	FileTile,
	formatBytes,
	formatRelativeTime,
	MemberAvatar,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { fileFacts } from "../lib/file-facts";

type FileSummaryCardProps = {
	file: FileItem;
};

/** The mark spans the start column from the xl width; the facts fill the rest in two columns. */
export function FileSummaryCard({ file }: FileSummaryCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const now = Date.now();
	const facts = [
		{
			label: t("files.columns.size"),
			value: formatBytes(file.sizeBytes, locale),
		},
		...fileFacts(file, locale).map((fact) => ({
			label: t(fact.labelKey),
			value: fact.value,
		})),
		{ label: t("files.created"), value: date.format(new Date(file.createdAt)) },
		{
			label: t("files.columns.modified"),
			value: `${formatRelativeTime(file.modifiedAt, now, locale)} · ${file.modifiedByName}`,
		},
		{
			label: t("files.location"),
			value: file.path.length > 0 ? file.path.join(" / ") : t("files.allFiles"),
		},
	];

	return (
		<Card className="py-0">
			<CardContent className="grid @xl/main:grid-cols-[14rem_1fr] gap-6 @xl/main:p-5 p-4">
				<div className="flex @xl/main:aspect-auto aspect-[16/9] flex-col items-center justify-center gap-3 rounded-lg bg-canvas p-6">
					<FileTile kind={file.kind} size="lg" />
					<span className="font-medium text-muted-foreground text-xs">
						{`${t(`fileKinds.${file.kind}`)} · .${file.extension}`}
					</span>
				</div>
				<dl className="grid @xl/main:grid-cols-2 content-start gap-x-6 gap-y-4 py-1 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("files.columns.owner")}
						</dt>
						<dd className="flex items-center gap-2">
							<MemberAvatar name={file.ownerName} />
							{file.ownerName}
						</dd>
					</div>
					{facts.map((fact) => (
						<div key={fact.label} className="grid min-w-0 gap-1">
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd className="truncate tabular-nums" dir="auto">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
