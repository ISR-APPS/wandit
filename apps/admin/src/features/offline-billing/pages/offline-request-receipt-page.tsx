import { Link } from "@tanstack/react-router";
import { tryPriceUsdFor } from "@wandit/contracts";
import {
	ArrowLeftIcon,
	CircleAlertIcon,
	PrinterIcon,
	ReceiptTextIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useManualBillingReceiptConfigQuery,
	useManualRequestQuery,
} from "@/features/offline-billing/api/offline-billing.queries";
import { OfflineRequestReceipt } from "@/features/offline-billing/components/offline-receipt";
import { RECEIPT_PRINT_STYLES } from "@/features/offline-billing/lib/receipt-print-styles";
import { isApiClientError } from "@/lib/api-client";

type OfflineRequestReceiptPageProps = {
	requestId: string;
};

export function OfflineRequestReceiptPage({
	requestId,
}: OfflineRequestReceiptPageProps) {
	const requestQuery = useManualRequestQuery(requestId);
	const receiptConfigQuery = useManualBillingReceiptConfigQuery();
	const [generatedAt] = useState(() => new Date());
	const request = requestQuery.data;
	const dzdPerUsdRate = receiptConfigQuery.data?.dzdPerUsdRate;
	const hasCatalogPrice = request
		? tryPriceUsdFor(request.plan, request.tierCredits, request.interval) !==
			null
		: false;
	const isPending = requestQuery.isPending || receiptConfigQuery.isPending;
	const isError = requestQuery.isError || receiptConfigQuery.isError;
	const isRequestMissing =
		isApiClientError(requestQuery.error) &&
		requestQuery.error.status === 404 &&
		!receiptConfigQuery.isError;
	const isPlanPriceUnavailable =
		requestQuery.isSuccess && request !== undefined && !hasCatalogPrice;
	const isReceiptReady =
		requestQuery.isSuccess &&
		receiptConfigQuery.isSuccess &&
		request !== undefined &&
		hasCatalogPrice &&
		dzdPerUsdRate !== undefined;
	const retryReceipt = () => {
		void Promise.all([requestQuery.refetch(), receiptConfigQuery.refetch()]);
	};

	return (
		<div className="mx-auto w-full max-w-[920px] space-y-5">
			{/* Always mounted: an off-state Cmd+P must print a blank page, never
			    the admin UI or a receipt-less document. */}
			<style>{RECEIPT_PRINT_STYLES}</style>
			<ReceiptToolbar canPrint={isReceiptReady} />

			{isError ? (
				<ReceiptErrorState
					isMissing={isRequestMissing}
					onRetry={retryReceipt}
				/>
			) : isPending ? (
				<ReceiptLoadingState />
			) : isPlanPriceUnavailable ? (
				<UnavailablePlanPriceState />
			) : isReceiptReady ? (
				<OfflineRequestReceipt
					request={request}
					generatedAt={generatedAt}
					dzdPerUsdRate={dzdPerUsdRate}
				/>
			) : (
				<ReceiptErrorState
					isMissing={request === undefined}
					onRetry={retryReceipt}
				/>
			)}
		</div>
	);
}

function ReceiptToolbar({ canPrint }: { canPrint: boolean }) {
	return (
		<div className="offline-receipt-screen-only flex flex-wrap items-center justify-between gap-3">
			<Button asChild variant="outline">
				<Link to="/offline-billing">
					<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
					Back to offline billing
				</Link>
			</Button>
			<Button type="button" disabled={!canPrint} onClick={() => window.print()}>
				<PrinterIcon data-icon="inline-start" aria-hidden="true" />
				Print / Save as PDF
			</Button>
		</div>
	);
}

function ReceiptLoadingState() {
	return (
		<div
			role="status"
			className="mx-auto min-h-[720px] w-full max-w-[210mm] space-y-9 rounded-sm border bg-white p-8 shadow-sm sm:p-12"
		>
			<span className="sr-only">Loading receipt</span>
			<div className="flex items-start justify-between gap-8">
				<Skeleton className="h-9 w-32" />
				<div className="space-y-2">
					<Skeleton className="ms-auto h-4 w-16" />
					<Skeleton className="h-8 w-48" />
					<Skeleton className="ms-auto h-12 w-36" />
				</div>
			</div>
			<div className="grid gap-8 sm:grid-cols-2">
				<Skeleton className="h-40 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
			<Skeleton className="h-56 w-full" />
			<Skeleton className="h-40 w-full" />
		</div>
	);
}

function ReceiptErrorState({
	isMissing,
	onRetry,
}: {
	isMissing: boolean;
	onRetry: () => void;
}) {
	return (
		<Empty className="min-h-[560px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					{isMissing ? (
						<ReceiptTextIcon aria-hidden="true" />
					) : (
						<CircleAlertIcon aria-hidden="true" />
					)}
				</EmptyMedia>
				<EmptyTitle>
					{isMissing ? "Request not found" : "Receipt could not be loaded"}
				</EmptyTitle>
				<EmptyDescription>
					{isMissing
						? "This offline subscription request may have been removed, or the ID is incorrect."
						: "The receipt data could not be read. Try the request again."}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" onClick={onRetry}>
					<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
					Try again
				</Button>
				<Button asChild variant="outline">
					<Link to="/offline-billing">
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Back to offline billing
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function UnavailablePlanPriceState() {
	return (
		<Empty className="offline-receipt-screen-only min-h-[560px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<CircleAlertIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>Requested plan price is unavailable</EmptyTitle>
				<EmptyDescription>
					This plan and credit-tier combination has no catalog price, so a
					priced receipt cannot be printed. Correct the request before granting
					the subscription.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild variant="outline">
					<Link to="/offline-billing">
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Back to offline billing
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
