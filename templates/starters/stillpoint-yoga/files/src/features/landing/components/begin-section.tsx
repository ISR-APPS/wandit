// The booking band: the invitation, the four contact rows, the free first class line, and the reserve panel.
// LandingPage renders it on the surface bone, under a sage field. Every action is a mailto or a tel link.
import { useT } from "~/shared/i18n";
import { SECTION_TITLE, SECTION_Y, WRAP } from "../lib/styles";
import { Eyebrow } from "./eyebrow";
import { ReservePanel } from "./reserve-panel";

/** The begin section, anchor #begin. The panel moves under the text below 880px. */
export function BeginSection() {
	const { t } = useT();
	const rowClass =
		"flex justify-between gap-5 border-(--sp-line) border-b px-0.5 py-4 text-[0.95rem]";
	const keyClass =
		"self-center font-bold font-sans text-(--sp-ink-64) text-[0.7rem] uppercase tracking-[0.22em]";
	const linkClass =
		"inline-flex min-h-11 items-center border-transparent border-b no-underline transition-colors duration-500 hover:border-(--sp-terra) hover:text-(--sp-terra-ink) -my-3";
	return (
		<section
			id="begin"
			aria-labelledby="begin-title"
			className={`${SECTION_Y} relative overflow-hidden border-(--sp-line-soft) border-t bg-(--sp-surface)`}
		>
			<div
				aria-hidden="true"
				data-tone="sage"
				className="sp-blob -end-36 -top-40 size-[520px] opacity-40"
			/>
			<div
				className={`${WRAP} relative grid gap-[clamp(40px,6vw,96px)] min-[880px]:grid-cols-[0.9fr_1.1fr]`}
			>
				<div>
					<Eyebrow>{t("begin.eyebrow")}</Eyebrow>
					<h2
						id="begin-title"
						data-reveal
						className={`${SECTION_TITLE} mt-[22px] max-w-[12ch]`}
					>
						{t("begin.titleLead")}{" "}
						<em className="text-primary italic">{t("begin.titleEm")}</em>
					</h2>
					<p
						data-reveal
						className="mt-[22px] max-w-[42ch] text-pretty text-(--sp-ink-78)"
					>
						{t("begin.body")}
					</p>
					<div
						data-reveal
						className="mt-[38px] flex flex-col border-(--sp-line) border-t"
					>
						<div className={rowClass}>
							<span className={keyClass}>{t("begin.visitLabel")}</span>
							<span className="text-end">{t("begin.visitValue")}</span>
						</div>
						<div className={rowClass}>
							<span className={keyClass}>{t("begin.callLabel")}</span>
							<a
								href={t("begin.phoneHref")}
								className={`${linkClass} tabular-nums`}
							>
								{t("begin.phoneDisplay")}
							</a>
						</div>
						<div className={rowClass}>
							<span className={keyClass}>{t("begin.writeLabel")}</span>
							<a
								href={`mailto:${t("begin.emailDisplay")}`}
								className={`${linkClass} break-all`}
							>
								{t("begin.emailDisplay")}
							</a>
						</div>
						<div className={rowClass}>
							<span className={keyClass}>{t("begin.doorsLabel")}</span>
							<span className="text-end tabular-nums">
								<span className="whitespace-nowrap">
									{t("begin.doorsWeek")}
								</span>
								<br />
								<span className="whitespace-nowrap">
									{t("begin.doorsWeekend")}
								</span>
							</span>
						</div>
					</div>
					<p
						data-reveal
						className="mt-[26px] inline-flex items-center gap-3 font-bold text-(--sp-terra-ink) text-[0.9rem] tracking-[0.06em]"
					>
						<span
							aria-hidden="true"
							className="sp-core-pulse ms-1 inline-block size-2 rounded-full bg-(--sp-terra)"
						/>
						{t("begin.firstFree")}
					</p>
				</div>
				<ReservePanel />
			</div>
		</section>
	);
}
