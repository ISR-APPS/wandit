// The request side of the contact section: the visitor picks a subject, and the action opens an email to the firm.
// ContactSection renders it. It posts no data: the pick lives in state and becomes the subject line of a `mailto:` link.
// With no script the first subject is the pick, and the link still works.
import { type ReactNode, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TOPIC_IDS, type TopicId } from "../lib/content";
import { BUTTON_PRIMARY, LABEL, MICRO, SOFT } from "../lib/type-styles";
import { EmailText } from "./email-text";

/** The subject chips, a ledger of the email that the action opens, and one email action. The telephone is in the ledger. */
export function MeetingBrief() {
	const { t } = useT();
	const [topic, setTopic] = useState<TopicId>("sale");
	const subject = `${t("contact.draftSubjectPrefix")}${t(`contact.topics.${topic}`)}`;
	const draftRows: { term: string; value: ReactNode }[] = [
		{ term: t("contact.draftToLabel"), value: <EmailText /> },
		{ term: t("contact.draftSubjectLabel"), value: subject },
	];
	return (
		<div>
			<p className={cn(SOFT, "max-w-[62ch] text-[0.96875rem]")}>
				{t("contact.briefIntro")}
			</p>
			<fieldset className="mt-7">
				<legend className={cn(MICRO, SOFT, "mb-3")}>
					{t("contact.topicLabel")}
				</legend>
				<div className="flex flex-wrap gap-2">
					{TOPIC_IDS.map((topicId) => {
						const isPicked = topicId === topic;
						return (
							<button
								key={topicId}
								type="button"
								aria-pressed={isPicked}
								onClick={() => setTopic(topicId)}
								className={cn(
									"min-h-11 border px-3.5 font-semibold text-[0.8125rem] tracking-[0.02em] transition-colors duration-[180ms] ease-linear",
									isPicked
										? "border-primary bg-primary text-primary-foreground"
										: "border-foreground/25 text-foreground hover:border-foreground",
								)}
							>
								{t(`contact.topics.${topicId}`)}
							</button>
						);
					})}
				</div>
			</fieldset>
			<div className="mt-7 border border-primary bg-background px-[clamp(1.1rem,2.4vw,1.75rem)] pt-5 pb-2">
				<p className={cn(LABEL, "text-primary")}>{t("contact.draftTitle")}</p>
				<dl className="mt-4 border-foreground/18 border-t">
					{draftRows.map((row, index) => (
						<div
							key={row.term}
							className={cn(
								"grid grid-cols-[minmax(0,4.75rem)_minmax(0,1fr)] gap-4 py-3.5",
								index > 0 && "border-foreground/12 border-t",
							)}
						>
							<dt className={cn(MICRO, "pt-1 text-primary")}>{row.term}</dt>
							<dd className="break-words text-[0.96875rem]">{row.value}</dd>
						</div>
					))}
				</dl>
			</div>
			<div className="mt-7 grid min-[35rem]:flex">
				<a
					href={`mailto:${t("site.email")}?subject=${encodeURIComponent(subject)}`}
					className={BUTTON_PRIMARY}
				>
					{t("contact.writeAction")}
				</a>
			</div>
			<p className="mt-5 max-w-[44ch] text-[0.8125rem] text-foreground/60">
				{t("contact.privacyNote")}
			</p>
		</div>
	);
}
