import type {
	AffiliateAttributionStatus,
	AffiliateLinkListItem,
} from "@wandit/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useDeactivateAffiliateLinkMutation,
	useUpdateAffiliateMutation,
} from "../api/affiliates.mutations";
import {
	useAffiliateAttributionsQuery,
	useAffiliateLinksQuery,
	useAffiliateQuery,
} from "../api/affiliates.queries";
import { AffiliateDetailAttributionsPanel } from "./affiliate-detail-attributions-panel";
import { AffiliateDetailLinksPanel } from "./affiliate-detail-links-panel";
import {
	AffiliateDetailHeader,
	AffiliateDetailSkeleton,
	AffiliateMetrics,
	DeactivateAffiliateLinkDialog,
	PartnerDetails,
} from "./affiliate-detail-sections";
import { AffiliateEditorDialog } from "./affiliate-editor-dialog";
import { AffiliateSectionMessage } from "./affiliate-ui";
import { LinkEditorDialog } from "./link-editor-dialog";

const PAGE_SIZE = 10;
type DetailTab = "links" | "attributions" | "partner";

type AffiliateDetailSheetProps = {
	affiliateId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function AffiliateDetailSheet(props: AffiliateDetailSheetProps) {
	return (
		<AffiliateDetailSheetContent
			key={props.affiliateId ?? "no-affiliate"}
			{...props}
		/>
	);
}

function AffiliateDetailSheetContent({
	affiliateId,
	open,
	onOpenChange,
}: AffiliateDetailSheetProps) {
	const [tab, setTab] = useState<DetailTab>("links");
	const [linkPage, setLinkPage] = useState(1);
	const [attributionPage, setAttributionPage] = useState(1);
	const [attributionQuery, setAttributionQuery] = useState("");
	const [attributionStatus, setAttributionStatus] = useState<
		AffiliateAttributionStatus | "all"
	>("all");
	const [fraudFilter, setFraudFilter] = useState<"all" | "flagged" | "clear">(
		"all",
	);
	const [editOpen, setEditOpen] = useState(false);
	const [linkEditorOpen, setLinkEditorOpen] = useState(false);
	const [editingLink, setEditingLink] = useState<AffiliateLinkListItem | null>(
		null,
	);
	const [deleteLink, setDeleteLink] = useState<AffiliateLinkListItem | null>(
		null,
	);
	const detailQuery = useAffiliateQuery(affiliateId ?? undefined, open);
	const linksQuery = useAffiliateLinksQuery(
		affiliateId ?? undefined,
		{ page: linkPage, pageSize: PAGE_SIZE },
		open && tab === "links",
	);
	const attributionsQuery = useAffiliateAttributionsQuery(
		affiliateId ?? undefined,
		{
			page: attributionPage,
			pageSize: PAGE_SIZE,
			q: attributionQuery.trim() || undefined,
			status: attributionStatus === "all" ? undefined : attributionStatus,
			fraud: fraudFilter,
		},
		open && tab === "attributions",
	);
	const updateMutation = useUpdateAffiliateMutation();
	const deleteMutation = useDeactivateAffiliateLinkMutation();
	const detail = detailQuery.data;

	function openCreateLink() {
		setEditingLink(null);
		setLinkEditorOpen(true);
	}

	function openEditLink(link: AffiliateLinkListItem) {
		setEditingLink(link);
		setLinkEditorOpen(true);
	}

	async function changeStatus() {
		if (!detail) {
			return;
		}
		const status = detail.affiliate.status === "active" ? "paused" : "active";
		try {
			await updateMutation.mutateAsync({
				affiliateId: detail.affiliate.id,
				data: { status },
			});
			toast.success(
				status === "active"
					? `${detail.affiliate.name} is active.`
					: `${detail.affiliate.name} was paused.`,
			);
		} catch (error) {
			toast.error(
				errorMessage(error, "The affiliate status could not be changed."),
			);
		}
	}

	async function deactivateLink() {
		if (!deleteLink || !affiliateId) {
			return;
		}
		try {
			await deleteMutation.mutateAsync({
				affiliateId,
				linkId: deleteLink.link.id,
			});
			toast.success(`${deleteLink.link.code} was deactivated.`);
			setDeleteLink(null);
		} catch (error) {
			toast.error(
				errorMessage(error, "The referral link could not be deactivated."),
			);
		}
	}

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent className="w-full gap-0 sm:max-w-[1100px]">
					{detailQuery.isPending ? (
						<AffiliateDetailSkeleton />
					) : detailQuery.isError || !detail ? (
						<AffiliateSectionMessage
							title="Affiliate could not be loaded"
							description={errorMessage(
								detailQuery.error,
								"Retry the request to restore this partner.",
							)}
							action={
								<Button
									type="button"
									onClick={() => void detailQuery.refetch()}
								>
									<RefreshCwIcon />
									Retry
								</Button>
							}
						/>
					) : (
						<>
							<AffiliateDetailHeader
								detail={detail}
								statusPending={updateMutation.isPending}
								onEdit={() => setEditOpen(true)}
								onChangeStatus={() => void changeStatus()}
							/>
							<AffiliateMetrics detail={detail} />
							<Tabs
								value={tab}
								onValueChange={(value) => setTab(value as DetailTab)}
								className="min-h-0 flex-1 gap-0 overflow-hidden"
							>
								<div className="border-b px-5 sm:px-6">
									<TabsList variant="line" className="h-11">
										<TabsTrigger value="links">
											Referral links
											<Badge variant="secondary" className="rounded-sm px-1.5">
												{detail.aggregates.linkCount}
											</Badge>
										</TabsTrigger>
										<TabsTrigger value="attributions">
											Attributed users
											<Badge variant="secondary" className="rounded-sm px-1.5">
												{detail.aggregates.attributedUserCount}
											</Badge>
										</TabsTrigger>
										<TabsTrigger value="partner">Partner details</TabsTrigger>
									</TabsList>
								</div>
								<TabsContent
									value="links"
									className="min-h-0 overflow-y-auto p-5 sm:p-6"
								>
									<AffiliateDetailLinksPanel
										query={linksQuery}
										onCreate={openCreateLink}
										onEdit={openEditLink}
										onDelete={setDeleteLink}
										onPageChange={setLinkPage}
									/>
								</TabsContent>
								<TabsContent
									value="attributions"
									className="min-h-0 overflow-y-auto p-5 sm:p-6"
								>
									<AffiliateDetailAttributionsPanel
										query={attributionsQuery}
										search={attributionQuery}
										status={attributionStatus}
										fraud={fraudFilter}
										onSearchChange={(value) => {
											setAttributionQuery(value);
											setAttributionPage(1);
										}}
										onStatusChange={(value) => {
											setAttributionStatus(value);
											setAttributionPage(1);
										}}
										onFraudChange={(value) => {
											setFraudFilter(value);
											setAttributionPage(1);
										}}
										onPageChange={setAttributionPage}
									/>
								</TabsContent>
								<TabsContent
									value="partner"
									className="min-h-0 overflow-y-auto p-5 sm:p-6"
								>
									<PartnerDetails detail={detail} />
								</TabsContent>
							</Tabs>
						</>
					)}
				</SheetContent>
			</Sheet>
			{detail ? (
				<AffiliateEditorDialog
					open={editOpen}
					onOpenChange={setEditOpen}
					initial={detail}
				/>
			) : null}
			{affiliateId ? (
				<LinkEditorDialog
					affiliateId={affiliateId}
					open={linkEditorOpen}
					onOpenChange={setLinkEditorOpen}
					initial={editingLink}
				/>
			) : null}
			<DeactivateAffiliateLinkDialog
				link={deleteLink}
				pending={deleteMutation.isPending}
				onOpenChange={(next) => {
					if (!next && !deleteMutation.isPending) {
						setDeleteLink(null);
					}
				}}
				onConfirm={() => void deactivateLink()}
			/>
		</>
	);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
