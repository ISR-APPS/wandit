// The appointment section, the last section of the page. LandingPage renders it.
// How to reach the studio is at 7 of 12. The studio facts and the fees are at 5.
// A plate and one photo band of the studio follow, across the twelve columns.
// It posts no data: the two actions are a tel: link and a mailto: link.
// STARTER.md says where a real booking form goes.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	GRID,
	INK_BUTTON,
	MICRO_CAPS,
	RULE_LABEL,
	SECTION_TITLE,
	SERIF_NAME,
	TEXT_LINK,
	WRAP,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { GlyphList } from "./glyph-list";
import { Plinth } from "./plinth";
import { StudioAside } from "./studio-aside";

/** Section "Appointment". The two columns end together, so no column is empty above the band. */
export function ContactSection() {
	const { t } = useT();
	const channels = [
		{
			label: t("contact.phoneLabel"),
			value: t("site.phoneDisplay"),
			href: t("site.phoneHref"),
			note: t("contact.phoneNote"),
		},
		{
			label: t("contact.emailLabel"),
			value: t("site.email"),
			href: t("site.emailHref"),
			note: t("contact.emailNote"),
		},
	];
	return (
		<section
			id="contact"
			className="scroll-mt-28 py-(--ms-rhythm) md:scroll-mt-19"
		>
			<div className={cn(WRAP, GRID, "gap-y-12")}>
				<div className="md:col-span-7">
					<p data-reveal="lift" className={RULE_LABEL}>
						{t("contact.label")}
					</p>
					<h2 data-reveal="lift" className={cn(SECTION_TITLE, "mt-[1.1rem]")}>
						<span className="block">{t("contact.title1")}</span>
						<span className="block">{t("contact.title2")}</span>
					</h2>
					<p
						data-reveal="lift"
						className="mt-5 max-w-[48ch] text-[clamp(1.02rem,1.15vw,1.18rem)] text-foreground/70 leading-[1.66]"
					>
						{t("contact.lede")}
					</p>

					<dl data-reveal="lift" className="mt-[clamp(1.8rem,3vw,2.6rem)]">
						{channels.map((channel) => (
							<div
								key={channel.href}
								className="grid gap-x-(--ms-gap) gap-y-1.5 border-foreground/18 border-t py-5 last:border-b sm:grid-cols-[8.5rem_1fr]"
							>
								<dt className={cn(MICRO_CAPS, "sm:pt-3")}>{channel.label}</dt>
								<dd className="min-w-0">
									{/* The negative margin gives the link a 45px box and keeps the row height. */}
									<a
										href={channel.href}
										className="-my-2 ms-serif ms-warm-hover inline-block break-words py-2 text-[clamp(1.45rem,2.7vw,2.2rem)] leading-tight"
									>
										<span className="ms-warm-line border-transparent border-b">
											{channel.value}
										</span>
									</a>
									<span className="mt-1.5 block text-[0.86rem] text-muted-foreground leading-[1.55]">
										{channel.note}
									</span>
								</dd>
							</div>
						))}
					</dl>

					<div className="mt-[clamp(1.6rem,2.6vw,2.4rem)] flex flex-wrap items-center gap-x-8 gap-y-5">
						<a href={t("site.phoneHref")} className={INK_BUTTON}>
							{t("contact.cta")}
						</a>
						<a href={t("site.emailHref")} className={TEXT_LINK}>
							<span className="ms-warm-line border-foreground/18 border-b pb-[0.15rem]">
								{t("contact.ctaAlt")}
							</span>
						</a>
					</div>

					<p className="mt-5 max-w-[52ch] text-[0.88rem] text-muted-foreground leading-[1.6]">
						{t("contact.feeNote")}
					</p>
				</div>

				<StudioAside className="md:col-span-5" />

				{/* A plate across the twelve columns: who calls back, and what to prepare. It has the raised shadow of a plinth. */}
				<div
					data-reveal="lift"
					className={cn(
						GRID,
						"ms-plinth items-center gap-y-5 border border-foreground/10 bg-card p-[clamp(1.4rem,3vw,2.4rem)] md:col-span-12",
					)}
				>
					<div className="md:col-span-6">
						<h3 className={SERIF_NAME}>{t("contact.prepareTitle")}</h3>
						<p className="mt-2 max-w-[52ch] text-[0.98rem] text-foreground/70 leading-[1.72]">
							{t("contact.prepareBody")}
						</p>
					</div>
					<GlyphList
						className="md:col-span-5 md:col-start-8"
						facts={[
							{ glyph: "plan", text: t("contact.prepare1") },
							{ glyph: "window", text: t("contact.prepare2") },
							{ glyph: "stair", text: t("contact.prepare3") },
						]}
					/>
				</div>

				<Aperture
					src="/images/studio.webp"
					alt={t("contact.studioAlt")}
					width={1440}
					height={1920}
					shape="bandFromPortrait"
					focusClassName="object-[center_64%]"
					className="mb-14 md:col-span-12 md:mb-8.5"
				>
					<Plinth
						corner="bottom-start"
						label={t("contact.studioPlinthLabel")}
						title={t("contact.studioPlinthTitle")}
						note={t("contact.studioPlinthNote")}
					/>
				</Aperture>
			</div>
		</section>
	);
}
