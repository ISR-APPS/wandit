// The side sheet of one client: contact details, totals, matters, and invoices.
// ClientsPage renders it. It opens when the URL has ?client=<id>, and it reads the client file with useQuery.
// Each matter row opens the matter page; each invoice row opens the invoice on the billing page.
import {
	EnvelopeSimpleIcon,
	MapPinIcon,
	PhoneIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	InvoiceStatusBadge,
	MatterStageBadge,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import { clientQueryOptions } from "../api/clients.queries";
import type { ClientFile } from "../lib/client-joins";

type ClientSheetProps = {
	/** The id from the ?client= search param. null keeps the sheet closed. */
	clientId: string | null;
	/** Removes the search param, which closes the sheet. */
	onClose: () => void;
};

/** A controlled sheet. Its body has a loading, an error, and a not-found state. */
export function ClientSheet({ clientId, onClose }: ClientSheetProps) {
	const { t } = useT();
	return (
		<Sheet open={clientId !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-md">
				{clientId === null ? (
					// Radix needs a title while the sheet animates out.
					<SheetTitle className="sr-only">{t("clients.client")}</SheetTitle>
				) : (
					<ClientSheetBody clientId={clientId} />
				)}
			</SheetContent>
		</Sheet>
	);
}

type ClientSheetBodyProps = {
	clientId: string;
};

function ClientSheetBody({ clientId }: ClientSheetBodyProps) {
	const { t } = useT();
	const query = useQuery(clientQueryOptions(clientId));
	if (query.isPending) {
		return (
			<>
				<SheetHeader>
					<SheetTitle className="sr-only">{t("clients.client")}</SheetTitle>
					<Skeleton className="h-7 w-56" />
					<Skeleton className="h-4 w-40" />
				</SheetHeader>
				<div className="grid gap-3 px-4">
					<Skeleton className="h-20" />
					<Skeleton className="h-40" />
				</div>
			</>
		);
	}
	if (query.isError || query.data === null) {
		return (
			<SheetHeader>
				<SheetTitle>
					{t(
						query.isError
							? "clients.clientErrorTitle"
							: "clients.clientNotFoundTitle",
					)}
				</SheetTitle>
				<SheetDescription role="alert">
					{t(query.isError ? "clients.detailError" : "clients.notFound")}
				</SheetDescription>
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
			</SheetHeader>
		);
	}
	return <ClientFileView file={query.data} />;
}

type ClientFileViewProps = {
	file: ClientFile;
};

function ClientFileView({ file }: ClientFileViewProps) {
	const { t, locale } = useT();
	const { client } = file;
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const totals = [
		{ key: "billed", label: t("clients.billed"), value: client.billed },
		{
			key: "outstanding",
			label: t("clients.outstanding"),
			value: client.outstanding,
		},
		{
			key: "paid",
			label: t("clients.paid"),
			value: client.billed - client.outstanding,
		},
	];
	return (
		<>
			<SheetHeader className="gap-2 border-b pe-12 pb-5">
				<Badge
					variant={client.kind === "organization" ? "secondary" : "outline"}
				>
					{t(`clients.${client.kind}`)}
				</Badge>
				<SheetTitle className="font-display text-2xl" dir="auto">
					{client.name}
				</SheetTitle>
				<SheetDescription>
					{client.since
						? `${t("clients.since")} ${date.format(new Date(client.since))}`
						: t("clients.noMatterYet")}
				</SheetDescription>
			</SheetHeader>
			<div className="grid gap-6 px-4 pb-6">
				<dl className="grid gap-2.5 text-sm">
					{client.contactName ? (
						<div className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">
								{t("clients.contact")}
							</dt>
							<dd className="font-medium" dir="auto">
								{client.contactName}
							</dd>
						</div>
					) : null}
					<div className="flex items-center gap-2">
						<dt>
							<EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
							<span className="sr-only">{t("clients.email")}</span>
						</dt>
						<dd>
							<a
								href={`mailto:${client.email}`}
								className="underline decoration-border underline-offset-4 hover:decoration-ring"
							>
								{client.email}
							</a>
						</dd>
					</div>
					<div className="flex items-center gap-2">
						<dt>
							<PhoneIcon className="size-4 text-muted-foreground" />
							<span className="sr-only">{t("clients.phone")}</span>
						</dt>
						<dd>
							<a
								href={`tel:${client.phone}`}
								className="tabular-nums underline decoration-border underline-offset-4 hover:decoration-ring"
								dir="ltr"
							>
								{client.phone}
							</a>
						</dd>
					</div>
					<div className="flex items-center gap-2">
						<dt>
							<MapPinIcon className="size-4 text-muted-foreground" />
							<span className="sr-only">{t("clients.city")}</span>
						</dt>
						<dd dir="auto">{client.city}</dd>
					</div>
				</dl>
				<dl className="grid grid-cols-3 divide-x divide-border rounded-surface border">
					{totals.map((total) => (
						<div key={total.key} className="grid gap-0.5 px-3 py-2.5">
							<dt className="text-muted-foreground text-xs">{total.label}</dt>
							<dd className="font-numeric font-semibold tabular-nums">
								{money.format(total.value)}
							</dd>
						</div>
					))}
				</dl>
				{client.overdue > 0 ? (
					<p className="-mt-3 font-medium text-destructive text-sm">
						{fillMessage(t("clients.overdueAmount"), {
							amount: money.format(client.overdue),
						})}
					</p>
				) : null}
				<section className="grid gap-2">
					<h3 className="font-semibold text-sm">
						{t("clients.matters")}
						<span className="ms-2 font-normal text-muted-foreground tabular-nums">
							{new Intl.NumberFormat(locale).format(file.matters.length)}
						</span>
					</h3>
					<ul className="-mx-2 grid">
						{file.matters.map((matter) => (
							<li key={matter.id}>
								<Link
									to="/app/matters/$matterId"
									params={{ matterId: matter.id }}
									className="flex items-center justify-between gap-3 rounded-control px-2 py-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="grid min-w-0 text-sm">
										<span className="truncate font-medium" dir="auto">
											{matter.name}
										</span>
										<span className="text-muted-foreground text-xs">
											<span className="font-numeric tabular-nums">
												{matter.number}
											</span>
											{` · ${t(`areas.${matter.area}`)}`}
										</span>
									</span>
									<MatterStageBadge stage={matter.stage} />
								</Link>
							</li>
						))}
					</ul>
				</section>
				<section className="grid gap-2">
					<h3 className="font-semibold text-sm">{t("clients.invoices")}</h3>
					{file.invoices.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("clients.noInvoices")}
						</p>
					) : (
						<ul className="-mx-2 grid">
							{file.invoices.map((invoice) => (
								<li key={invoice.id}>
									<Link
										to="/app/billing"
										search={{ invoice: invoice.id }}
										className="flex items-center justify-between gap-3 rounded-control px-2 py-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										<span className="grid min-w-0 text-sm">
											<span className="font-medium tabular-nums">
												{invoice.number}
											</span>
											<span
												className="truncate text-muted-foreground text-xs"
												dir="auto"
											>
												{invoice.matterName}
											</span>
										</span>
										<span className="grid shrink-0 justify-items-end gap-1">
											<span className="text-sm tabular-nums">
												{money.format(invoice.amount)}
											</span>
											<InvoiceStatusBadge status={invoice.status} />
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</>
	);
}
