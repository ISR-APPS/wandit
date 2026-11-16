// Round 1, "The Code": the six house rules in a welded grid of hairlines.
// landing-page.tsx renders it. It reads CODE_ARTICLES of lib/content.ts.
import { useT } from "~/shared/i18n";
import { CODE_ARTICLES } from "../lib/content";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";

/** The grid shows 1px lines between the cells: the gap lets the container color through. */
export function CodeSection() {
	const { t } = useT();
	return (
		<section
			id="code"
			aria-labelledby="code-title"
			className="sp-gutter py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={1}
					layout="start"
					titleId="code-title"
					kickerStart={t("code.kickerStart")}
					kickerEnd={t("code.kickerEnd")}
					titleStart={t("code.titleStart")}
					titleAccent={t("code.titleAccent")}
					sub={t("code.sub")}
				/>
				<div className="sp-code-grid grid gap-px sm:grid-cols-2 lg:grid-cols-3">
					{CODE_ARTICLES.map((article, index) => (
						<Reveal
							key={article.numeral}
							as="article"
							delayMs={(index % 3) * 90}
							className="sp-code-item overflow-clip px-7 pt-7 pb-9 md:px-8 md:pt-8 md:pb-10"
						>
							<p
								aria-hidden="true"
								className="sp-code-num mb-4 w-fit font-display font-extrabold text-6xl leading-none tracking-[0.02em]"
							>
								{article.numeral}
							</p>
							<h3 className="font-display font-extrabold text-[1.75rem] uppercase leading-none tracking-[0.03em]">
								{t(article.title)}
							</h3>
							<p className="mt-3 text-[0.96rem] text-muted-foreground leading-relaxed">
								{t(article.body)}
							</p>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
