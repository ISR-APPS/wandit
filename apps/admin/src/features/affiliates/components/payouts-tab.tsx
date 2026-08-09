import type {
	AffiliatePayoutListItem,
	AffiliatePayoutStatus,
} from "@wandit/contracts";
import {
	CheckCircle2Icon,
	CircleXIcon,
	EyeIcon,
	Loader2Icon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { isApiClientError } from "@/lib/api-client";
import {
	useBuildAffiliatePayoutMutation,
	useMarkAffiliatePayoutFailedMutation,
	useMarkAffiliatePayoutPaidMutation,
} from "../api/affiliates.mutations";
import {
	useAffiliatePayoutQuery,
	useAffiliatePayoutsQuery,
	useAffiliatesQuery,
} from "../api/affiliates.queries";
import {
	formatAffiliateDateTime,
	formatAffiliateMoney,
	formatAffiliateRateBps,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	AffiliateTableLoading,
	PaginationControls,
} from "./affiliate-ui";

const PAGE_SIZE = 15;
type ActionMode = "paid" | "failed";

export function PayoutsTab() {
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [currency, setCurrency] = useState("");
	const [status, setStatus] = useState<AffiliatePayoutStatus | "all">("all");
	const [buildOpen, setBuildOpen] = useState(false);
	const [requestId, setRequestId] = useState("");
	const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
	const [actionTarget, setActionTarget] =
		useState<AffiliatePayoutListItem | null>(null);
	const [actionMode, setActionMode] = useState<ActionMode>("paid");
	const payoutsQuery = useAffiliatePayoutsQuery({
		page,
		pageSize: PAGE_SIZE,
		q: query.trim() || undefined,
		currency:
			currency.trim().length === 3 ? currency.trim().toLowerCase() : undefined,
		status: status === "all" ? undefined : status,
	});

	function openBuilder() {
		if (!requestId) {
			setRequestId(crypto.randomUUID());
		}
		setBuildOpen(true);
	}

	function openAction(item: AffiliatePayoutListItem, mode: ActionMode) {
		setActionTarget(item);
		setActionMode(mode);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="font-semibold text-lg">Affiliate payouts</h2>
					<p className="text-muted-foreground text-sm">
						Atomically claim approved commissions, then record the manual
						payment.
					</p>
				</div>
				<Button type="button" onClick={openBuilder}>
					<PlusIcon />
					Build payout
				</Button>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-background p-3 lg:flex-row">
				<Input
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(1);
					}}
					placeholder="Search affiliate or reference..."
					className="lg:max-w-sm"
				/>
				<Select
					value={status}
					onValueChange={(value) => {
						setStatus(value as AffiliatePayoutStatus | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="processing">Processing</SelectItem>
						<SelectItem value="paid">Paid</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
					</SelectContent>
				</Select>
				<Input
					value={currency}
					onChange={(event) => {
						setCurrency(event.target.value);
						setPage(1);
					}}
					placeholder="Currency (USD)"
					maxLength={3}
					className="uppercase lg:w-40"
				/>
			</div>

			{payoutsQuery.isPending ? (
				<AffiliateTableLoading columns={8} />
			) : payoutsQuery.isError || !payoutsQuery.data ? (
				<AffiliateSectionMessage
					title="Payouts could not be loaded"
					description={errorMessage(
						payoutsQuery.error,
						"Retry the request to restore payout operations.",
					)}
					action={
						<Button type="button" onClick={() => void payoutsQuery.refetch()}>
							<RefreshCwIcon />
							Retry
						</Button>
					}
				/>
			) : payoutsQuery.data.items.length === 0 ? (
				<AffiliateSectionMessage
					title="No payouts found"
					description="Build a payout after commissions have reached approved status."
					action={<Button onClick={openBuilder}>Build payout</Button>}
				/>
			) : (
				<div className="overflow-hidden rounded-lg border bg-background">
					<div className="overflow-x-auto">
						<Table className="min-w-[1120px]">
							<TableHeader>
								<TableRow>
									<TableHead>Created</TableHead>
									<TableHead>Affiliate</TableHead>
									<TableHead>Total</TableHead>
									<TableHead>Period / entries</TableHead>
									<TableHead>Method / reference</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Request ID</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{payoutsQuery.data.items.map((item) => {
									const actionable = item.payout.status === "processing";
									return (
										<TableRow key={item.payout.id}>
											<TableCell>
												{formatAffiliateDateTime(item.payout.createdAt)}
											</TableCell>
											<TableCell>
												<p className="font-medium">{item.affiliate.name}</p>
												<p className="text-muted-foreground text-xs">
													{item.affiliate.email}
												</p>
											</TableCell>
											<TableCell className="font-mono font-semibold tabular-nums">
												{formatAffiliateMoney(
													item.payout.totalCents,
													item.payout.currency,
												)}
											</TableCell>
											<TableCell>
												<p>
													{formatAffiliateDateTime(item.payout.periodStart)} –{" "}
													{formatAffiliateDateTime(item.payout.periodEnd)}
												</p>
												<p className="text-muted-foreground text-xs">
													{item.entryCount} ledger entries
												</p>
											</TableCell>
											<TableCell>
												<p>{titleCaseAffiliateValue(item.payout.method)}</p>
												<p className="font-mono text-[10px] text-muted-foreground">
													{item.payout.externalRef ?? "No external reference"}
												</p>
											</TableCell>
											<TableCell>
												<AffiliateStatusBadge status={item.payout.status} />
											</TableCell>
											<TableCell className="max-w-48 truncate font-mono text-[10px]">
												{item.payout.requestId}
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-1">
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														onClick={() => setSelectedPayoutId(item.payout.id)}
													>
														<EyeIcon />
														<span className="sr-only">View payout</span>
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														disabled={!actionable}
														onClick={() => openAction(item, "paid")}
													>
														<CheckCircle2Icon />
														<span className="sr-only">Mark paid</span>
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														disabled={!actionable}
														onClick={() => openAction(item, "failed")}
													>
														<CircleXIcon />
														<span className="sr-only">Mark failed</span>
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={payoutsQuery.data.page}
						pageSize={payoutsQuery.data.pageSize}
						total={payoutsQuery.data.total}
						onPageChange={setPage}
					/>
				</div>
			)}

			<BuildPayoutDialog
				open={buildOpen}
				onOpenChange={setBuildOpen}
				requestId={requestId}
				onRequestIdChange={setRequestId}
				onCompleted={() => setRequestId("")}
			/>
			<PayoutActionDialog
				open={Boolean(actionTarget)}
				onOpenChange={(next) => {
					if (!next) {
						setActionTarget(null);
					}
				}}
				item={actionTarget}
				mode={actionMode}
			/>
			<PayoutDetailSheet
				payoutId={selectedPayoutId}
				open={Boolean(selectedPayoutId)}
				onOpenChange={(next) => {
					if (!next) {
						setSelectedPayoutId(null);
					}
				}}
			/>
		</div>
	);
}

function BuildPayoutDialog({
	open,
	onOpenChange,
	requestId,
	onRequestIdChange,
	onCompleted,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	requestId: string;
	onRequestIdChange: (requestId: string) => void;
	onCompleted: () => void;
}) {
	const [affiliateSearch, setAffiliateSearch] = useState("");
	const affiliatesQuery = useAffiliatesQuery({
		page: 1,
		pageSize: 100,
		q: affiliateSearch.trim() || undefined,
		sort: "name",
	});
	const mutation = useBuildAffiliatePayoutMutation();
	const [affiliateId, setAffiliateId] = useState("");
	const [currency, setCurrency] = useState("usd");
	const [requestError, setRequestError] = useState<string | null>(null);
	const attemptedPayloadRef = useRef<string | null>(null);

	useEffect(() => {
		if (!open || attemptedPayloadRef.current !== null) {
			return;
		}
		setAffiliateSearch("");
		setAffiliateId("");
		setCurrency("usd");
		setRequestError(null);
	}, [open]);

	const selected = affiliatesQuery.data?.items.find(
		(item) => item.affiliate.id === affiliateId,
	);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRequestError(null);
		const normalizedCurrency = currency.trim().toLowerCase();
		const payloadKey = `${affiliateId}:${normalizedCurrency}`;
		let effectiveRequestId = requestId;

		// Reuse the UUID only for an identical retry. If an operator changes the
		// affiliate or currency after an ambiguous response, a fresh UUID avoids a
		// server-side replay-payload mismatch while preserving exact replays.
		if (
			attemptedPayloadRef.current !== null &&
			attemptedPayloadRef.current !== payloadKey
		) {
			effectiveRequestId = crypto.randomUUID();
			onRequestIdChange(effectiveRequestId);
		}
		attemptedPayloadRef.current = payloadKey;

		try {
			const detail = await mutation.mutateAsync({
				affiliateId,
				currency: normalizedCurrency,
				requestId: effectiveRequestId,
			});
			toast.success(
				`Payout ${detail.payout.id} claimed ${detail.entries.length} entries.`,
			);
			attemptedPayloadRef.current = null;
			onCompleted();
			onOpenChange(false);
		} catch (error) {
			setRequestError(payoutError(error, "The payout could not be built."));
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
		>
			<DialogContent>
				<form onSubmit={submit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>Build affiliate payout</DialogTitle>
						<DialogDescription>
							Claims every currently eligible approved entry for one affiliate
							and currency. The request ID is retained if you retry.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="payout-affiliate-search">Find affiliate</Label>
						<Input
							id="payout-affiliate-search"
							value={affiliateSearch}
							onChange={(event) => {
								setAffiliateSearch(event.target.value);
								setAffiliateId("");
							}}
							placeholder="Search name or email"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="payout-affiliate">Affiliate</Label>
						<Select value={affiliateId} onValueChange={setAffiliateId} required>
							<SelectTrigger id="payout-affiliate" className="w-full">
								<SelectValue placeholder="Select an affiliate" />
							</SelectTrigger>
							<SelectContent>
								{affiliatesQuery.data?.items.map((item) => (
									<SelectItem key={item.affiliate.id} value={item.affiliate.id}>
										{item.affiliate.name} · {item.affiliate.email}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="payout-currency">Currency</Label>
						<Input
							id="payout-currency"
							value={currency}
							onChange={(event) => setCurrency(event.target.value)}
							pattern="[A-Za-z]{3}"
							maxLength={3}
							required
							className="uppercase"
						/>
						{selected?.aggregates.currencies.length ? (
							<p className="text-muted-foreground text-xs">
								Available aggregates:{" "}
								{selected.aggregates.currencies
									.map((item) => item.currency.toUpperCase())
									.join(", ")}
							</p>
						) : null}
					</div>
					<div className="space-y-1">
						<p className="text-muted-foreground text-xs">Request ID</p>
						<p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
							{requestId}
						</p>
					</div>
					{requestError ? (
						<p
							role="alert"
							className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
						>
							{requestError}
						</p>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={mutation.isPending}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								mutation.isPending ||
								affiliatesQuery.isPending ||
								!affiliateId ||
								currency.trim().length !== 3 ||
								!requestId
							}
						>
							{mutation.isPending ? (
								<Loader2Icon className="animate-spin" />
							) : null}
							{mutation.isPending ? "Claiming…" : "Build payout"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function PayoutActionDialog({
	open,
	onOpenChange,
	item,
	mode,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: AffiliatePayoutListItem | null;
	mode: ActionMode;
}) {
	const paidMutation = useMarkAffiliatePayoutPaidMutation();
	const failedMutation = useMarkAffiliatePayoutFailedMutation();
	const pending = paidMutation.isPending || failedMutation.isPending;
	const [value, setValue] = useState("");
	const [requestError, setRequestError] = useState<string | null>(null);
	useEffect(() => {
		if (open) {
			setValue("");
			setRequestError(null);
		}
	}, [open]);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!item) return;
		setRequestError(null);
		try {
			if (mode === "paid")
				await paidMutation.mutateAsync({
					payoutId: item.payout.id,
					data: { externalRef: value.trim() },
				});
			else
				await failedMutation.mutateAsync({
					payoutId: item.payout.id,
					data: value.trim() ? { reason: value.trim() } : {},
				});
			toast.success(
				mode === "paid"
					? "Payout marked paid."
					: "Payout marked failed and its entries were released.",
			);
			onOpenChange(false);
		} catch (error) {
			setRequestError(
				payoutError(error, `The payout could not be marked ${mode}.`),
			);
		}
	}
	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent>
				<form onSubmit={submit} className="space-y-5">
					<DialogHeader>
						<DialogTitle>
							{mode === "paid" ? "Mark payout paid" : "Mark payout failed"}
						</DialogTitle>
						<DialogDescription>
							{mode === "paid"
								? "The external reference must be unique for this payout method."
								: "This releases the claimed entries so a later payout can claim them again."}
						</DialogDescription>
					</DialogHeader>
					{mode === "paid" ? (
						<div className="space-y-2">
							<Label htmlFor="payout-external-ref">External reference</Label>
							<Input
								id="payout-external-ref"
								value={value}
								onChange={(event) => setValue(event.target.value)}
								maxLength={500}
								required
								autoFocus
							/>
						</div>
					) : (
						<div className="space-y-2">
							<Label htmlFor="payout-failure-reason">Reason (optional)</Label>
							<Textarea
								id="payout-failure-reason"
								value={value}
								onChange={(event) => setValue(event.target.value)}
								maxLength={500}
								autoFocus
							/>
						</div>
					)}
					{requestError ? (
						<p
							role="alert"
							className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
						>
							{requestError}
						</p>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant={mode === "failed" ? "destructive" : "default"}
							disabled={pending || (mode === "paid" && !value.trim())}
						>
							{pending ? <Loader2Icon className="animate-spin" /> : null}
							{pending
								? "Saving…"
								: mode === "paid"
									? "Mark paid"
									: "Mark failed"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function PayoutDetailSheet({
	payoutId,
	open,
	onOpenChange,
}: {
	payoutId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const query = useAffiliatePayoutQuery(payoutId ?? undefined, open);
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-[900px]">
				{query.isPending ? (
					<AffiliateTableLoading />
				) : query.isError || !query.data ? (
					<AffiliateSectionMessage
						title="Payout could not be loaded"
						description={errorMessage(query.error, "Retry the request.")}
						action={<Button onClick={() => void query.refetch()}>Retry</Button>}
					/>
				) : (
					<>
						<SheetHeader>
							<SheetTitle>
								{formatAffiliateMoney(
									query.data.payout.totalCents,
									query.data.payout.currency,
								)}{" "}
								payout
							</SheetTitle>
							<SheetDescription>
								{query.data.affiliate.name} · {query.data.payout.id}
							</SheetDescription>
						</SheetHeader>
						<div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
							<PayoutDatum label="Status">
								<AffiliateStatusBadge status={query.data.payout.status} />
							</PayoutDatum>
							<PayoutDatum label="Method">
								{titleCaseAffiliateValue(query.data.payout.method)}
							</PayoutDatum>
							<PayoutDatum label="External reference">
								{query.data.payout.externalRef ?? "—"}
							</PayoutDatum>
							<PayoutDatum label="Period">
								{formatAffiliateDateTime(query.data.payout.periodStart)} –{" "}
								{formatAffiliateDateTime(query.data.payout.periodEnd)}
							</PayoutDatum>
							<PayoutDatum label="Paid at">
								{formatAffiliateDateTime(query.data.payout.paidAt)}
							</PayoutDatum>
							<PayoutDatum label="Created by">
								{query.data.payout.createdByUserId}
							</PayoutDatum>
						</div>
						<div className="min-h-0 overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Invoice</TableHead>
										<TableHead>Entry</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{query.data.entries.map((entry) => (
										<TableRow key={entry.id}>
											<TableCell className="font-mono text-xs">
												{entry.stripeInvoiceId}
											</TableCell>
											<TableCell>
												{titleCaseAffiliateValue(entry.entryType)}
												{entry.rateBps === null
													? " · fixed"
													: ` · ${formatAffiliateRateBps(entry.rateBps)}`}
											</TableCell>
											<TableCell className="font-mono">
												{formatAffiliateMoney(
													entry.amountCents,
													entry.currency,
												)}
											</TableCell>
											<TableCell>
												<AffiliateStatusBadge status={entry.status} />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}

function PayoutDatum({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="mt-1 break-all text-sm">{children}</div>
		</div>
	);
}

function payoutError(error: unknown, fallback: string) {
	if (isApiClientError(error) && error.status === 409)
		return "Payout claim conflict — another admin or process changed these entries. Reload and try again.";
	return errorMessage(error, fallback);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
