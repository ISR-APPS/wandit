// The version history of a file: one row per upload, the current version first.
// FileDetailPage renders it. It reads the versions of buildFileDetail.
import { formatBytes, MemberAvatar } from "~/features/workspace";
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

type VersionHistoryCardProps = {
	/** Newest first. The first row is the current version. */
	versions: FileVersion[];
};

/** A table of the versions. Every version is a full upload, so each one has its own size. */
export function VersionHistoryCard({ versions }: VersionHistoryCardProps) {
	const { t, locale } = useT();
	// A date of this year has no year, and an older date has no time. Both keep the four columns inside a phone.
	const thisYearFormat = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
	const olderFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const currentYear = new Date().getFullYear();
	const formatUpload = (uploadedAt: string) => {
		const date = new Date(uploadedAt);
		return (
			date.getFullYear() === currentYear ? thisYearFormat : olderFormat
		).format(date);
	};
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.versions.title")}</CardTitle>
				<CardDescription>{t("files.versions.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("files.versions.version")}</TableHead>
							<TableHead>{t("files.versions.uploadedAt")}</TableHead>
							<TableHead className="text-end">
								{t("files.columns.size")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{versions.map((version, index) => (
							<TableRow key={version.number}>
								<TableCell>
									{/* A phone puts the badge under the number, so the three columns fit. */}
									<span className="flex @md/main:flex-row flex-col items-start @md/main:items-center gap-x-2 gap-y-1 whitespace-nowrap">
										<span className="font-medium tabular-nums">{`v${number.format(version.number)}`}</span>
										{index === 0 ? (
											<Badge variant="success">
												{t("files.versions.current")}
											</Badge>
										) : null}
									</span>
								</TableCell>
								<TableCell>
									<span className="flex items-center gap-2 whitespace-nowrap">
										<MemberAvatar name={version.uploaderName} />
										<span className="grid">
											{/* A phone shows the avatar and the date only. Screen readers still read the name. */}
											<span className="sr-only @md/main:not-sr-only">
												{version.uploaderName}
											</span>
											<span className="@md/main:text-xs text-muted-foreground tabular-nums">
												{formatUpload(version.uploadedAt)}
											</span>
										</span>
									</span>
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{formatBytes(version.sizeBytes, locale)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
