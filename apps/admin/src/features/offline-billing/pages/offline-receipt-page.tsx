import { Link } from "@tanstack/react-router";
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
	useManualSubscriptionQuery,
} from "@/features/offline-billing/api/offline-billing.queries";
import { OfflineReceipt } from "@/features/offline-billing/components/offline-receipt";
import { isApiClientError } from "@/lib/api-client";

const RECEIPT_PRINT_STYLES = `
@page {
	size: A4 portrait;
	margin: 10mm;
}

@media print {
	html,
	body {
		background: #ffffff !important;
	}

	body * {
		visibility: hidden !important;
	}

	body [data-slot="sidebar"] {
		display: none !important;
	}

	body [data-slot="sidebar-wrapper"] {
		display: block !important;
		min-height: 0 !important;
	}

	body [data-slot="sidebar-inset"] {
		position: static !important;
		display: block !important;
		width: 100% !important;
		margin: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
	}

	#offline-receipt-print-root,
	#offline-receipt-print-root * {
		visibility: visible !important;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	#offline-receipt-print-root {
		position: absolute !important;
		inset: 0 !important;
		width: 100% !important;
		max-width: none !important;
		min-height: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
		border: 0 !important;
		border-radius: 0 !important;
		background: #ffffff !important;
		box-shadow: none !important;
	}

	.offline-receipt-screen-only {
		display: none !important;
	}

	.offline-receipt-scroll {
		overflow: visible !important;
	}

	.offline-receipt-section,
	#offline-receipt-print-root tr {
		break-inside: avoid;
		page-break-inside: avoid;
	}

	#offline-receipt-print-root thead {
		display: table-header-group;
	}
}
`;

type OfflineReceiptPageProps = {
	subscriptionId: string;
};

export function OfflineReceiptPage({
	subscriptionId,
}: OfflineReceiptPageProps) {
	const subscriptionQuery = useManualSubscriptionQuery(subscriptionId);
	const receiptConfigQuery = useManualBillingReceiptConfigQuery();
	const [generatedAt] = useState(() => new Date());
	const subscription = subscriptionQuery.data;
	const dzdPerUsdRate = receiptConfigQuery.data?.dzdPerUsdRate;
	const isPending = subscriptionQuery.isPending || receiptConfigQuery.isPending;
	const isError = subscriptionQuery.isError || receiptConfigQuery.isError;
	const isSubscriptionMissing =
		isApiClientError(subscriptionQuery.error) &&
		subscriptionQuery.error.status === 404 &&
		!receiptConfigQuery.isError;
	const isReceiptReady =
		subscriptionQuery.isSuccess &&
		receiptConfigQuery.isSuccess &&
		subscription !== undefined &&
		dzdPerUsdRate !== undefined;
	const retryReceipt = () => {
		void Promise.all([
			subscriptionQuery.refetch(),
			receiptConfigQuery.refetch(),
		]);
	};

	return (
		<div className="mx-auto w-full max-w-[920px] space-y-5">
			<ReceiptToolbar canPrint={isReceiptReady} />

			{isError ? (
				<ReceiptErrorState
					isMissing={isSubscriptionMissing}
					onRetry={retryReceipt}
				/>
			) : isPending ? (
				<ReceiptLoadingState />
			) : isReceiptReady ? (
				<>
					<style>{RECEIPT_PRINT_STYLES}</style>
					<OfflineReceipt
						subscription={subscription}
						generatedAt={generatedAt}
						dzdPerUsdRate={dzdPerUsdRate}
					/>
				</>
			) : (
				<ReceiptErrorState
					isMissing={subscription === undefined}
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
					{isMissing ? "Subscription not found" : "Receipt could not be loaded"}
				</EmptyTitle>
				<EmptyDescription>
					{isMissing
						? "This offline subscription may have been removed, or the ID is incorrect."
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
