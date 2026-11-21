// Shows a compact record table on the overview.
// DashboardPage passes the sample rows for the current workspace.
import { Badge } from "~/shared/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { WorkspaceRow } from "../lib/workspace";

/** Gives the dashboard a read-only view of the main records. */
export function Snapshot({ rows }: { rows: readonly WorkspaceRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Meter / Location</TableHead>
					<TableHead>Signal</TableHead>
					<TableHead className="text-end">Reading</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.name}>
						<TableCell>
							<p className="font-semibold">{row.name}</p>
							<p className="text-muted-foreground text-xs">{row.subtitle}</p>
						</TableCell>
						<TableCell>
							<Badge variant="secondary">{row.status}</Badge>
						</TableCell>
						<TableCell className="text-end font-numeric tabular-nums">
							{row.value}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
