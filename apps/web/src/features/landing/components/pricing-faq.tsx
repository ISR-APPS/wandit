/**
 * The pricing questions of the /pricing page. components/pricing.tsx renders it.
 * It uses the Accordion of packages/ui, and the copy of landing.pricing.faq.<id>.
 * The refund answer links to /terms, so this page states no refund policy of its own.
 */
import { Link } from "@tanstack/react-router";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@wandit/ui/components/accordion";
import { cn } from "@wandit/ui/lib/utils";
import { useId } from "react";

import { useDictionary } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";

// The questions in display order. Each id keys landing.pricing.faq.<id>.{q,a}.
const PRICING_FAQ_IDS = [
	"bonusCustom",
	"expiry",
	"subscription",
	"teamWallet",
	"algeria",
	"refunds",
] as const;

/** One question open at a time, the first by default. A second click closes it. */
export function PricingFaq() {
	const faq = useDictionary().landing.pricing.faq;
	const titleId = useId();

	return (
		<section
			aria-labelledby={titleId}
			className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20"
		>
			<h2
				id={titleId}
				className={cn(SECTION_TITLE_CLASS, "lg:sticky lg:top-28 lg:self-start")}
			>
				{faq.title}
			</h2>

			<Accordion
				type="single"
				collapsible
				defaultValue={PRICING_FAQ_IDS[0]}
				className="border-night/10 border-t"
			>
				{PRICING_FAQ_IDS.map((id) => (
					<AccordionItem
						key={id}
						value={id}
						className="border-night/10 border-b last:border-b"
					>
						<AccordionTrigger className="items-center gap-6 rounded-2xl py-6 font-semibold text-[clamp(1.125rem,1.6vw,1.375rem)] text-night/80 leading-snug tracking-[-0.02em] outline-offset-4 hover:text-night hover:no-underline focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-solid focus-visible:ring-0 data-[state=open]:text-night md:py-7 rtl:leading-normal rtl:tracking-normal [&>svg]:size-5 [&>svg]:text-night/50">
							{faq[id].q}
						</AccordionTrigger>
						<AccordionContent className="max-w-2xl pe-10 pb-7 text-base text-night/70 leading-relaxed md:text-lg">
							{faq[id].a}
							{id === "refunds" ? (
								<>
									{" "}
									<Link
										to="/terms"
										className="font-semibold text-night underline decoration-night/25 underline-offset-4 hover:decoration-ember"
									>
										{faq.termsLink}
									</Link>
								</>
							) : null}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
}
