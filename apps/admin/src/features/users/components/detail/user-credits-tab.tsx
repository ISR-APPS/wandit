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
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import {
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { cn } from "@/lib/utils";
import { titleCase } from "./user-detail-helpers";

type UserCreditsTabProps = {
	entries: AdminUserDetail["creditLedger"];
};

export function UserCreditsTab({ entries }: UserCreditsTabProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Credit ledger</CardTitle>
				<CardDescription>
					Purchases, grants, generation charges, and adjustments.
				</CardDescription>
			</CardHeader>
			<CardContent className={entries.length > 0 ? "px-0" : undefined}>
				{entries.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Date</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Note</TableHead>
								<TableHead>Actor</TableHead>
								<TableHead className="text-right">Amount</TableHead>
								<TableHead className="pr-6 text-right">Balance</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell className="pl-6">
										<time dateTime={entry.createdAt}>
											{formatAdminDateTime(entry.createdAt)}
										</time>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{titleCase(entry.type)}</Badge>
									</TableCell>
									<TableCell>
										<span
											className="block max-w-72 truncate"
											title={entry.note}
										>
											{entry.note}
										</span>
									</TableCell>
									<TableCell>{entry.actor}</TableCell>
									<TableCell
										className={cn(
											"text-right font-medium tabular-nums",
											entry.amount < 0 ? "text-destructive" : "text-foreground",
										)}
									>
										{entry.amount > 0 ? "+" : ""}
										{formatWholeNumber(entry.amount)}
									</TableCell>
									<TableCell className="pr-6 text-right tabular-nums">
										{formatWholeNumber(entry.balanceAfter)}
									</TableCell>
								</TableRow>
							))}
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
								Credit purchases and adjustments will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</CardContent>
		</Card>
	);
}
