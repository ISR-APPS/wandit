// Section 05, sell: the pitch to owners, the agency facts, and the listing slip.
// LandingPage renders it on the secondary ground. It renders ListingSlip. The facts are fictional sample content.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReveal } from "../hooks/use-reveal";
import { DISPLAY, FIGURES, LABEL, WRAP } from "../lib/type-styles";
import { ListingSlip } from "./listing-slip";
import { SectionHead } from "./section-head";

/** Copy and facts at the start side, the slip at the end side; one column under 880px. */
export function SellSection() {
	const { t } = useT();
	const revealRef = useReveal<HTMLDivElement>();
	const facts = [
		{ label: t("sell.agency"), value: t("sell.address") },
		{ label: t("sell.hours"), value: t("sell.hoursValue") },
		{ label: t("sell.sunday"), value: t("sell.sundayValue") },
		{
			label: t("site.emailLabel"),
			value: t("site.email"),
			href: t("site.emailHref"),
		},
	];

	return (
		<section
			id="sell"
			aria-labelledby="sell-title"
			className={cn(WRAP, "bg-secondary py-[clamp(56px,8vw,110px)]")}
		>
			<SectionHead
				tag={t("sell.tag")}
				title={t("sell.title")}
				note={t("sell.note")}
				titleId="sell-title"
			/>
			<div
				ref={revealRef}
				className="rn-stagger grid items-start gap-[clamp(28px,4vw,64px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
			>
				<div>
					<p className="mb-6 max-w-[46ch] text-[16px] leading-relaxed">
						{t("sell.body")}
					</p>
					<dl className="border-foreground/12 border-t">
						{facts.map((fact) => (
							<div
								key={fact.label}
								className="flex items-baseline justify-between gap-4.5 border-foreground/12 border-b py-3"
							>
								<dt className={cn(LABEL, "shrink-0 text-[10px] opacity-65")}>
									{fact.label}
								</dt>
								<dd className="text-end font-bold text-[14px] leading-snug">
									{fact.href === undefined ? (
										fact.value
									) : (
										<a href={fact.href} className="hover:text-primary">
											{fact.value}
										</a>
									)}
								</dd>
							</div>
						))}
						<div className="flex items-center justify-between gap-4.5 border-foreground/12 border-b py-3">
							<dt className={cn(LABEL, "shrink-0 text-[10px] opacity-65")}>
								{t("sell.phone")}
							</dt>
							<dd>
								<a
									href={t("site.phoneHref")}
									className={cn(
										DISPLAY,
										FIGURES,
										"inline-flex min-h-11 items-center text-[clamp(26px,2.4vw,32px)] leading-none tracking-[0.03em] hover:text-primary",
									)}
								>
									{t("site.phoneDisplay")}
								</a>
							</dd>
						</div>
					</dl>
				</div>
				<ListingSlip />
			</div>
		</section>
	);
}
