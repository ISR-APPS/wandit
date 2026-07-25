import {
	DownloadIcon,
	HandshakeIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useAffiliatesQuery } from "@/features/affiliates/api/affiliates.queries";
import { AffiliateDetailSheet } from "@/features/affiliates/components/affiliate-detail-sheet";
import {
	AffiliatesSummaryStrip,
	AffiliatesSummaryStripSkeleton,
} from "@/features/affiliates/components/affiliates-summary-strip";
import { CreateAffiliateSheet } from "@/features/affiliates/components/create-affiliate-sheet";
import { AffiliatesDataTable } from "@/features/affiliates/components/table/affiliates-data-table";
import { AffiliatesTableLoading } from "@/features/affiliates/components/table/affiliates-table-loading";

function AffiliatesPage() {
	const [createOpen, setCreateOpen] = useState(false);
	const [createdAffiliateId, setCreatedAffiliateId] = useState<string | null>(
		null,
	);
	const {
		data: affiliates = [],
		isError,
		isPending,
		refetch,
	} = useAffiliatesQuery();

	return (
		<>
			<div className="mx-auto w-full max-w-[1600px] space-y-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
							Growth partnerships
						</p>
						<h1 className="mt-1 font-semibold text-2xl tracking-tight">
							Affiliates
						</h1>
						<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
							Create partners, manage referral codes, and inspect attributed
							performance down to each campaign.
						</p>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							type="button"
							variant="outline"
							disabled={isPending || affiliates.length === 0}
							onClick={() =>
								toast.success(
									`${affiliates.length.toLocaleString()} affiliate records prepared for export.`,
								)
							}
						>
							<DownloadIcon />
							Export partners
						</Button>
						<Button type="button" onClick={() => setCreateOpen(true)}>
							<PlusIcon />
							Create affiliate
						</Button>
					</div>
				</div>

				{isPending ? (
					<>
						<AffiliatesSummaryStripSkeleton />
						<AffiliatesTableLoading />
					</>
				) : isError ? (
					<Empty className="min-h-[460px] border bg-background">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HandshakeIcon />
							</EmptyMedia>
							<EmptyTitle>Affiliates could not be loaded</EmptyTitle>
							<EmptyDescription>
								The mock partner directory did not respond. Retry the request to
								restore program reporting.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" onClick={() => void refetch()}>
								<RefreshCwIcon />
								Retry
							</Button>
						</EmptyContent>
					</Empty>
				) : affiliates.length === 0 ? (
					<Empty className="min-h-[460px] border bg-background">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HandshakeIcon />
							</EmptyMedia>
							<EmptyTitle>No affiliates yet</EmptyTitle>
							<EmptyDescription>
								Add the first partner and issue a referral code to start
								tracking attributed signups and revenue.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" onClick={() => setCreateOpen(true)}>
								<PlusIcon />
								Create first affiliate
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<>
						<AffiliatesSummaryStrip affiliates={affiliates} />
						<AffiliatesDataTable data={affiliates} />
					</>
				)}
			</div>

			<CreateAffiliateSheet
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={(affiliate) => setCreatedAffiliateId(affiliate.id)}
			/>

			<AffiliateDetailSheet
				affiliateId={createdAffiliateId}
				open={Boolean(createdAffiliateId)}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						setCreatedAffiliateId(null);
					}
				}}
			/>
		</>
	);
}

export { AffiliatesPage };
