import type { AffiliateLinkListItem } from "@wandit/contracts";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { useAffiliateLinksQuery } from "../api/affiliates.queries";
import {
	formatAffiliateDateTime,
	formatAffiliateNumber,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import { AffiliateDetailSkeleton } from "./affiliate-detail-sections";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	CurrencyValues,
	PaginationControls,
} from "./affiliate-ui";

type LinksQuery = ReturnType<typeof useAffiliateLinksQuery>;

export function AffiliateDetailLinksPanel({
	query,
	onCreate,
	onEdit,
	onDelete,
	onPageChange,
}: {
	query: LinksQuery;
	onCreate: () => void;
	onEdit: (link: AffiliateLinkListItem) => void;
	onDelete: (link: AffiliateLinkListItem) => void;
	onPageChange: (page: number) => void;
}) {
	if (query.isPending) {
		return <AffiliateDetailSkeleton />;
	}
	if (query.isError || !query.data) {
		return (
			<AffiliateSectionMessage
				title="Referral links could not be loaded"
				description={errorMessage(query.error, "Retry the request.")}
				action={<Button onClick={() => void query.refetch()}>Retry</Button>}
			/>
		);
	}
	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between gap-3">
				<div>
					<h3 className="font-semibold text-sm">Referral links</h3>
					<p className="text-muted-foreground text-xs">
						Status combines the active flag with expiry.
					</p>
				</div>
				<Button type="button" size="sm" onClick={onCreate}>
					<PlusIcon />
					Add link
				</Button>
			</div>
			{query.data.items.length === 0 ? (
				<AffiliateSectionMessage
					title="No referral links"
					description="Create the first link and assign its program terms."
					action={<Button onClick={onCreate}>Create link</Button>}
				/>
			) : (
				<div className="overflow-hidden rounded-lg border">
					<div className="overflow-x-auto">
						<Table className="min-w-[920px]">
							<TableHeader>
								<TableRow>
									<TableHead>Code</TableHead>
									<TableHead>Program</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Traffic</TableHead>
									<TableHead>Conversions</TableHead>
									<TableHead>Revenue</TableHead>
									<TableHead>Expiry</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{query.data.items.map((item) => (
									<TableRow key={item.link.id}>
										<TableCell>
											<button
												type="button"
												className="font-medium font-mono hover:underline"
												onClick={() =>
													void copyText(
														item.link.code,
														`${item.link.code} copied.`,
													)
												}
											>
												{item.link.code}
											</button>
											<p className="text-muted-foreground text-xs">
												{item.link.label ?? item.link.landingPath}
											</p>
										</TableCell>
										<TableCell>
											<p>{item.program.name}</p>
											<p className="text-muted-foreground text-xs">
												{titleCaseAffiliateValue(item.program.kind)}
											</p>
										</TableCell>
										<TableCell>
											<AffiliateStatusBadge status={item.link.status} />
										</TableCell>
										<TableCell>
											<p>
												{formatAffiliateNumber(
													item.aggregates.uniqueVisitorCount,
												)}{" "}
												visitors
											</p>
											<p className="text-muted-foreground text-xs">
												{formatAffiliateNumber(item.aggregates.clickCount)}{" "}
												clicks
											</p>
										</TableCell>
										<TableCell>
											<p>
												{formatAffiliateNumber(
													item.aggregates.attributedUserCount,
												)}{" "}
												users
											</p>
											<p className="text-muted-foreground text-xs">
												{formatAffiliateNumber(
													item.aggregates.paidCustomerCount,
												)}{" "}
												paid
											</p>
										</TableCell>
										<TableCell>
											<CurrencyValues
												currencies={item.aggregates.currencies}
												metric="attributedRevenueCents"
											/>
										</TableCell>
										<TableCell>
											{formatAffiliateDateTime(item.link.expiresAt)}
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													onClick={() => onEdit(item)}
												>
													<PencilIcon />
													<span className="sr-only">Edit {item.link.code}</span>
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													onClick={() => onDelete(item)}
												>
													<Trash2Icon />
													<span className="sr-only">
														Deactivate {item.link.code}
													</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={query.data.page}
						pageSize={query.data.pageSize}
						total={query.data.total}
						onPageChange={onPageChange}
					/>
				</div>
			)}
		</div>
	);
}

async function copyText(value: string, success: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(success);
	} catch {
		toast.error("The value could not be copied.");
	}
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
