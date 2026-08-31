import { BILLING_CATALOG, priceUsdFor } from "@wandit/contracts";
import { CheckIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PropsWithChildren, ReactNode } from "react";
import type {
	AdminManualPayment,
	AdminManualSubscriptionDetail,
} from "@/features/offline-billing/api/offline-billing.dto";
import {
	computeDzdPlanPrice,
	convertReceiptPaymentAmount,
	createReceiptNumber,
	formatReceiptAmount,
	formatReceiptDate,
	formatReceiptDateTime,
	formatWholeDzdAmount,
	getFrenchBillingIntervalLabel,
	getFrenchCountryLabel,
	getFrenchPaymentKindLabel,
	getFrenchPaymentMethodLabel,
	getReceiptCustomerName,
	groupPaymentTotalsByCurrency,
	RECEIPT_PLAN_FEATURES,
} from "@/features/offline-billing/lib/receipt";
import { WEB_APP_ORIGIN } from "@/lib/web-origin";

const WEB_APP_DOMAIN = new URL(WEB_APP_ORIGIN).host;

type OfflineReceiptProps = {
	subscription: AdminManualSubscriptionDetail;
	generatedAt: Date;
	dzdPerUsdRate: number;
};

export function OfflineReceipt({
	subscription,
	generatedAt,
	dzdPerUsdRate,
}: OfflineReceiptProps) {
	return (
		<article
			id="offline-receipt-print-root"
			lang="fr"
			aria-labelledby="offline-receipt-title"
			className="mx-auto w-full max-w-[210mm] rounded-sm border border-[#e7e0d7] bg-white px-6 py-8 text-[#191613] tracking-normal shadow-[0_24px_80px_rgba(25,22,19,0.12)] sm:px-10 sm:py-10 lg:px-14 lg:py-12"
			style={{
				colorScheme: "light",
				fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
				letterSpacing: "normal",
			}}
		>
			<ReceiptHeader subscription={subscription} generatedAt={generatedAt} />

			<div className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-10">
				<CustomerDetails subscription={subscription} />
				<OrderDetails
					subscription={subscription}
					dzdPerUsdRate={dzdPerUsdRate}
				/>
			</div>

			<PaymentsSection
				payments={subscription.payments}
				dzdPerUsdRate={dzdPerUsdRate}
			/>
			<PlanContents plan={subscription.plan} />
			<ReceiptFooter generatedAt={generatedAt} />
		</article>
	);
}

function ReceiptHeader({
	subscription,
	generatedAt,
}: Pick<OfflineReceiptProps, "subscription" | "generatedAt">) {
	return (
		<header className="offline-receipt-section flex flex-col gap-6 border-[#191613] border-t-[3px] pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
			<WanditReceiptLogo />
			<div className="min-w-0 text-left sm:text-right">
				<p className="font-semibold text-[#a65318] text-[11px] uppercase tracking-[0.24em]">
					REÇU
				</p>
				<h1
					id="offline-receipt-title"
					className="mt-1 font-semibold text-[25px] leading-tight tracking-[-0.03em]"
				>
					Reçu de commande
				</h1>
				<dl className="mt-4 grid grid-cols-[auto_auto] justify-start gap-x-3 gap-y-1 text-[11px] leading-5 sm:justify-end">
					<dt className="text-[#766d63]">N° du reçu</dt>
					<dd className="font-medium font-mono text-[#191613]">
						{createReceiptNumber(subscription.id)}
					</dd>
					<dt className="text-[#766d63]">Date d’émission</dt>
					<dd className="font-medium text-[#191613]">
						{formatReceiptDate(generatedAt)}
					</dd>
				</dl>
			</div>
		</header>
	);
}

function WanditReceiptLogo() {
	return (
		<div className="inline-flex shrink-0 items-center gap-2 text-[#191613]">
			<svg
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
				className="size-7 text-[#f08c2e]"
			>
				<path d="M12 2c1.05 4.44 3.94 7.33 10 10-6.06 1.06-8.95 3.95-10 10-1.05-4.44-3.94-7.33-10-10 6.06-1.06 8.95-3.95 10-10Z" />
			</svg>
			<span className="font-bold text-[28px] leading-none tracking-[-0.055em]">
				wandit
			</span>
		</div>
	);
}

function CustomerDetails({
	subscription,
}: {
	subscription: AdminManualSubscriptionDetail;
}) {
	const { request, user, organization } = subscription;
	const location = request
		? [request.city, getFrenchCountryLabel(request.country)]
				.filter(Boolean)
				.join(", ")
		: null;

	return (
		<ReceiptSection title="Client">
			<dl className="space-y-2.5">
				<DefinitionRow label="Nom">
					{getReceiptCustomerName(subscription)}
				</DefinitionRow>
				<DefinitionRow label="E-mail">{user.email}</DefinitionRow>
				{request?.phone ? (
					<DefinitionRow label="Téléphone">{request.phone}</DefinitionRow>
				) : null}
				{request?.company ? (
					<DefinitionRow label="Entreprise">{request.company}</DefinitionRow>
				) : null}
				{organization ? (
					<DefinitionRow label="Espace de travail">
						{organization.name}
					</DefinitionRow>
				) : null}
				{location ? (
					<DefinitionRow label="Localisation">{location}</DefinitionRow>
				) : null}
			</dl>
		</ReceiptSection>
	);
}

function OrderDetails({
	subscription,
	dzdPerUsdRate,
}: {
	subscription: AdminManualSubscriptionDetail;
	dzdPerUsdRate: number;
}) {
	const planName = subscription.plan === "pro" ? "Pro" : "Business";
	const tierCredits = BILLING_CATALOG.creditTiers.find(
		(tier) => tier === subscription.tierCredits,
	);
	const priceDzd =
		tierCredits === undefined
			? null
			: computeDzdPlanPrice(
					priceUsdFor(subscription.plan, tierCredits, subscription.interval),
					dzdPerUsdRate,
				);

	return (
		<ReceiptSection title="Commande / Abonnement">
			<dl className="space-y-2.5">
				<DefinitionRow label="Offre">Wandit {planName}</DefinitionRow>
				<DefinitionRow label="Crédits">
					{subscription.tierCredits.toLocaleString("fr-FR")} crédits / mois
				</DefinitionRow>
				<DefinitionRow label="Facturation">
					{getFrenchBillingIntervalLabel(subscription.interval)}
				</DefinitionRow>
				{priceDzd === null ? null : (
					<DefinitionRow label="Prix">
						{formatWholeDzdAmount(priceDzd)}{" "}
						{subscription.interval === "month" ? "/ mois" : "/ an"}
					</DefinitionRow>
				)}
				<DefinitionRow label="Période">
					{formatReceiptDate(subscription.currentPeriodStart)} –{" "}
					{formatReceiptDate(subscription.currentPeriodEnd)}
				</DefinitionRow>
			</dl>
			<p className="mt-5 break-all border-[#ded7ce] border-t pt-3 font-mono text-[#766d63] text-[9px] leading-4">
				ID abonnement : {subscription.id}
			</p>
		</ReceiptSection>
	);
}

function ReceiptSection({
	title,
	children,
}: PropsWithChildren<{ title: string }>) {
	return (
		<section className="offline-receipt-section min-w-0">
			<div className="mb-4 flex items-center gap-3">
				<span className="h-px w-6 bg-[#f08c2e]" aria-hidden="true" />
				<h2 className="font-semibold text-[11px] uppercase tracking-[0.16em]">
					{title}
				</h2>
			</div>
			{children}
		</section>
	);
}

function DefinitionRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="grid grid-cols-[88px_1fr] gap-3 text-[11px] leading-[1.55]">
			<dt className="text-[#766d63]">{label}</dt>
			<dd className="min-w-0 break-words font-medium text-[#191613]">
				{children}
			</dd>
		</div>
	);
}

function PaymentsSection({
	payments,
	dzdPerUsdRate,
}: {
	payments: AdminManualPayment[];
	dzdPerUsdRate: number;
}) {
	const totals = groupPaymentTotalsByCurrency(payments, dzdPerUsdRate);

	return (
		<section className="mt-10 border-[#191613] border-t pt-6">
			<div className="offline-receipt-section mb-4 flex items-end justify-between gap-4">
				<div>
					<p className="font-semibold text-[#a65318] text-[10px] uppercase tracking-[0.18em]">
						Historique
					</p>
					<h2
						id="offline-receipt-payments-title"
						className="mt-1 font-semibold text-[17px] tracking-[-0.02em]"
					>
						Paiements
					</h2>
				</div>
				<p className="text-[#766d63] text-[10px]">
					{payments.length} {payments.length === 1 ? "paiement" : "paiements"}
				</p>
			</div>

			{payments.length === 0 ? (
				<p className="offline-receipt-section border border-[#ded7ce] bg-[#faf8f5] px-5 py-5 text-[#5f574f] text-[11px] leading-5">
					Aucun paiement n’est enregistré pour cet abonnement.
				</p>
			) : (
				<div className="offline-receipt-scroll overflow-x-auto">
					<table
						aria-labelledby="offline-receipt-payments-title"
						className="w-full min-w-[680px] border-collapse text-left text-[10px] leading-[1.45]"
					>
						<thead>
							<tr className="border-[#bfb7ad] border-b text-[#766d63] uppercase tracking-[0.08em]">
								<PaymentHeader>Date</PaymentHeader>
								<PaymentHeader>Nature</PaymentHeader>
								<PaymentHeader>Méthode</PaymentHeader>
								<PaymentHeader>Référence</PaymentHeader>
								<PaymentHeader>Période financée</PaymentHeader>
								<PaymentHeader className="text-right">Montant</PaymentHeader>
							</tr>
						</thead>
						<tbody>
							{payments.map((payment) => {
								const receiptAmount = convertReceiptPaymentAmount(
									payment,
									dzdPerUsdRate,
								);

								return (
									<tr
										key={payment.id}
										className="border-[#e5dfd7] border-b align-top"
									>
										<PaymentCell className="whitespace-nowrap">
											{formatReceiptDate(payment.createdAt)}
										</PaymentCell>
										<PaymentCell>
											{getFrenchPaymentKindLabel(payment.kind)}
										</PaymentCell>
										<PaymentCell>
											{getFrenchPaymentMethodLabel(payment.method)}
										</PaymentCell>
										<PaymentCell className="max-w-24 break-words font-mono text-[9px]">
											{payment.reference ?? "—"}
										</PaymentCell>
										<PaymentCell className="whitespace-nowrap">
											{formatReceiptDate(payment.periodStart)} –{" "}
											{formatReceiptDate(payment.periodEnd)}
										</PaymentCell>
										<PaymentCell className="whitespace-nowrap text-right font-semibold tabular-nums">
											{receiptAmount
												? formatReceiptAmount(
														receiptAmount.amountMinor,
														receiptAmount.currency,
													)
												: "—"}
										</PaymentCell>
									</tr>
								);
							})}
						</tbody>
						<tfoot>
							<tr className="border-[#191613] border-t">
								<td
									colSpan={5}
									className="px-2 py-3 text-right font-semibold text-[10px] uppercase tracking-[0.1em]"
								>
									Total
								</td>
								<td className="px-2 py-3 text-right font-semibold text-[10px] tabular-nums leading-5">
									{totals.length === 0
										? "—"
										: totals.map((total) => (
												<span
													key={total.currency}
													className="block whitespace-nowrap"
												>
													{total.amountMinor === null
														? "—"
														: formatReceiptAmount(
																total.amountMinor,
																total.currency,
															)}
												</span>
											))}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			)}
		</section>
	);
}

function PaymentHeader({
	children,
	className = "",
}: PropsWithChildren<{ className?: string }>) {
	return (
		<th scope="col" className={`px-2 py-2 font-medium ${className}`}>
			{children}
		</th>
	);
}

function PaymentCell({
	children,
	className = "",
}: PropsWithChildren<{ className?: string }>) {
	return (
		<td className={`px-2 py-3 text-[#332e29] ${className}`}>{children}</td>
	);
}

function PlanContents({
	plan,
}: {
	plan: AdminManualSubscriptionDetail["plan"];
}) {
	return (
		<section className="offline-receipt-section mt-9 border-[#ded7ce] border-t pt-6">
			<h2 className="font-semibold text-[15px] tracking-[-0.02em]">
				Votre abonnement comprend :
			</h2>
			<ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
				{RECEIPT_PLAN_FEATURES[plan].map((feature) => (
					<li
						key={feature}
						className="flex items-start gap-2.5 text-[#4d4640] text-[10px] leading-[1.55]"
					>
						<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#fff0df] text-[#c96816]">
							<CheckIcon
								className="size-2.5"
								strokeWidth={2.5}
								aria-hidden="true"
							/>
						</span>
						<span>{feature}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

function ReceiptFooter({ generatedAt }: { generatedAt: Date }) {
	return (
		<footer className="offline-receipt-section mt-10 border-[#191613] border-t pt-7">
			<div className="grid items-center gap-7 sm:grid-cols-[1fr_150px]">
				<div>
					<div className="border border-[#f1c89f] border-s-4 border-s-[#f08c2e] bg-[#fff8f0] px-5 py-4">
						<p className="font-medium text-[#362d26] text-[11px] leading-[1.65]">
							Veuillez prendre en photo ce reçu et l’envoyer au numéro WhatsApp
							qui vous a contacté afin de confirmer votre paiement.
						</p>
					</div>
					<div className="mt-6 text-[10px] leading-5">
						<p className="font-semibold text-[#191613]">
							Merci de votre confiance.
						</p>
						<p className="text-[#766d63]">
							Ce reçu a été généré par Wandit le{" "}
							{formatReceiptDateTime(generatedAt)}.
						</p>
					</div>
				</div>

				<div className="justify-self-center text-center sm:justify-self-end">
					<div className="inline-flex border border-[#ded7ce] bg-white p-2">
						<QRCodeSVG
							value={WEB_APP_ORIGIN}
							size={108}
							bgColor="#ffffff"
							fgColor="#191613"
							level="M"
							title="Accéder à la plateforme Wandit"
						/>
					</div>
					<p className="mt-2 max-w-[150px] text-[#4d4640] text-[9px] leading-4">
						Scannez pour accéder à la plateforme
					</p>
					<p className="font-mono text-[#766d63] text-[9px]">
						{WEB_APP_DOMAIN}
					</p>
				</div>
			</div>
		</footer>
	);
}
