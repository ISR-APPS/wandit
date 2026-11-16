// The questions section: what families ask on the phone, in two independent accordion columns.
// LandingPage renders it after the results. Each answer is a native <details>, so it opens with no script.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { BAND, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

// Two columns of three: money and daily life, then studies and visits. Only the first question of the first column starts open.
const COLUMNS: readonly {
	id: string;
	items: readonly { question: TranslationKey; answer: TranslationKey }[];
}[] = [
	{
		id: "fees-and-life",
		items: [
			{ question: "faq.q1", answer: "faq.a1" },
			{ question: "faq.q2", answer: "faq.a2" },
			{ question: "faq.q3", answer: "faq.a3" },
		],
	},
	{
		id: "studies-and-visits",
		items: [
			{ question: "faq.q4", answer: "faq.a4" },
			{ question: "faq.q5", answer: "faq.a5" },
			{ question: "faq.q6", answer: "faq.a6" },
		],
	},
];

/** Head row with the phone plate, then the two columns. One column under 900px. */
export function FaqSection() {
	const { t } = useT();
	return (
		<section id="questions" aria-labelledby="questions-title" className={BAND}>
			<div className={WRAP}>
				<SectionHead
					headingId="questions-title"
					eyebrow={t("faq.eyebrow")}
					title={t("faq.title")}
					aside={
						<p className="cn-r bg-(--cn-pale) px-5.5 py-5">
							<a
								href={t("site.phoneHref")}
								className="block font-bold font-display text-[1.35rem] tabular-nums leading-none tracking-[-0.03em] hover:text-(--cn-sky-deep)"
							>
								{t("site.phoneDisplay")}
							</a>
							<span className="mt-2 block text-(--cn-ink-2) text-[0.875rem] leading-[1.5]">
								{t("faq.deskBody")}
							</span>
						</p>
					}
				/>
				<div className="cn-faq grid items-start gap-x-[clamp(28px,4.5vw,72px)] min-[900px]:grid-cols-2">
					{COLUMNS.map((column, columnIndex) => (
						<div
							key={column.id}
							data-stagger=""
							className="border-border border-t max-[899px]:[&+div]:border-t-0"
						>
							{column.items.map((item, index) => (
								<details
									key={item.question}
									data-pop=""
									// Under 900px the columns stack, so a second open answer would sit in the middle of the list.
									open={columnIndex === 0 && index === 0}
									className="border-border border-b"
								>
									<summary className="flex min-h-11 cursor-pointer list-none items-start gap-4 py-5 font-display font-semibold text-[clamp(1rem,1.2vw,1.1rem)] tracking-[-0.014em]">
										<span className="flex-1">{t(item.question)}</span>
										<span
											aria-hidden="true"
											className="cn-faq-sign grid size-7.5 flex-none place-items-center rounded-full font-sans font-semibold text-[1.05rem] leading-none"
										>
											<span className="cn-faq-plus">+</span>
											<span className="cn-faq-minus">–</span>
										</span>
									</summary>
									<p className="max-w-[52ch] pe-11.5 pb-5.5 text-(--cn-ink-2) text-[0.9375rem] leading-[1.62]">
										{t(item.answer)}
									</p>
								</details>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
