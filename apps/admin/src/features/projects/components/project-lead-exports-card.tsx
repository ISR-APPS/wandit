import { FileSpreadsheetIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminProjectLeadScrapeExports } from "@/features/projects/api/projects.dto";
import {
	formatFileSize,
	formatProjectDateTime,
	formatWholeNumber,
	statusBadgeVariant,
	titleCase,
} from "@/features/projects/lib/project-detail-helpers";

import { ProjectSectionEmpty } from "./project-section-empty";

type ProjectLeadExportsCardProps = {
	exports: AdminProjectLeadScrapeExports;
};

export function ProjectLeadExportsCard({
	exports,
}: ProjectLeadExportsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Lead exports</CardTitle>
				<CardDescription>
					{exports.total > 0
						? `Showing ${formatWholeNumber(exports.recent.length)} recent scrape attempts of ${formatWholeNumber(exports.total)} total.`
						: "Outbound lead-scrape workbooks generated for this project."}
				</CardDescription>
			</CardHeader>
			<CardContent className={exports.recent.length > 0 ? "px-0" : undefined}>
				{exports.recent.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Status</TableHead>
								<TableHead>Rows</TableHead>
								<TableHead>File</TableHead>
								<TableHead>Size</TableHead>
								<TableHead className="pr-6">Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{exports.recent.map((attempt) => (
								<TableRow key={attempt.id}>
									<TableCell className="pl-6">
										<Badge variant={statusBadgeVariant(attempt.status)}>
											{titleCase(attempt.status)}
										</Badge>
									</TableCell>
									<TableCell>
										<span className="flex flex-col tabular-nums">
											<span>{formatWholeNumber(attempt.foundCount)} found</span>
											{attempt.rowCount === null ? null : (
												<span className="text-muted-foreground text-xs">
													{formatWholeNumber(attempt.rowCount)} exported
												</span>
											)}
										</span>
									</TableCell>
									<TableCell>
										<span
											className="block max-w-80 truncate font-medium"
											title={attempt.fileName ?? undefined}
										>
											{attempt.fileName ?? "—"}
										</span>
									</TableCell>
									<TableCell className="tabular-nums">
										{formatFileSize(attempt.fileSize)}
									</TableCell>
									<TableCell className="pr-6">
										<time dateTime={attempt.createdAt}>
											{formatProjectDateTime(attempt.createdAt)}
										</time>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<ProjectSectionEmpty
						icon={<FileSpreadsheetIcon aria-hidden="true" />}
						title="No lead exports"
						description="Lead-scrape attempts and their workbook details will appear here."
					/>
				)}
			</CardContent>
		</Card>
	);
}
