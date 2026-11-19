// The version table of the file page: each upload with its uploader, its state badge, its size, and its day.
// FileDetailPage renders it twice: the first rows in the Overview tab, and every row in the Versions tab.
// The first row is the current version; only it counts toward storage.
import { formatBytes } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { FileVersion } from "../lib/file-detail";

type VersionTableCardProps = {
	/** The versions, newest first. */
	versions: FileVersion[];
	/** Rows to show. Absent shows every version. */
	limit?: number;
	/** True adds the description line under the title. The Versions tab uses it. */
	isDescribed?: boolean;
};

/** The table scrolls sideways inside the card on a narrow column. */
export function VersionTableCard({
	versions,
	limit,
	isDescribed = false,
}: VersionTableCardProps) {
	const { t, locale } = useT();
	const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
	const rows = limit === undefined ? versions : versions.slice(0, limit);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.versions.title")}</CardTitle>
				{isDescribed ? (
					<CardDescription>{t("files.versions.description")}</CardDescription>
				) : null}
			</CardHeader>
			<CardContent className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("files.versions.version")}</TableHead>
							<TableHead>{t("files.columns.status")}</TableHead>
							<TableHead className="text-end">
								{t("files.columns.size")}
							</TableHead>
							<TableHead>{t("files.versions.uploadedAt")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((version, index) => (
							<TableRow key={version.number}>
								<TableCell>
									<div className="grid">
										<span className="font-medium tabular-nums">{`v${version.number}`}</span>
										<span className="truncate text-muted-foreground text-xs">
											{version.uploaderName}
										</span>
									</div>
								</TableCell>
								<TableCell>
									{index === 0 ? (
										<Badge variant="success">
											{t("files.versions.current")}
										</Badge>
									) : (
										<Badge variant="outline">
											{t("files.versions.earlier")}
										</Badge>
									)}
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{formatBytes(version.sizeBytes, locale)}
								</TableCell>
								<TableCell className="tabular-nums">
									{dayFormat.format(new Date(version.uploadedAt))}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
