// The booking slip of the Contact section: the four lines that a first message needs, and the two ways to send it.
// contact-section.tsx renders it. It reads the "contact" group of messages.ts.
// It posts no data: one link opens an email with the four lines ready, the other calls the studio.
import { useT } from "~/shared/i18n";
import { BUTTON_FILL, BUTTON_GHOST, LABEL } from "../lib/styles";

/** A hairline plate on the page ground. A real form with a table replaces it (STARTER.md says how). */
export function MessageSlip() {
	const { t } = useT();
	const lines = [
		{ label: t("contact.slipTypeLabel"), value: t("contact.slipTypeValue") },
		{ label: t("contact.slipDateLabel"), value: t("contact.slipDateValue") },
		{ label: t("contact.slipPhoneLabel"), value: t("contact.slipPhoneValue") },
		{ label: t("contact.slipKeepLabel"), value: t("contact.slipKeepValue") },
	];
	return (
		<div className="yr-cut border border-foreground/30 bg-background [--cut:1]">
			<p className="yr-mono flex items-center justify-between gap-4 border-foreground/15 border-b px-[clamp(16px,2.2vw,28px)] py-3.5 text-[0.68rem] text-foreground uppercase leading-normal tracking-[0.14em]">
				<span>{t("contact.slipKicker")}</span>
				<span aria-hidden="true" className="text-primary">
					{t("contact.slipCount")}
				</span>
			</p>
			<ol className="px-[clamp(16px,2.2vw,28px)]">
				{lines.map((line, index) => (
					<li
						key={line.label}
						className="grid gap-x-5 gap-y-1 border-foreground/15 border-b py-4 min-[621px]:grid-cols-[2.2rem_minmax(0,0.8fr)_minmax(0,1.4fr)] min-[621px]:items-baseline"
					>
						<span
							aria-hidden="true"
							className="yr-mono text-[0.64rem] text-primary tracking-[0.12em] max-[620px]:hidden"
						>
							{String(index + 1).padStart(2, "0")}
						</span>
						<span className={LABEL}>{line.label}</span>
						<span className="text-[0.98rem] leading-[1.5]">{line.value}</span>
					</li>
				))}
			</ol>
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-[clamp(16px,2.2vw,28px)] py-[clamp(16px,2.2vw,24px)]">
				<p className="yr-mono max-w-[38ch] text-[0.72rem] text-primary leading-[1.6] tracking-[0.03em]">
					{t("contact.slipNote")}
				</p>
				<div className="flex flex-wrap gap-2.5 max-[620px]:w-full max-[620px]:flex-col">
					<a href={t("contact.slipEmailHref")} className={BUTTON_FILL}>
						{t("contact.slipEmailCta")}
					</a>
					<a href={t("site.phoneHref")} className={BUTTON_GHOST}>
						{t("contact.slipPhoneCta")}
					</a>
				</div>
			</div>
		</div>
	);
}
