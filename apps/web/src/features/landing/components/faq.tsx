import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@my-better-t-app/ui/components/accordion";

import { FAQ } from "../lib/constants";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

export function Faq() {
	return (
		<section id="faq" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-2xl">
				<SectionHeader kicker={FAQ.kicker} title={FAQ.title} />
				<Reveal>
					<Accordion type="single" collapsible className="w-full">
						{FAQ.items.map((item) => (
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
