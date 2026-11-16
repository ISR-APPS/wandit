// The services: a sticker sheet of six tilted cards on a dotted cream ground, with a note sticker in the head.
// LandingPage renders it after the marquee. The cards come from SERVICES in lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SERVICES } from "../lib/content";
import { SECTION_LEDE, SECTION_TITLE, TAG, WRAP } from "../lib/styles";
import { PeekTooth } from "./peek-tooth";
import { ServiceCard } from "./service-card";

/** Three columns from 1024px, two from 640px, one on a phone. On a phone the grid keeps room for the hard shadow and the die-cut line. */
export function ServicesSection() {
	const { t } = useT();
	return (
		<section
			id="services"
			aria-labelledby="services-title"
			className="gd-dots relative scroll-mt-24 pt-[clamp(3.5rem,7vw,6.5rem)] pb-[clamp(4.5rem,8vw,7.5rem)]"
		>
			<div className={WRAP}>
				<div
					data-pop="self"
					className="mb-[clamp(2.6rem,4.5vw,3.8rem)] flex flex-wrap items-end justify-between gap-6"
				>
					<div className="max-w-[640px]">
						<p
							className={cn(
								TAG,
								"mb-4 rotate-2 bg-(--gd-teal) text-background",
							)}
						>
							{t("services.tag")}
						</p>
						<h2 id="services-title" className={cn(SECTION_TITLE, "mb-3")}>
							{t("services.title")}
						</h2>
						<p className={SECTION_LEDE}>{t("services.lede")}</p>
					</div>
					<p className="gd-outline-thin gd-shadow-4 max-w-[230px] rotate-2 rounded-[calc(var(--radius)*1)] bg-card px-[1.1em] py-[0.7em] font-bold font-display text-[0.95rem] leading-snug">
						{t("services.note")}
					</p>
				</div>
				<div
					data-pop="kids"
					className="grid gap-x-[clamp(1.6rem,2.6vw,2.4rem)] gap-y-[clamp(2.2rem,3.2vw,2.8rem)] max-sm:px-1.5 sm:grid-cols-2 lg:grid-cols-3"
				>
					{SERVICES.map((service, index) => (
						<ServiceCard key={service.id} service={service} index={index} />
					))}
				</div>
			</div>
			<PeekTooth className="absolute end-[3%] -top-7 w-[clamp(70px,7vw,92px)] rotate-9" />
		</section>
	);
}
