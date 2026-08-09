import { HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
	formatUsdMicros,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { cn } from "@/lib/utils";

import { DetailPagination } from "./detail-pagination";
import { titleCase } from "./user-detail-helpers";

export const LEDGER_PAGE_SIZE = 10;

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

export function UserCreditLedgerTable({ entries }: UserCreditLedgerProps) {
	const [page, setPage] = useState(1);
	const pageCount = Math.max(1, Math.ceil(entries.length / LEDGER_PAGE_SIZE));

	useEffect(() => {
		if (page > pageCount) {
			setPage(pageCount);
		}
	}, [page, pageCount]);

	if (entries.length === 0) {
		return (
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
		);
	}

	const pageItems = entries.slice(
		(page - 1) * LEDGER_PAGE_SIZE,
		page * LEDGER_PAGE_SIZE,
	);

	return (
		<div className="flex flex-col">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="pl-6">Date</TableHead>
						<TableHead>Kind</TableHead>
						<TableHead>Bucket</TableHead>
						<TableHead>Reason</TableHead>
						<TableHead>Model</TableHead>
						<TableHead className="text-right">AI cost</TableHead>
						<TableHead className="pr-6 text-right">Delta</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{pageItems.map((entry) => {
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
									<Badge variant="secondary">{titleCase(entry.bucket)}</Badge>
								</TableCell>
								<TableCell>
									{reason ? (
										<span className="block max-w-72 truncate" title={reason}>
											{reason}
										</span>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
								</TableCell>
								<TableCell>
									{entry.aiModel ? (
										<span
											className="block max-w-48 truncate"
											title={
												entry.aiProvider
													? `${entry.aiModel} · ${entry.aiProvider}`
													: entry.aiModel
											}
										>
											{entry.aiModel}
										</span>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
								</TableCell>
								<TableCell
									className="text-right tabular-nums"
									// Reserve + settle rows of one operation share the SAME
									// operation-total cost — the figure is per operation, not
									// per row.
									title={
										entry.aiCostUsdMicros === null
											? undefined
											: "Actual provider cost of the linked operation"
									}
								>
									{entry.aiCostUsdMicros === null ? (
										<span className="text-muted-foreground">—</span>
									) : (
										formatUsdMicros(entry.aiCostUsdMicros)
									)}
								</TableCell>
								<TableCell
									className={cn(
										"pr-6 text-right font-medium tabular-nums",
										entry.delta < 0 ? "text-destructive" : "text-foreground",
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
			<div className="px-6">
				<DetailPagination
					page={page}
					pageSize={LEDGER_PAGE_SIZE}
					total={entries.length}
					onPageChange={setPage}
				/>
			</div>
		</div>
	);
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
				<UserCreditLedgerTable entries={entries} />
			</CardContent>
		</Card>
	);
}
