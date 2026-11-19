// The side panel of the Files page: a large kind tile, the file name, its facts, its sharing, and a link to its page.
// FilesPage renders it at the end side of the list when the user picks a file, on wide screens only.
// On narrow screens the file name links to the file page instead, so the panel never squeezes the list.
import { Link } from "@tanstack/react-router";
import {
	type FileItem,
	FileTile,
	fillCount,
	formatBytes,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { XIcon } from "~/shared/ui/icons";

type FileDetailsPanelProps = {
	file: FileItem;
	/** Closes the panel. The page clears the picked file. */
	onClose: () => void;
};

/** Two fact lists, "Info" and "Sharing", as label and value rows. */
export function FileDetailsPanel({ file, onClose }: FileDetailsPanelProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const info = [
		{ label: t("files.columns.type"), value: t(`fileKinds.${file.kind}`) },
		{
			label: t("files.columns.size"),
			value: formatBytes(file.sizeBytes, locale),
		},
		{ label: t("files.columns.owner"), value: file.ownerName },
		{
			label: t("files.location"),
			value: file.path.length > 0 ? file.path.join(" / ") : t("files.allFiles"),
		},
		{
			label: t("files.columns.modified"),
			value: dateTime.format(new Date(file.modifiedAt)),
		},
		{
			label: t("files.created"),
			value: dateTime.format(new Date(file.createdAt)),
		},
	];
	const sharing = [
		{
			label: t("files.sharing.title"),
			value:
				file.liveShareCount > 0
					? fillCount(
							t(`shares.liveCount.${pluralForm(file.liveShareCount, locale)}`),
							file.liveShareCount,
							locale,
						)
					: t("files.teamOnly"),
		},
		{
			label: t("files.versions.title"),
			value: fillCount(
				t(`files.versionCount.${pluralForm(file.versionCount, locale)}`),
				file.versionCount,
				locale,
			),
		},
	];

	return (
		<aside
			aria-label={file.name}
			className="relative grid content-start gap-6 px-4 py-6"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="absolute end-1 top-1"
				aria-label={t("files.closeDetails")}
				onClick={onClose}
			>
				<XIcon />
			</Button>
			<div className="grid justify-items-center gap-4 py-4">
				<FileTile kind={file.kind} size="lg" />
				<h2
					className="max-w-full break-words text-center font-medium"
					dir="auto"
				>
					{file.name}
				</h2>
			</div>
			<FactList title={t("files.info")} rows={info} />
			<FactList title={t("files.sharing.title")} rows={sharing} />
			<Button variant="outline" asChild>
				<Link to="/app/files/$fileId" params={{ fileId: file.id }}>
					{t("files.openPage")}
				</Link>
			</Button>
		</aside>
	);
}

type FactListProps = {
	/** The small heading of the list, already translated. */
	title: string;
	/** Label and value pairs, already translated and formatted. */
	rows: { label: string; value: string }[];
};

// One titled list of facts: the label at the start, the value at the end.
function FactList({ title, rows }: FactListProps) {
	return (
		<section className="grid gap-4">
			<h3 className="font-semibold text-xs">{title}</h3>
			<dl className="grid gap-3 text-sm">
				{rows.map((row) => (
					<div key={row.label} className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{row.label}</dt>
						<dd className="min-w-0 truncate text-end" dir="auto">
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
