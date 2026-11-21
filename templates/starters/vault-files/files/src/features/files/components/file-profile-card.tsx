// The first card of the file page: the large kind tile, the name with its sharing badge, a strip of three counts,
// and the fact rows (owner, size, folder, created, modified) with an icon each.
// FileDetailPage renders it at the top of the start column, from fileQueryOptions.
import {
	CalendarBlankIcon,
	ClockIcon,
	FolderSimpleIcon,
	HardDriveIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { type FileItem, FileTile, formatBytes } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type FileProfileCardProps = {
	file: FileItem;
	/** Opens of the file through all its shares. */
	shareViews: number;
};

/** The counts strip reads versions, live shares, and share views. */
export function FileProfileCard({ file, shareViews }: FileProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale, { notation: "compact" });
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const counts = [
		{ label: t("files.versions.title"), value: file.versionCount },
		{ label: t("files.liveShares"), value: file.liveShareCount },
		{ label: t("files.shareViews"), value: shareViews },
	];
	const facts: { icon: KitIcon; label: string; value: string }[] = [
		{ icon: UserIcon, label: t("files.columns.owner"), value: file.ownerName },
		{
			icon: HardDriveIcon,
			label: t("files.columns.size"),
			value: formatBytes(file.sizeBytes, locale),
		},
		{
			icon: FolderSimpleIcon,
			label: t("files.location"),
			value: file.path.length > 0 ? file.path.join(" / ") : t("files.allFiles"),
		},
		{
			icon: CalendarBlankIcon,
			label: t("files.created"),
			value: dateTime.format(new Date(file.createdAt)),
		},
		{
			icon: ClockIcon,
			label: t("files.columns.modified"),
			value: dateTime.format(new Date(file.modifiedAt)),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4">
					<FileTile kind={file.kind} size="lg" />
					<div className="grid justify-items-center gap-1 text-center">
						<h2
							className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl"
							dir="auto"
						>
							<span className="break-all">{file.name}</span>
							{file.liveShareCount > 0 ? (
								<Badge variant="info">{t("files.shared")}</Badge>
							) : (
								<Badge variant="secondary">{t("files.teamOnly")}</Badge>
							)}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t(`fileKinds.${file.kind}`)}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x divide-border rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{counts.map((count) => (
						<div key={count.label} className="grid gap-0.5 px-1 py-3">
							<dt className="order-2 text-muted-foreground text-sm">
								{count.label}
							</dt>
							<dd className="order-1 font-numeric font-semibold text-lg tabular-nums">
								{number.format(count.value)}
							</dd>
						</div>
					))}
				</dl>
				<dl className="grid gap-4">
					{facts.map((fact) => (
						<div key={fact.label} className="flex items-center gap-3 text-sm">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<dt className="sr-only">{fact.label}</dt>
							<dd className="min-w-0 truncate" dir="auto">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
