import { useQueryClient } from "@tanstack/react-query";
import type { CheckoutPurpose, PaymentOrder } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	useCreateBillingPortal,
	useSyncBillingSubscription,
} from "@/features/billing/api/billing.mutations";
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
import { subscriptionReturnStateFor } from "@/features/billing/lib/subscription-return-state";
import { domainKeys } from "@/features/domains/api/domains.queries";
import { useReconcileSession } from "@/features/orders/api/orders.mutations";
import { useOrderQuery } from "@/features/orders/api/orders.queries";
import { formatNumber, useTranslation } from "@/lib/i18n";

const ORDER_POLL_INTERVAL_MS = 3_000;
const ORDER_TIMEOUT_MS = 3 * 60_000;

type BillingSuccessPageProps = {
	purpose: CheckoutPurpose | undefined;
	sessionId: string | undefined;
};

export default function BillingSuccessPage({
	purpose,
	sessionId,
}: BillingSuccessPageProps) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const [attempt, setAttempt] = useState(0);
	const retry = () => setAttempt((current) => current + 1);

	if (purpose === "subscription") {
		return (
			<SubscriptionSuccessFlow
				key={`subscription-${attempt}`}
				onRetry={retry}
			/>
		);
	}

	if (purpose === "topup") {
		return (
			<BillingReturnShell
				tone="success"
				title={copy.topup.updatedTitle}
				body={copy.topup.updatedBody}
				actions={<DashboardButton label={copy.backToDashboard} />}
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

function SubscriptionSuccessFlow({ onRetry }: { onRetry: () => void }) {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const sync = useSyncBillingSubscription();
	const portal = useCreateBillingPortal();
	const syncStarted = useRef(false);
	const { mutate } = sync;

	useEffect(() => {
		if (syncStarted.current) {
			return;
		}

		syncStarted.current = true;
		mutate();
	}, [mutate]);

	if (sync.isError) {
		return (
			<BillingReturnShell
				tone="error"
				title={copy.subscription.syncErrorTitle}
				body={copy.subscription.syncErrorBody}
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

	if (!sync.data) {
		return (
			<BillingReturnShell
				tone="progress"
				title={copy.subscription.syncingTitle}
				body={copy.subscription.syncingBody}
			/>
		);
	}

	if (!sync.data.subscription) {
		return (
			<BillingReturnShell
				tone="warning"
				title={copy.subscription.notFoundTitle}
				body={copy.subscription.notFoundBody}
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

	const subscription = sync.data.subscription;
	const state = subscriptionReturnStateFor(subscription, copy.subscription);

	return (
		<BillingReturnShell
			tone={state.tone}
			title={state.title}
			body={state.body}
			details={
				<dl className="grid gap-3 sm:grid-cols-2">
					<ReturnDetail
						label={copy.subscription.planLabel}
						value={`${subscription.plan.toUpperCase()} · ${formatNumber(
							subscription.tierCredits,
							locale,
						)}`}
					/>
					<ReturnDetail
						label={copy.subscription.creditsLabel}
						value={formatNumber(sync.data.balance.balance, locale)}
					/>
				</dl>
			}
			actions={
				state.needsPortal ? (
					<>
						<DashboardButton label={copy.backToDashboard} variant="outline" />
						<Button
							type="button"
							disabled={portal.isPending}
							onClick={() => portal.mutate()}
							className="active:scale-[0.98]"
						>
							{copy.subscription.fixPaymentLabel}
						</Button>
					</>
				) : (
					<DashboardButton label={copy.backToDashboard} />
				)
			}
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
