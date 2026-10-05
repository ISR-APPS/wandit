/**
 * The questions section (id "faq") of the landing page. pages/landing-page.tsx
 * renders it, and the nav and other pages link to "/#faq". The questions come
 * from landing.faq.items. One answer is open at a time, the first by default.
 */

import { cn } from "@wandit/ui/lib/utils";
import { PlusIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";

import { useDictionary } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";

/** Accordion of the frequent questions. Opening one question closes the other. */
export function Faq() {
	const faq = useDictionary().landing.faq;
	const [openIndex, setOpenIndex] = useState<number | null>(0);
	const baseId = useId();
	const titleId = `${baseId}-title`;

	return (
		// The nav link moves the focus here, so the next Tab enters the questions.
		// The section is not a control, so it shows no focus ring.
		<section
			id="faq"
			tabIndex={-1}
			aria-labelledby={titleId}
			className="py-24 outline-none md:py-36"
		>
			<div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
				<h2
					id={titleId}
					className={cn(
						SECTION_TITLE_CLASS,
						"lg:sticky lg:top-28 lg:self-start",
					)}
				>
					{faq.title}
				</h2>

				<ul className="border-night/10 border-t">
					{faq.items.map((item, index) => {
						const isOpen = index === openIndex;
						const buttonId = `${baseId}-q${index}`;
						const panelId = `${baseId}-a${index}`;
						return (
							<li key={item.q} className="relative border-night/10 border-b">
								{/* The white sheet glides to the open question and hides its hairlines. */}
								{isOpen ? (
									<motion.div
										layoutId={`${baseId}-sheet`}
										aria-hidden
										transition={{
											type: "spring",
											bounce: 0.15,
											duration: 0.55,
										}}
										// Motion corrects a radius set in style while the sheet scales.
										style={{ borderRadius: 28 }}
										className="absolute -inset-x-3 -inset-y-px bg-white shadow-[0_1px_0_rgb(11_16_51/0.06),0_24px_48px_-28px_rgb(11_16_51/0.35)] md:-inset-x-6"
									/>
								) : null}
								<h3 className="relative">
									<button
										type="button"
										id={buttonId}
										aria-expanded={isOpen}
										aria-controls={panelId}
										onClick={() => setOpenIndex(isOpen ? null : index)}
										className="group flex w-full items-center justify-between gap-6 rounded-2xl py-6 text-start outline-offset-4 focus-visible:outline-2 focus-visible:outline-ember md:py-8"
									>
										<span
											className={cn(
												"font-semibold text-[clamp(1.25rem,2vw,1.75rem)] leading-[1.2] tracking-[-0.025em] transition-colors duration-300 rtl:leading-[1.5] rtl:tracking-normal",
												isOpen
													? "text-night"
													: "text-night/75 group-hover:text-night",
											)}
										>
											{item.q}
										</span>
										{/* The plus turns 45 degrees into a cross when the answer opens. */}
										<span
											aria-hidden
											className={cn(
												"grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-300",
												isOpen
													? "bg-spark text-night shadow-[0_3px_0_var(--color-spark-deep)]"
													: "text-night ring-1 ring-night/15 group-hover:ring-night/35",
											)}
										>
											<PlusIcon
												strokeWidth={2.25}
												className={cn(
													"size-5 transition-transform duration-300 ease-out",
													isOpen && "rotate-45",
												)}
											/>
										</span>
									</button>
								</h3>
								<AnimatePresence initial={false}>
									{isOpen ? (
										<motion.div
											key="answer"
											id={panelId}
											role="region"
											aria-labelledby={buttonId}
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
											className="relative overflow-hidden"
										>
											<p className="max-w-2xl pe-14 pb-8 text-base text-night/70 leading-relaxed md:pb-10 md:text-lg">
												{item.a}
											</p>
										</motion.div>
									) : null}
								</AnimatePresence>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
