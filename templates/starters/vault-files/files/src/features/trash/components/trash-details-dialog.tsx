// The details of one file in the trash: where it came from, who deleted it, and when Vault deletes it for good.
// The trash table opens it from the "Details" button of a row. It only shows facts and changes no data.
import {
	FileTile,
	formatBytes,
	MemberAvatar,
	type TrashItem,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { PurgeBadge } from "./purge-badge";

type TrashDetailsDialogProps = {
	/** The file to show, or null when the dialog is closed. */
	file: TrashItem | null;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. It renders nothing while no file is chosen. */
export function TrashDetailsDialog({
	file,
	onOpenChange,
}: TrashDetailsDialogProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const number = new Intl.NumberFormat(locale);
	if (!file) {
		return null;
	}
	const facts = [
		{
			label: t("trash.originalLocation"),
			value: file.path.length > 0 ? file.path.join(" / ") : t("files.allFiles"),
		},
		{ label: t("files.columns.owner"), value: file.ownerName, person: true },
		{ label: t("trash.deletedBy"), value: file.deletedByName, person: true },
		{
			label: t("trash.deletedOn"),
			value: dateTime.format(new Date(file.deletedAt)),
		},
		{
			label: t("files.columns.size"),
			value: formatBytes(file.sizeBytes, locale),
		},
		{
			label: t("files.versions.title"),
			value: number.format(file.versionCount),
		},
	];
	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<div className="flex min-w-0 items-center gap-3">
						<FileTile kind={file.kind} size="md" />
						<div className="grid min-w-0 gap-1 text-start">
							<DialogTitle className="truncate" dir="auto">
								{file.name}
							</DialogTitle>
							<DialogDescription>
								{t(`fileKinds.${file.kind}`)}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<dl className="grid gap-3 text-sm sm:grid-cols-2">
					{facts.map((fact) => (
						<div key={fact.label} className="grid min-w-0 gap-1">
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd
								className="flex min-w-0 items-center gap-2 tabular-nums"
								dir="auto"
							>
								{fact.person ? <MemberAvatar name={fact.value} /> : null}
								<span className="truncate">{fact.value}</span>
							</dd>
						</div>
					))}
					<div className="grid gap-1 sm:col-span-2">
						<dt className="text-muted-foreground">
							{t("trash.columns.purge")}
						</dt>
						<dd className="flex flex-wrap items-center gap-2 tabular-nums">
							{dateTime.format(new Date(file.purgeAt))}
							<PurgeBadge purgeAt={file.purgeAt} />
						</dd>
					</div>
				</dl>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						{t("trash.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
