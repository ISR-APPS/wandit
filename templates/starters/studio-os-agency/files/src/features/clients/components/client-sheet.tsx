// The side panel of one client: the account facts, the money, the projects, and the latest invoices.
// The Clients page opens it from a client name. It reads the client row and the project and invoice lists.
import { Link } from "@tanstack/react-router";
import {
	type ClientSummary,
	HealthBadge,
	InvoiceBadge,
	type InvoiceRow,
	PersonAvatar,
	PhaseBadge,
	type ProjectSummary,
	RelationBadge,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";

type ClientSheetProps = {
	/** The client to show. It stays set while the sheet slides out, so the panel never closes empty. */
	client: ClientSummary | null;
	/** True while the sheet is open. */
	open: boolean;
	/** Every project. The sheet keeps the projects of the client, live ones first. */
	projects: ProjectSummary[];
	/** Every invoice. The sheet keeps the 6 newest of the client. */
	invoices: InvoiceRow[];
	onOpenChange: (open: boolean) => void;
};

/** A controlled sheet. It renders nothing inside until a client is chosen. */
export function ClientSheet({
	client,
	open,
	projects,
	invoices,
	onOpenChange,
}: ClientSheetProps) {
	const { t } = useT();
	const format = useFormatters();
	const own = client
		? projects
				.filter((project) => project.clientId === client.id)
				.sort((first, second) => Number(second.isLive) - Number(first.isLive))
		: [];
	const ownInvoices = client
		? invoices.filter((invoice) => invoice.clientId === client.id).slice(0, 6)
		: [];
	return (
		<Sheet open={open && client !== null} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{client ? (
					<>
						<SheetHeader className="gap-2 border-b p-6">
							<SheetTitle className="font-display text-xl">
								{client.name}
							</SheetTitle>
							<SheetDescription className="flex flex-wrap items-center gap-2">
								<RelationBadge relation={client.relation} />
								<span>{t(`codes.industries.${client.industry}`)}</span>
							</SheetDescription>
						</SheetHeader>
						<div className="grid gap-6 p-6">
							<dl className="grid grid-cols-2 gap-3">
								{[
									{
										id: "billed",
										label: t("clients.billed"),
										value: format.money(client.billedLastYear),
										isBad: false,
									},
									{
										id: "outstanding",
										label: t("clients.outstanding"),
										value: format.money(client.outstanding),
										isBad: false,
									},
									{
										id: "overdue",
										label: t("clients.overdue"),
										value: format.money(client.overdue),
										isBad: client.overdue > 0,
									},
									// A new client with no project yet has no start day to show.
									...(client.sinceDay === null
										? []
										: [
												{
													id: "since",
													label: t("clients.since"),
													value: format.longDate(client.sinceDay),
													isBad: false,
												},
											]),
								].map((fact) => (
									<div
										key={fact.id}
										className="grid gap-1 rounded-control bg-muted/60 p-3"
									>
										<dt className="text-muted-foreground text-xs">
											{fact.label}
										</dt>
										<dd
											className={cn(
												"font-numeric font-semibold tabular-nums",
												fact.isBad && "text-destructive",
											)}
										>
											{fact.value}
										</dd>
									</div>
								))}
							</dl>
							<dl className="flex items-center justify-between gap-3 text-sm">
								<dt className="text-muted-foreground">{t("clients.lead")}</dt>
								<dd className="flex items-center gap-2 font-medium">
									<PersonAvatar
										name={client.leadName}
										className="size-6 text-[0.625rem]"
									/>
									{client.leadName}
								</dd>
							</dl>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{t("clients.projects")}
								</h2>
								<ul className="grid">
									{own.map((project) => (
										<li
											key={project.id}
											className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-b-0"
										>
											<Link
												to="/app/projects/$projectId"
												params={{ projectId: project.id }}
												className="font-medium text-sm hover:underline"
											>
												{project.name}
											</Link>
											<span className="flex gap-1.5">
												<PhaseBadge phase={project.phase} />
												{project.health ? (
													<HealthBadge health={project.health} />
												) : null}
											</span>
										</li>
									))}
								</ul>
							</section>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{t("clients.latestInvoices")}
								</h2>
								{ownInvoices.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("clients.noInvoices")}
									</p>
								) : (
									<ul className="grid">
										{ownInvoices.map((invoice) => (
											<li
												key={invoice.id}
												className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b py-2.5 text-sm last:border-b-0"
											>
												<span className="grid">
													<span
														className={cn(
															"font-medium tabular-nums",
															invoice.number === null &&
																"text-muted-foreground",
														)}
													>
														{invoice.number ?? t("invoices.draftNumber")}
													</span>
													<span className="text-muted-foreground text-xs">
														{format.shortDate(invoice.issueDay)}
													</span>
												</span>
												<InvoiceBadge status={invoice.status} />
												<span className="w-20 text-end font-medium tabular-nums">
													{format.money(invoice.amount)}
												</span>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
