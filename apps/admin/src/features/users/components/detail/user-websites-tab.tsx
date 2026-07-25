import { ExternalLinkIcon, Globe2Icon } from "lucide-react";

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
	formatAdminDate,
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

type UserWebsitesTabProps = {
	websites: AdminUserDetail["websites"];
};

export function UserWebsitesTab({ websites }: UserWebsitesTabProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Websites</CardTitle>
				<CardDescription>
					Sites retained by this user and their generation history.
				</CardDescription>
			</CardHeader>
			<CardContent className={websites.length > 0 ? "px-0" : undefined}>
				{websites.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Website</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Generations</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="pr-6">Last generated</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{websites.map((website) => (
								<TableRow key={website.id}>
									<TableCell className="pl-6">
										<div className="flex min-w-52 items-center gap-3">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
												<Globe2Icon aria-hidden="true" />
											</div>
											<div className="min-w-0">
												<p className="truncate font-medium">{website.name}</p>
												{website.url ? (
													<a
														href={website.url}
														target="_blank"
														rel="noreferrer"
														className="inline-flex max-w-64 items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
														title={`Open ${website.url}`}
													>
														<span className="truncate">{website.url}</span>
														<ExternalLinkIcon
															className="size-3 shrink-0"
															aria-hidden="true"
														/>
													</a>
												) : (
													<span className="text-muted-foreground text-xs">
														Not published
													</span>
												)}
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												website.status === "failed"
													? "destructive"
													: website.status === "draft"
														? "secondary"
														: "outline"
											}
										>
											{website.status}
										</Badge>
									</TableCell>
									<TableCell className="tabular-nums">
										{formatWholeNumber(website.generationCount)}
									</TableCell>
									<TableCell>
										<time dateTime={website.createdAt}>
											{formatAdminDate(website.createdAt)}
										</time>
									</TableCell>
									<TableCell className="pr-6">
										<time dateTime={website.lastGeneratedAt}>
											{formatAdminDateTime(website.lastGeneratedAt)}
										</time>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<Empty className="min-h-64 border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Globe2Icon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No websites</EmptyTitle>
							<EmptyDescription>
								Websites created by this user will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</CardContent>
		</Card>
	);
}
