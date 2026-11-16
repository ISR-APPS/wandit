// The product section: a pill-tab switcher that tells the three verbs of Fawtara, one scene at a time.
// LandingPage renders it. Three radio inputs hold the selected verb, so the tabs work with no script.
// landing.css slides the track to the checked verb and hides the two other panels.
import { useT } from "~/shared/i18n";
import { BLOCK_TITLE, SECTION_SPACE, WRAP } from "../lib/class-names";
import { ArrowLink } from "./arrow-link";
import { CheckList } from "./check-list";
import { SectionHead } from "./section-head";
import { SpotIllustration } from "./spot-illustration";

// One verb: its tab, its drawing, its three claims, and the link that leads to the next section.
// `id` is the value of the radio input. landing.css selects on the same three values.
const VERBS = [
	{
		id: "invoice",
		scene: "invoice",
		tabKey: "product.invoiceTab",
		titleKey: "product.invoiceTitle",
		pointKeys: [
			"product.invoicePoint1",
			"product.invoicePoint2",
			"product.invoicePoint3",
		],
		linkKey: "product.invoiceLink",
		linkHref: "#path",
		captionKey: "product.invoiceCaption",
		spotLabelKey: "product.invoiceSpotLabel",
	},
	{
		id: "collect",
		scene: "payment",
		tabKey: "product.collectTab",
		titleKey: "product.collectTitle",
		pointKeys: [
			"product.collectPoint1",
			"product.collectPoint2",
			"product.collectPoint3",
		],
		linkKey: "product.collectLink",
		linkHref: "#pricing",
		captionKey: "product.collectCaption",
		spotLabelKey: "product.collectSpotLabel",
	},
	{
		id: "declare",
		scene: "ledger",
		tabKey: "product.declareTab",
		titleKey: "product.declareTitle",
		pointKeys: [
			"product.declarePoint1",
			"product.declarePoint2",
			"product.declarePoint3",
		],
		linkKey: "product.declareLink",
		linkHref: "#contact",
		captionKey: "product.declareCaption",
		spotLabelKey: "product.declareSpotLabel",
	},
] as const;

/** The first verb is checked in the HTML, so the section is complete before the script loads. */
export function ProductSection() {
	const { t } = useT();
	return (
		<section
			id="product"
			aria-label={t("product.label")}
			className={SECTION_SPACE}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("product.label")}
					title={t("product.title")}
					lead={t("product.lead")}
				/>
				<div data-reveal className="fw-switch mt-10">
					<div
						role="radiogroup"
						aria-label={t("product.tabsLabel")}
						className="inline-flex gap-1.5 rounded-full bg-accent p-1.5"
					>
						{VERBS.map((verb, index) => (
							<label
								key={verb.id}
								className="fw-tab relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-5 font-bold font-display text-[0.92rem] text-muted-foreground tracking-normal sm:px-6"
							>
								<input
									type="radio"
									name="fawtara-verb"
									value={verb.id}
									defaultChecked={index === 0}
									className="sr-only"
								/>
								{t(verb.tabKey)}
							</label>
						))}
					</div>
					{/* The frame clips the two panels that wait beside the stage. */}
					<div className="mt-9 overflow-hidden">
						<div className="fw-track flex">
							{VERBS.map((verb) => (
								<div
									key={verb.id}
									data-verb={verb.id}
									className="fw-panel w-full shrink-0 px-1 pb-1"
								>
									<div className="grid items-center gap-[clamp(1.8rem,4vw,3.5rem)] md:grid-cols-[0.9fr_1.1fr]">
										<figure className="mx-auto w-full max-w-[400px]">
											<SpotIllustration
												scene={verb.scene}
												label={t(verb.spotLabelKey)}
												panelTone="sky"
											/>
											<figcaption className="mt-2.5 text-center text-[0.83rem] text-muted-foreground">
												{t(verb.captionKey)}
											</figcaption>
										</figure>
										<div>
											<h3 className={BLOCK_TITLE}>{t(verb.titleKey)}</h3>
											<CheckList
												items={verb.pointKeys.map((key) => t(key))}
												tone="muted"
												className="mt-5 mb-4 text-[1.0625rem] leading-[1.6]"
											/>
											<ArrowLink href={verb.linkHref}>
												{t(verb.linkKey)}
											</ArrowLink>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
