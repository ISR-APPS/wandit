import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@wandit/ui/components/accordion";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

export function Faq() {
	const { t } = useTranslation();
	const faq = useDictionary().landing.faq;

	return (
		<section id="faq" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-2xl">
				<SectionHeader
					kicker={t("landing.faq.kicker")}
					title={t("landing.faq.title")}
				/>
				<Reveal>
					<Accordion type="single" collapsible className="w-full">
						{faq.items.map((item) => (
							<AccordionItem key={item.q} value={item.q}>
								<AccordionTrigger className="py-5 text-base hover:no-underline">
									{item.q}
								</AccordionTrigger>
								<AccordionContent className="pb-5 text-muted-foreground leading-relaxed">
									{item.a}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</Reveal>
			</div>
		</section>
	);
}
