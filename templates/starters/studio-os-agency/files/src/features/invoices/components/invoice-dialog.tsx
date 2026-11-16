// The dialog of one invoice: the client and project, the days, the lines, and the total.
// The Invoices page opens it from the invoice number. It reads only the InvoiceRow; it saves nothing.
import { Link } from "@tanstack/react-router";
import {
	InvoiceBadge,
	type InvoiceLine,
	type InvoiceRow,
	parseDay,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type InvoiceDialogProps = {
	/** The invoice to show. It stays set while the dialog fades out, so the dialog never closes empty. */
	invoice: InvoiceRow | null;
	/** True while the dialog is open. */
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. The lines add up to the total, so the footer repeats the invoice amount. */
export function InvoiceDialog({
	invoice,
	open,
	onOpenChange,
}: InvoiceDialogProps) {
	const { t, locale } = useT();
	const format = useFormatters();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const month = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});

	/** The text of one line, from its kind. */
	function describe(line: InvoiceLine): { label: string; detail: string } {
		switch (line.kind) {
			case "stage":
				return {
					label: t("invoices.lineStage")
						.replace("{stage}", String(line.stage))
						.replace("{count}", String(line.stageCount)),
					detail: t("invoices.lineShare").replace(
						"{share}",
						percent.format(line.share),
					),
				};
			case "retainer":
				return {
					label: t("invoices.lineRetainer"),
					detail: month.format(parseDay(line.month)),
				};
			case "hours":
				return {
					label: t(`codes.roles.${line.role}`),
					detail: `${format.hours(line.hours)} × ${format.money(line.rate)}`,
				};
		}
	}

	return (
		<Dialog open={open && invoice !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				{invoice ? (
					<>
						<DialogHeader>
							<DialogTitle className="flex flex-wrap items-center gap-3 font-display text-xl tabular-nums">
								{invoice.number ?? t("invoices.draftNumber")}
								<InvoiceBadge status={invoice.status} />
							</DialogTitle>
							<DialogDescription>
								{`${invoice.clientName} · `}
								<Link
									to="/app/projects/$projectId"
									params={{ projectId: invoice.projectId }}
									className="font-medium text-foreground underline-offset-4 hover:underline"
								>
									{invoice.projectName}
								</Link>
							</DialogDescription>
						</DialogHeader>
						<dl className="grid grid-cols-3 gap-3 rounded-control bg-muted/60 p-3 text-sm">
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground text-xs">
									{t(
										invoice.status === "draft"
											? "invoices.planned"
											: "invoices.issued",
									)}
								</dt>
								<dd className="font-medium">
									{format.longDate(invoice.issueDay)}
								</dd>
							</div>
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground text-xs">
									{t("invoices.due")}
								</dt>
								<dd className="font-medium">
									{format.longDate(invoice.dueDay)}
								</dd>
							</div>
							<div className="grid gap-0.5">
								<dt className="text-muted-foreground text-xs">
									{t("invoices.paid")}
								</dt>
								<dd className="font-medium">
									{invoice.paidDay
										? format.longDate(invoice.paidDay)
										: t("invoices.notPaid")}
								</dd>
							</div>
						</dl>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("invoices.line")}</TableHead>
									<TableHead className="text-end">
										{t("invoices.amount")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invoice.lines.map((line) => {
									const text = describe(line);
									return (
										<TableRow key={line.id}>
											<TableCell>
												<div className="grid">
													<span className="font-medium">{text.label}</span>
													<span className="text-muted-foreground text-xs tabular-nums">
														{text.detail}
													</span>
												</div>
											</TableCell>
											<TableCell className="text-end tabular-nums">
												{format.money(line.amount)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell>{t("invoices.total")}</TableCell>
									<TableCell className="text-end font-numeric font-semibold text-base tabular-nums">
										{format.money(invoice.amount)}
									</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
