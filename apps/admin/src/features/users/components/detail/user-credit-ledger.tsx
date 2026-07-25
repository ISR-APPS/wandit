import { HistoryIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminCreditLedgerEntry } from "@/features/users/api/users.dto";
import {
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { cn } from "@/lib/utils";

import { titleCase } from "./user-detail-helpers";

type UserCreditLedgerProps = {
	entries: AdminCreditLedgerEntry[];
};

// The operator's own words live in meta.note; meta.reason is the machine tag
// the server stamps on the entry ("admin_grant", "signup_grant", …).
function getEntryReason(entry: AdminCreditLedgerEntry): string | null {
	const note = entry.meta?.note;
	if (typeof note === "string" && note.trim().length > 0) {
		return note;
	}

	const reason = entry.meta?.reason;
	return typeof reason === "string" && reason.length > 0
		? titleCase(reason)
		: null;
}

export function UserCreditLedger({ entries }: UserCreditLedgerProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Credit ledger</CardTitle>
				<CardDescription>
					Grants, top-ups, consumption, and expirations for this account.
				</CardDescription>
			</CardHeader>
			<CardContent className={entries.length > 0 ? "px-0" : undefined}>
				{entries.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Date</TableHead>
								<TableHead>Kind</TableHead>
								<TableHead>Bucket</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead className="pr-6 text-right">Delta</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.map((entry) => {
								const reason = getEntryReason(entry);

								return (
									<TableRow key={entry.id}>
										<TableCell className="pl-6">
											<time dateTime={entry.createdAt}>
												{formatAdminDateTime(entry.createdAt)}
											</time>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{titleCase(entry.kind)}</Badge>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">
												{titleCase(entry.bucket)}
											</Badge>
										</TableCell>
										<TableCell>
											{reason ? (
												<span
													className="block max-w-72 truncate"
													title={reason}
												>
													{reason}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell
											className={cn(
												"pr-6 text-right font-medium tabular-nums",
												entry.delta < 0
													? "text-destructive"
													: "text-foreground",
											)}
										>
											{entry.delta > 0 ? "+" : ""}
											{formatWholeNumber(entry.delta)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<Empty className="min-h-64 border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HistoryIcon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No credit activity</EmptyTitle>
							<EmptyDescription>
								Credit grants and charges will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</CardContent>
		</Card>
	);
}
