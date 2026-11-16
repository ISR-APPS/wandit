// "Consultation", the fixed closing of the page: the request folder beside the practical column
// (address, telephone, hours, the on-call line, the access note, and a small plate for the floor and the door).
// LandingPage renders it on the green room ground. Every call to action of the page points here.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL, SECTION_TITLE } from "../lib/type-styles";
import { Nameplate } from "./nameplate";
import { RequestFolder } from "./request-folder";
import { SectionHead } from "./section-head";

/** The folder takes the wide column. Each label of the practical column heads its own hairline. */
export function ContactSection() {
	const { t } = useT();
	const details = [
		{
			label: t("contact.addressLabel"),
			value: (
				<>
					{t("site.addressLine1")}
					<br />
					{t("site.addressLine2")}
				</>
			),
		},
		{
			label: t("contact.phoneLabel"),
			value: (
				<a href={t("site.phoneHref")} className="vt-renvoi tabular-nums">
					{t("site.phoneDisplay")}
				</a>
			),
		},
		{ label: t("contact.hoursLabel"), value: t("contact.hoursValue") },
		{ label: t("contact.onCallLabel"), value: t("contact.onCallValue") },
	];
	return (
		<section
			id="consultation"
			aria-labelledby="consultation-title"
			className="vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="contact.tab" note="contact.note" />
				<h2
					id="consultation-title"
					data-reveal
					className={cn(
						SECTION_TITLE,
						"mb-[clamp(2rem,4vw,3rem)] text-pretty sm:text-balance",
					)}
				>
					{/* One line per sentence from 640px. A phone runs both sentences as one paragraph with no lone word. */}
					<span className="sm:block">{t("contact.titleLine1")}</span>{" "}
					<span className="sm:block">{t("contact.titleLine2")}</span>
				</h2>
				<div className="grid gap-12 lg:grid-cols-[1.45fr_0.8fr] lg:gap-[clamp(2rem,4.5vw,4.5rem)]">
					<RequestFolder />
					<div data-reveal="end">
						<dl className="vt-line border-t">
							{details.map((detail, index) => (
								<div
									key={detail.label}
									className={cn("vt-faint pt-4 pb-1", index > 0 && "border-t")}
								>
									<dt className={cn(LABEL, "text-(--vt-brass) text-[10.5px]")}>
										{detail.label}
									</dt>
									<dd className="mt-2 mb-3 text-(--vt-ink-70) text-[0.95rem] leading-[1.55]">
										{detail.value}
									</dd>
								</div>
							))}
						</dl>
						{/* The access note is one more hairline row of the list above, with the same 16px rhythm. */}
						<div className="vt-faint border-t pt-4">
							<p className={cn(LABEL, "text-(--vt-brass) text-[10.5px]")}>
								{t("contact.accessLabel")}
							</p>
							<p className="mt-2 text-(--vt-ink-70) text-[0.95rem] leading-relaxed">
								{t("contact.accessBody")}
							</p>
							<Nameplate
								size="small"
								name={t("contact.doorName")}
								sub={t("contact.doorSub")}
								className="mt-6"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
