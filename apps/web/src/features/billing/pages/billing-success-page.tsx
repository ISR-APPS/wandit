/**
 * Page where Stripe sends the buyer back: /billing/success?purpose=<purpose>&session_id=<id>.
 * Rendered by routes/_auth/billing_.success.tsx. A top-up polls its status, an order polls the order.
 * `purpose=subscription` stays for one release, for a checkout opened before pricing v8.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
	billingTopupStatusQuerySchema,
	type CheckoutPurpose,
	type PaymentOrder,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	billingKeys,
	useBillingTopupStatusQuery,
} from "@/features/billing/api/billing.queries";
import {
	BillingReturnShell,
	DashboardButton,
	ProjectButton,
} from "@/features/billing/components/billing-return-shell";
import { getBillingReturnCopy } from "@/features/billing/lib/billing-return-copy";
import {
	getOrderRefundStatus,
	isOrderLifecycleTerminal,
	orderReturnStateFor,
	shouldPollOrder,
} from "@/features/billing/lib/order-return-state";
import { formatCreditAmount } from "@/features/credits";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import { domainKeys } from "@/features/domains/api/domains.queries";
import { useReconcileSession } from "@/features/orders/api/orders.mutations";
import { useOrderQuery } from "@/features/orders/api/orders.queries";
import { useTranslation } from "@/lib/i18n";

// The order and the top-up flows use the same cadence: one check each 3 s, for 3 min.
const ORDER_POLL_INTERVAL_MS = 3_000;
const ORDER_TIMEOUT_MS = 3 * 60_000;

type BillingSuccessPageProps = {
	/** `purpose` search param. The route sets undefined for a value that is not a known purpose. */
	purpose: CheckoutPurpose | undefined;
	/** Raw `session_id` search param, trimmed. The route does not validate it. This page parses it. */
	sessionId: string | undefined;
};

/** Picks the return flow from `purpose`. A bad session id on a top-up shows the invalid-link page. */
export default function BillingSuccessPage({
	purpose,
	sessionId,
}: BillingSuccessPageProps) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const [attempt, setAttempt] = useState(0);
	const retry = () => setAttempt((current) => current + 1);

	// Pricing v8 sells no plan. A subscription checkout opened before the release can still return here.
	// A top-up URL from before the release has no session id. Both get the neutral text and a balance refresh.
	if (purpose === "subscription" || (purpose === "topup" && !sessionId)) {
		return <PaymentReceivedFlow />;
	}

	// The session id comes from the URL. A value that is not a Stripe session id gets the invalid-link page.
	const topupQuery =
		purpose === "topup"
			? billingTopupStatusQuerySchema.safeParse({ sessionId })
			: null;
	if (topupQuery?.success) {
		return (
			<TopupSuccessFlow
				key={`${topupQuery.data.sessionId}-${attempt}`}
				sessionId={topupQuery.data.sessionId}
				onRetry={retry}
			/>
		);
	}

	if (purpose === "order" && sessionId?.trim()) {
		return (
			<OrderSuccessFlow
				key={`${sessionId}-${attempt}`}
				sessionId={sessionId}
				onRetry={retry}
			/>
		);
	}

	return (
		<BillingReturnShell
			tone="error"
			title={copy.invalid.title}
			body={copy.invalid.body}
			actions={<DashboardButton label={copy.backToDashboard} />}
		/>
	);
}

function PaymentReceivedFlow() {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const queryClient = useQueryClient();

	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		void queryClient.invalidateQueries({ queryKey: billingKeys.all });
	}, [queryClient]);

	return (
		<BillingReturnShell
			tone="success"
			title={copy.received.title}
			body={copy.received.body}
			actions={<DashboardButton label={copy.backToDashboard} />}
		/>
	);
}

/** Polls GET billing/topup/status until the webhook writes the receipt, then refreshes the balance once. */
function TopupSuccessFlow({
	sessionId,
	onRetry,
}: {
	/** Stripe Checkout Session id from the success URL. */
	sessionId: string;
	onRetry: () => void;
}) {
	const { locale, t } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const queryClient = useQueryClient();
	const [timedOut, setTimedOut] = useState(false);
	const statusQuery = useBillingTopupStatusQuery(sessionId, {
		enabled: !timedOut,
		refetchInterval: (status) =>
			status?.status === "credited" ? false : ORDER_POLL_INTERVAL_MS,
	});
	const topupStatus = statusQuery.data;
	const credited = topupStatus?.status === "credited";

	useEffect(() => {
		if (!credited) {
			return;
		}
		// The receipt and the ledger row commit in one transaction, so the balance is final now.
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		void queryClient.invalidateQueries({ queryKey: billingKeys.all });
	}, [credited, queryClient]);

	useEffect(() => {
		if (credited) {
			return;
		}

		const timer = window.setTimeout(() => {
			setTimedOut(true);
		}, ORDER_TIMEOUT_MS);

		return () => window.clearTimeout(timer);
	}, [credited]);

	if (topupStatus?.status === "credited") {
		const grantedCredits = topupStatus.credits;
		return (
			<BillingReturnShell
				tone="success"
				title={copy.topup.creditedTitle}
				body={copy.topup.creditedBody}
				details={
					grantedCredits === null ? undefined : (
						<dl className="grid gap-3 sm:grid-cols-2">
							{/* The SlickPay return page shows the same "Credits" label, so the two flows use one text. */}
							<ReturnDetail
								label={copy.slickpay.creditsLabel}
								value={t("credits.creditUnit", {
									count: grantedCredits,
									countDisplay: formatCreditAmount(grantedCredits, locale),
								})}
							/>
						</dl>
					)
				}
				actions={<DashboardButton label={copy.backToDashboard} />}
			/>
		);
	}

	if (statusQuery.isError) {
		return (
			<BillingReturnShell
				tone="error"
				title={copy.topup.errorTitle}
				body={copy.topup.errorBody}
				actions={
					<ReturnActions
						backLabel={copy.backToDashboard}
						retryLabel={copy.retry}
						onRetry={onRetry}
					/>
				}
			/>
		);
	}

	if (timedOut) {
		return (
			<BillingReturnShell
				tone="warning"
				title={copy.topup.timeoutTitle}
				body={copy.topup.timeoutBody}
				actions={
					<ReturnActions
						backLabel={copy.backToDashboard}
						retryLabel={copy.retry}
						onRetry={onRetry}
					/>
				}
			/>
		);
	}

	return (
		<BillingReturnShell
			tone="progress"
			title={copy.topup.checkingTitle}
			body={copy.topup.checkingBody}
		/>
	);
}

function OrderSuccessFlow({
	sessionId,
	onRetry,
}: {
	sessionId: string;
	onRetry: () => void;
}) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const reconcile = useReconcileSession();
	const reconcileStarted = useRef(false);
	const [timedOut, setTimedOut] = useState(false);
	const { mutate } = reconcile;

	useEffect(() => {
		if (reconcileStarted.current) {
			return;
		}

		reconcileStarted.current = true;
		mutate({ sessionId });
	}, [mutate, sessionId]);

	const orderId = reconcile.data?.id;
	const orderQuery = useOrderQuery(orderId, {
		enabled: Boolean(orderId) && !timedOut,
		refetchInterval: (order) =>
			order && !shouldPollOrder(order) ? false : ORDER_POLL_INTERVAL_MS,
	});
	const order = orderQuery.data ?? reconcile.data;
	const lifecycleTerminal = order
		? isOrderLifecycleTerminal(order.status)
		: false;
	const shouldPoll = order ? shouldPollOrder(order) : true;
	const queryClient = useQueryClient();
	const fulfilledProjectId =
		order?.status === "fulfilled" ? (order.projectId ?? null) : null;

	useEffect(() => {
		if (!fulfilledProjectId) {
			return;
		}

		// The purchased domain now exists on the project; drop any cached list.
		void queryClient.invalidateQueries({
			queryKey: domainKeys.list(fulfilledProjectId),
		});
	}, [fulfilledProjectId, queryClient]);

	useEffect(() => {
		if (lifecycleTerminal || !shouldPoll || reconcile.isError) {
			return;
		}

		const timer = window.setTimeout(() => {
			setTimedOut(true);
		}, ORDER_TIMEOUT_MS);

		return () => window.clearTimeout(timer);
	}, [lifecycleTerminal, reconcile.isError, shouldPoll]);

	if (reconcile.isError) {
		return (
			<BillingReturnShell
				tone="error"
				title={copy.order.reconcileErrorTitle}
				body={copy.order.reconcileErrorBody}
				actions={
					<ReturnActions
						backLabel={copy.backToDashboard}
						retryLabel={copy.retry}
						onRetry={onRetry}
					/>
				}
			/>
		);
	}

	if (!reconcile.data) {
		return (
			<BillingReturnShell
				tone="progress"
				title={copy.order.reconcilingTitle}
				body={copy.order.reconcilingBody}
			/>
		);
	}

	const currentOrder = order ?? reconcile.data;

	if (timedOut && !lifecycleTerminal) {
		return (
			<BillingReturnShell
				tone="warning"
				title={copy.order.timeoutTitle}
				body={copy.order.timeoutBody}
				details={
					<OrderDetails
						order={currentOrder}
						statusText={copy.order.timeoutTitle}
					/>
				}
				actions={
					<ReturnActions
						backLabel={copy.backToDashboard}
						retryLabel={copy.retry}
						onRetry={onRetry}
					/>
				}
			/>
		);
	}

	if (orderQuery.isError) {
		return (
			<BillingReturnShell
				tone="error"
				title={copy.order.queryErrorTitle}
				body={copy.order.queryErrorBody}
				details={
					<OrderDetails
						order={currentOrder}
						statusText={copy.order.queryErrorTitle}
					/>
				}
				actions={
					<ReturnActions
						backLabel={copy.backToDashboard}
						retryLabel={copy.retry}
						onRetry={onRetry}
					/>
				}
			/>
		);
	}

	const state = orderReturnStateFor(currentOrder, copy.order);

	return (
		<BillingReturnShell
			tone={state.tone}
			title={state.title}
			body={state.body}
			details={<OrderDetails order={currentOrder} statusText={state.title} />}
			actions={
				state.tone === "progress" ? null : currentOrder.projectId ? (
					<>
						<DashboardButton label={copy.backToDashboard} variant="outline" />
						<ProjectButton
							label={copy.openProject}
							projectId={currentOrder.projectId}
						/>
					</>
				) : (
					<DashboardButton label={copy.backToDashboard} />
				)
			}
		/>
	);
}

function OrderDetails({
	order,
	statusText,
}: {
	order: PaymentOrder;
	statusText: string;
}) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const refundStatus = getOrderRefundStatus(order);

	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			<ReturnDetail label={copy.order.orderLabel} value={order.id} monospace />
			<ReturnDetail label={copy.order.statusLabel} value={statusText} />
			{refundStatus ? (
				<ReturnDetail
					label={copy.order.refundStatusLabel}
					value={refundStatus}
				/>
			) : null}
		</dl>
	);
}

function ReturnDetail({
	label,
	value,
	monospace = false,
}: {
	label: string;
	value: string;
	monospace?: boolean;
}) {
	return (
		<div className="min-w-0">
			<dt className="text-[11px] text-muted-foreground">{label}</dt>
			<dd
				dir={monospace ? "ltr" : undefined}
				title={monospace ? value : undefined}
				className={cn(
					"mt-1 truncate font-medium text-[13px]",
					monospace && "font-mono text-[11px]",
				)}
			>
				{value}
			</dd>
		</div>
	);
}

function ReturnActions({
	backLabel,
	retryLabel,
	onRetry,
}: {
	backLabel: string;
	retryLabel: string;
	onRetry: () => void;
}) {
	return (
		<>
			<DashboardButton label={backLabel} variant="outline" />
			<Button type="button" onClick={onRetry} className="active:scale-[0.98]">
				<RefreshCw className="size-4" aria-hidden />
				{retryLabel}
			</Button>
		</>
	);
}
