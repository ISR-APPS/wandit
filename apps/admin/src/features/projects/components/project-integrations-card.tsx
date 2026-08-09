import { ExternalLinkIcon, FileSpreadsheetIcon, PlugIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AdminProjectSheetsIntegration } from "@/features/projects/api/projects.dto";
import { formatProjectDateTime } from "@/features/projects/lib/project-detail-helpers";

type ProjectIntegrationsCardProps = {
	sheets: AdminProjectSheetsIntegration;
};

export function ProjectIntegrationsCard({
	sheets,
}: ProjectIntegrationsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Integrations</CardTitle>
				<CardDescription>
					External services connected to this project's data.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col divide-y rounded-lg border">
					<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 items-start gap-3">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<FileSpreadsheetIcon aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-medium text-sm">Google Sheets sync</p>
									<Badge variant={sheets.connected ? "default" : "outline"}>
										{sheets.connected ? "Connected" : "Not connected"}
									</Badge>
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{sheets.lastSyncAt
										? `Last synced ${formatProjectDateTime(sheets.lastSyncAt)}`
										: sheets.connected
											? "Connected, but not synced yet"
											: "No Google account connection"}
								</p>
							</div>
						</div>
						{sheets.connected && sheets.spreadsheetUrl ? (
							<Button asChild variant="outline" size="sm">
								<a
									href={sheets.spreadsheetUrl}
									target="_blank"
									rel="noreferrer"
								>
									<ExternalLinkIcon
										data-icon="inline-start"
										aria-hidden="true"
									/>
									Open spreadsheet
								</a>
							</Button>
						) : null}
					</div>

					<div className="flex min-w-0 items-start gap-3 bg-muted/20 p-4">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<PlugIcon aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium text-sm">MCP connectors</p>
								<Badge variant="secondary">Coming soon</Badge>
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								Future connector types will appear here as they become
								available.
							</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
