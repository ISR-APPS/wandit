// The footer: a band of film leader, the wordmark at display size, and the closing line of the roll.
// landing-page.tsx renders it. It reads the "footer" and "site" groups of messages.ts.
// It carries no credit line.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/styles";

/** The leader band is film base with holes on both edges: the roll ends here. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="bg-background">
			<div
				aria-hidden="true"
				className="yr-band-x relative h-[clamp(56px,6vw,72px)] border-foreground/15 border-t bg-canvas"
			/>
			<div
				className={`${WRAP} flex flex-wrap items-end justify-between gap-5 py-[clamp(2.4rem,5vh,3.6rem)]`}
			>
				<p className="font-display font-extrabold text-[clamp(2rem,6.2vw,5rem)] uppercase leading-[0.92] tracking-[-0.045em]">
					{t("site.brand")}
				</p>
				<p className="yr-mono text-[0.66rem] text-primary uppercase leading-[1.9] tracking-[0.1em] min-[601px]:text-end">
					{t("footer.closing")}
					<br />
					{t("footer.process")}
					<br />
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center text-foreground hover:text-primary focus-visible:text-primary"
					>
						<span dir="ltr" className="border-foreground/30 border-b">
							{t("site.phone")}
						</span>
					</a>
				</p>
			</div>
		</footer>
	);
}
