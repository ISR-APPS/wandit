// The dialog of one invoice: client and matter, dates, the time charged per person, the payments, and the balance.
// BillingPage renders it. It opens when the URL has ?invoice=<id>, and it reads the invoice with useQuery.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	dayToDate,
	fillMessage,
	hoursFormat,
	InvoiceStatusBadge,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { invoiceQueryOptions } from "../api/billing.queries";
import type { InvoiceFile } from "../lib/billing";

type InvoiceDialogProps = {
	/** The id from the ?invoice= search param. null keeps the dialog closed. */
	invoiceId: string | null;
	/** Removes the search param, which closes the dialog. */
	onClose: () => void;
};

/** A controlled dialog. Its body has a loading, an error, and a not-found state. */
export function InvoiceDialog({ invoiceId, onClose }: InvoiceDialogProps) {
	const { t } = useT();
	return (
		<Dialog
			open={invoiceId !== null}
			onOpenChange={(open) => !open && onClose()}
		>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
				{invoiceId === null ? (
					// Radix needs a title while the dialog animates out.
					<DialogTitle className="sr-only">{t("billing.invoice")}</DialogTitle>
				) : (
					<InvoiceDialogBody invoiceId={invoiceId} onClose={onClose} />
				)}
			</DialogContent>
		</Dialog>
	);
}

type InvoiceDialogBodyProps = {
	invoiceId: string;
	onClose: () => void;
};

function InvoiceDialogBody({ invoiceId, onClose }: InvoiceDialogBodyProps) {
	const { t } = useT();
	const query = useQuery(invoiceQueryOptions(invoiceId));
	if (query.isPending) {
		return (
			<DialogHeader>
				<DialogTitle className="sr-only">{t("billing.invoice")}</DialogTitle>
				<Skeleton className="h-7 w-48" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="mt-4 h-40" />
			</DialogHeader>
		);
	}
	if (query.isError || query.data === null) {
		return (
			<DialogHeader>
				<DialogTitle>
					{t(
						query.isError
							? "billing.invoiceErrorTitle"
							: "billing.invoiceNotFoundTitle",
					)}
				</DialogTitle>
				<DialogDescription role="alert">
					{t(query.isError ? "billing.detailError" : "billing.notFound")}
				</DialogDescription>
				{query.isError ? (
					<Button
						type="button"
						variant="outline"
						className="justify-self-start"
						onClick={() => query.refetch()}
					>
						{t("common.retry")}
					</Button>
				) : null}
			</DialogHeader>
		);
	}
	return <InvoiceFileView file={query.data} onClose={onClose} />;
}

type InvoiceFileViewProps = {
	file: InvoiceFile;
	onClose: () => void;
};

function InvoiceFileView({ file, onClose }: InvoiceFileViewProps) {
	const { t, locale } = useT();
	const { invoice } = file;
	const money = moneyFormat(locale);
	const hours = hoursFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayFormat = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	});
	const balance = invoice.amount - invoice.paidAmount;
	return (
		<>
			<DialogHeader className="gap-2 text-start">
				<div className="flex flex-wrap items-center gap-3">
					<DialogTitle className="font-display text-xl tabular-nums">
						{fillMessage(t("billing.detailTitle"), { number: invoice.number })}
					</DialogTitle>
					<InvoiceStatusBadge status={invoice.status} />
				</div>
				<DialogDescription>
					<span dir="auto">{invoice.clientName}</span>
					{" · "}
					<span dir="auto">{invoice.matterName}</span>
				</DialogDescription>
			</DialogHeader>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-surface border p-4 text-sm sm:grid-cols-3">
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground text-xs">
						{t("billing.issued")}
					</dt>
					<dd className="tabular-nums">
						{date.format(new Date(invoice.issuedAt))}
					</dd>
				</div>
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground text-xs">{t("billing.due")}</dt>
					<dd className="tabular-nums">
						{date.format(new Date(invoice.dueAt))}
					</dd>
				</div>
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground text-xs">
						{t("billing.balanceDue")}
					</dt>
					<dd
						className={
							invoice.status === "overdue"
								? "font-numeric font-semibold text-destructive tabular-nums"
								: "font-numeric font-semibold tabular-nums"
						}
					>
						{money.format(balance)}
					</dd>
				</div>
			</dl>
			<section className="grid gap-2">
				<h3 className="font-semibold text-sm">{t("billing.lines")}</h3>
				{file.period ? (
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("billing.period"), {
							start: dayFormat.format(dayToDate(file.period.start)),
							end: dayFormat.format(dayToDate(file.period.end)),
						})}
					</p>
				) : null}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("billing.person")}</TableHead>
							<TableHead className="text-end">{t("billing.hours")}</TableHead>
							<TableHead className="text-end">{t("billing.rate")}</TableHead>
							<TableHead className="text-end">{t("billing.amount")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{file.lines.length === 0 ? (
							<TableRow>
								<TableCell>{t("billing.flatLine")}</TableCell>
								<TableCell />
								<TableCell />
								<TableCell className="text-end tabular-nums">
									{money.format(invoice.amount)}
								</TableCell>
							</TableRow>
						) : (
							file.lines.map((line) => (
								<TableRow key={line.attorneyId}>
									<TableCell>
										<span className="grid">
											<span>{line.name}</span>
											<span className="text-muted-foreground text-xs">
												{t(`roles.${line.role}`)}
											</span>
										</span>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{hours.format(line.hours)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{money.format(line.rate)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{money.format(line.amount)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell colSpan={3}>{t("billing.total")}</TableCell>
							<TableCell className="text-end font-semibold tabular-nums">
								{money.format(invoice.amount)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</section>
			<section className="grid gap-2">
				<h3 className="font-semibold text-sm">{t("billing.payments")}</h3>
				{file.payments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("billing.noPayments")}
					</p>
				) : (
					<ul className="grid gap-1.5 text-sm">
						{file.payments.map((payment) => (
							<li key={payment.id} className="flex justify-between gap-3">
								<span className="text-muted-foreground">
									{fillMessage(t("billing.paidOn"), {
										date: date.format(new Date(payment.paidAt)),
									})}
								</span>
								<span className="tabular-nums">
									{money.format(payment.amount)}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					{t("billing.close")}
				</Button>
				<Button asChild>
					<Link
						to="/app/matters/$matterId"
						params={{ matterId: invoice.matterId }}
					>
						{t("billing.openMatter")}
					</Link>
				</Button>
			</DialogFooter>
		</>
	);
}
