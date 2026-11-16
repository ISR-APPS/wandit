// The consultation request as an open folder: pick the matter and say if the other party has counsel,
// then write to the office with a prepared email, or call. ContactSection renders it.
// It posts no data: the choices only fill the subject and the body of a mailto link.
// STARTER.md says where a real form with a table goes.
import { useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MATTERS, OPPONENT_ANSWERS } from "../lib/content";
import { BUTTON_TEXT, LABEL } from "../lib/type-styles";
import { ChoiceGroup } from "./choice-group";
import { ClauseHead } from "./clause-head";
import { DossierTab } from "./dossier-tab";

/** The folder of the request. The two choices change the summary line and the prepared email at once. */
export function RequestFolder() {
	const { t } = useT();
	const [matter, setMatter] = useState<TranslationKey>("contact.matterUnsure");
	const [opponent, setOpponent] =
		useState<TranslationKey>("contact.opponentNo");
	const subject = t("contact.mailSubject").replace("{matter}", t(matter));
	const body = [
		`${t("contact.summaryMatter")} ${t(matter)}`,
		`${t("contact.summaryOpponent")} ${t(opponent)}`,
		"",
		t("contact.mailIntro"),
	].join("\n");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	return (
		<div data-reveal>
			<DossierTab
				size="section"
				className="relative z-10 [--tab-fill:var(--vt-raised)]"
			>
				{t("contact.folderTab")}
			</DossierTab>
			<div className="vt-stock bg-(--vt-raised) p-[clamp(1.4rem,3vw,2.4rem)]">
				<div className="grid gap-8">
					<ChoiceGroup
						legend="contact.matterLabel"
						name="matter"
						options={MATTERS}
						value={matter}
						onChange={setMatter}
					/>
					<ChoiceGroup
						legend="contact.opponentLabel"
						name="opponent"
						options={OPPONENT_ANSWERS}
						value={opponent}
						onChange={setOpponent}
					/>
				</div>
				<p
					aria-live="polite"
					className="vt-line mt-8 border-t pt-4 font-display text-[1.05rem] leading-snug"
				>
					<span
						className={cn(
							LABEL,
							"mb-2 block text-(--vt-brass) text-[10.5px] sm:me-3 sm:mb-0 sm:inline",
						)}
					>
						{t("contact.summaryLabel")}
					</span>
					{/* On a phone each answer takes its own line, so the separator dot never ends a line. */}
					<span className="block sm:inline">
						<span className="text-(--vt-ink-50)">
							{t("contact.summaryMatter")}
						</span>{" "}
						{t(matter)}
					</span>
					<span
						aria-hidden="true"
						className="hidden text-(--vt-ink-50) sm:inline"
					>
						{" · "}
					</span>{" "}
					<span className="block sm:inline">
						<span className="text-(--vt-ink-50)">
							{t("contact.summaryOpponent")}
						</span>{" "}
						{t(opponent)}
					</span>
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<a
						href={mailHref}
						className={cn("vt-btn grow sm:grow-0", BUTTON_TEXT)}
					>
						{t("contact.send")}
					</a>
					<a
						href={t("site.phoneHref")}
						className={cn("vt-btn vt-btn-ghost grow sm:grow-0", BUTTON_TEXT)}
					>
						{t("contact.call")}
					</a>
				</div>
				<div className="vt-faint mt-8 border-t pt-5">
					<ClauseHead article={6} size="small">
						{t("contact.disclaimerTitle")}
					</ClauseHead>
					<p className="mt-2 max-w-[60ch] text-(--vt-ink-50) text-[0.82rem] leading-relaxed">
						{t("contact.disclaimer")} {t("contact.callback")}
					</p>
				</div>
			</div>
		</div>
	);
}
