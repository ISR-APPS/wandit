// "More in this folder": a few other files of the same folder, each a link to its page.
// FileDetailPage renders it in the main column, after the versions. It reads the neighbors of buildFileDetail.
import { Link } from "@tanstack/react-router";
import {
	type FileItem,
	FileTile,
	type FolderRow,
	formatBytes,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type FolderNeighborsCardProps = {
	neighbors: FileItem[];
	/** The folder of the file, or null at the top. "Open folder" opens it. */
	folder: FolderRow | null;
};

/** A short link list. A folder with no other file shows nothing: the page leaves the card out. */
export function FolderNeighborsCard({
	neighbors,
	folder,
}: FolderNeighborsCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.neighbors")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-1">
				<ul className="grid">
					{neighbors.map((file) => (
						<li key={file.id}>
							<Link
								to="/app/files/$fileId"
								params={{ fileId: file.id }}
								className="-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
							>
								<FileTile kind={file.kind} />
								<span
									className="min-w-0 flex-1 truncate font-medium text-sm"
									dir="auto"
								>
									{file.name}
								</span>
								<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
									{formatBytes(file.sizeBytes, locale)}
								</span>
							</Link>
						</li>
					))}
				</ul>
				<Link
					to="/app/files"
					search={{ folder: folder?.id }}
					className="justify-self-start pt-2 font-medium text-sm underline decoration-ring underline-offset-4"
				>
					{t("files.openFolder")}
				</Link>
			</CardContent>
		</Card>
	);
}
