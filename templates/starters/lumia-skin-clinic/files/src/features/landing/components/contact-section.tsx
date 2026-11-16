// The closing of the page: "Book an appointment." A blush panel holds the booking by telephone or email,
// the three facts to give, and, beside them, a calm portrait with the address, the hours, and the contacts.
// LandingPage renders it on the deeper cream. It has no form: STARTER.md says where a real booking form goes.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import {
	GHOST_CAPSULE,
	GUTTER,
	PRIMARY_CAPSULE,
	SECTION_TITLE,
	SECTION_Y,
	WRAP,
} from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { PhotoMask } from "./photo-mask";

/** The <section id="contact"> that every booking capsule of the page opens. */
export function ContactSection() {
	const { t } = useT();
	const steps = [t("contact.step1"), t("contact.step2"), t("contact.step3")];
	const facts = [
		{
			label: t("contact.addressLabel"),
			value: t("contact.addressValue"),
			href: undefined,
		},
		{
			label: t("contact.hoursLabel"),
			value: t("contact.hoursValue"),
			href: undefined,
		},
		{
			label: t("site.phoneLabel"),
			value: t("site.phoneDisplay"),
			href: t("site.phoneHref"),
		},
		{
			label: t("contact.emailLabel"),
			value: t("site.emailDisplay"),
			href: t("site.emailHref"),
		},
	];
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className={cn(
				"scroll-mt-4 bg-(--lumia-cream-deep) pb-[clamp(4.5rem,9vh,7rem)]",
				GUTTER,
				SECTION_Y,
			)}
		>
			<div className={WRAP}>
				<h2
					id="contact-title"
					data-reveal=""
					className={cn(SECTION_TITLE, "mb-[clamp(2rem,4vw,3rem)]")}
				>
					{t("contact.title")}
				</h2>
				<div
					data-reveal=""
					className="grid gap-[clamp(2rem,5vw,4.5rem)] rounded-[28px] bg-(--lumia-blush) p-[1.15rem] md:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.8fr)] min-[461px]:rounded-[32px] min-[461px]:p-[clamp(1.35rem,4vw,3.5rem)]"
				>
					<div className="grid min-w-0 content-start gap-6">
						<CapsuleBadge tone="cream">{t("contact.badge")}</CapsuleBadge>
						<p className="max-w-[22ch] text-balance font-display text-[clamp(1.8rem,3.2vw,2.7rem)] leading-[1.12]">
							{t("contact.lead")}
						</p>
						<div className="grid gap-3">
							<p className="font-semibold text-(--lumia-ink-soft) text-[15px]">
								{t("contact.stepsLabel")}
							</p>
							{/* Hairline rows, not filled boxes: filled rows read as form fields that the visitor cannot type in. */}
							<ol className="m-0 grid list-none border-foreground/20 border-t p-0">
								{steps.map((step, index) => (
									<li
										key={step}
										className="flex min-h-[54px] items-center gap-4 border-foreground/20 border-b py-3 text-[16px] leading-snug"
									>
										<span
											aria-hidden="true"
											className="w-7 shrink-0 font-display text-(--lumia-bronze-deep) text-[1.35rem] tabular-nums leading-none"
										>
											{String(index + 1).padStart(2, "0")}
										</span>
										{step}
									</li>
								))}
							</ol>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<a href={t("site.phoneHref")} className={PRIMARY_CAPSULE}>
								{t("contact.callCta")}
							</a>
							<a href={t("site.emailHref")} className={GHOST_CAPSULE}>
								{t("contact.emailCta")}
							</a>
						</div>
						<p className="max-w-[46ch] text-(--lumia-ink-soft) text-[15px] leading-[1.55]">
							{t("contact.reassurance")}
						</p>
					</div>
					<aside
						aria-label={t("contact.factsLabel")}
						className="grid min-w-0 content-start gap-6"
					>
						<PhotoMask
							photo={PHOTOS.portrait}
							alt={t("contact.photoAlt")}
							maskClassName="h-[clamp(270px,75vw,420px)] rounded-[40px] md:h-[clamp(280px,31vw,410px)]"
							imageClassName="object-[center_24%]"
						/>
						{/* From 360px each row is a subgrid of the list, so every value starts at the edge of the widest label. */}
						<dl className="m-0 grid gap-2 px-0.5 min-[360px]:grid-cols-[auto_minmax(0,1fr)] min-[360px]:gap-x-3">
							{facts.map((fact) => (
								<div
									key={fact.label}
									className="grid items-center gap-2 text-(--lumia-ink-soft) text-[15px] min-[360px]:col-span-2 min-[360px]:min-h-11 min-[360px]:grid-cols-subgrid"
								>
									<dt>
										<CapsuleBadge tone="cream">{fact.label}</CapsuleBadge>
									</dt>
									<dd className="m-0 min-w-0 break-words">
										{fact.href === undefined ? (
											// The same 44px box as a link value, so every row has the same height on a phone.
											<span className="inline-flex min-h-11 items-center">
												{fact.value}
											</span>
										) : (
											<a
												href={fact.href}
												className="inline-flex min-h-11 items-center font-semibold text-foreground underline decoration-1 underline-offset-[0.22em] hover:text-(--lumia-bronze-deep)"
											>
												{fact.value}
											</a>
										)}
									</dd>
								</div>
							))}
						</dl>
					</aside>
				</div>
			</div>
		</section>
	);
}
