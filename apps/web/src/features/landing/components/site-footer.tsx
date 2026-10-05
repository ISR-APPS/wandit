/**
 * The footer of the landing page. pages/landing-page.tsx renders it.
 * It holds the link columns, the legal links, the abuse contact, and the
 * legal entity line, then a giant "wandit" wordmark that fills the width.
 */

import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import { Spark } from "@/components/logo";
import {
	ABUSE_CONTACT_EMAIL,
	LEGAL_COMPANY_REGISTERED_NAME,
} from "@/features/legal";
import { useDictionary, useTranslation } from "@/lib/i18n";

import { FOOTER_COLUMNS } from "../lib/constants";
import { useSectionNav } from "../lib/use-section-nav";

// The 44 px minimum height is the touch target floor of the landing spec.
const linkClass =
	"inline-flex min-h-11 items-center rounded-md outline-offset-2 transition-colors hover:text-night focus-visible:outline-2 focus-visible:outline-ember";

/** Landing footer with the legal lines that platform reviews look for. */
export function SiteFooter() {
	const footer = useDictionary().landing.footer;
	const { t } = useTranslation();
	const navigateToSection = useSectionNav();

	return (
		<footer className="overflow-hidden pt-24 md:pt-32">
			{/* The padding is on this wrapper, not on the footer. Thus the content
			    aligns with the other sections on wide screens. */}
			<div className="mx-auto max-w-7xl px-4 md:px-8">
				<div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
					<div>
						<div className="flex items-center gap-2.5">
							<span
								aria-hidden
								className="grid size-10 place-items-center rounded-xl bg-night"
							>
								<Spark className="size-5 text-spark" />
							</span>
							<span
								lang="en"
								className="font-extrabold font-grotesk text-[1.75rem] leading-none tracking-[-0.045em]"
							>
								wandit
							</span>
						</div>
						<p className="mt-6 max-w-md text-balance font-semibold text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.03em] rtl:leading-[1.4] rtl:tracking-normal">
							{footer.tagline}
						</p>
					</div>

					<div className="grid grid-cols-2 gap-10 sm:gap-20">
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.id}>
								<h2 className="font-semibold text-night text-sm">
									{footer.columnTitles[column.id]}
								</h2>
								<ul className="mt-1 flex flex-col text-base text-night/65">
									{column.links.map((link) => (
										<li key={link.key}>
											{link.key === "pricing" ? (
												<Link to="/pricing" className={linkClass}>
													{footer.linkLabels[link.key]}
												</Link>
											) : (
												<a
													href={link.scrollId ? `#${link.scrollId}` : "#"}
													onClick={(event) => {
														if (link.scrollId) {
															event.preventDefault();
															navigateToSection(link.scrollId);
														}
													}}
													className={linkClass}
												>
													{footer.linkLabels[link.key]}
												</a>
											)}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				{/* Google app verification checks that the home page links to the
				    privacy policy and the terms. Abuse desks and the Public Suffix
				    List look for a visible abuse contact. Both stay in this bar. */}
				<div className="mt-20 flex flex-col gap-3 border-night/10 border-t pt-5 text-night/65 text-sm md:mt-28 lg:flex-row lg:items-center lg:justify-between">
					<span>{footer.copyright}</span>
					<div className="flex flex-wrap items-center gap-x-6">
						<Link to="/privacy" className={linkClass}>
							{footer.linkLabels.privacy}
						</Link>
						<Link to="/terms" className={linkClass}>
							{footer.linkLabels.terms}
						</Link>
						<span>
							{footer.reportAbuse}{" "}
							<a href={`mailto:${ABUSE_CONTACT_EMAIL}`} className={linkClass}>
								{ABUSE_CONTACT_EMAIL}
							</a>
						</span>
					</div>
					<span>{footer.madeIn}</span>
				</div>
				{/* Business verification looks for the registered legal entity on the
				    site itself, spelled as the licence does. */}
				<p className="mt-3 text-night/65 text-sm">
					{t("landing.footer.legalEntity", {
						company: LEGAL_COMPANY_REGISTERED_NAME,
					})}
				</p>
			</div>

			{/* The brand name stays Latin and left to right in every locale: index.css
			    gives lang="en" the Latin face. The spark takes the place of the dot on
			    the i. The color is opaque, so the overlaps of the tight letters do not
			    show darker. */}
			<div
				aria-hidden
				lang="en"
				dir="ltr"
				className="mt-16 -mb-[0.04em] flex select-none justify-center font-extrabold font-grotesk text-[33vw] text-[color-mix(in_oklab,var(--color-night)_8%,var(--color-paper))] leading-[0.8] tracking-[-0.05em] md:mt-20"
			>
				wand
				<span className="relative">
					ı
					<motion.span
						initial={{ scale: 0, rotate: -90 }}
						whileInView={{ scale: 1, rotate: 0 }}
						viewport={{ once: true, amount: 1 }}
						transition={{ type: "spring", bounce: 0.45, duration: 0.9 }}
						className="absolute start-1/2 top-[-0.06em] -ms-[0.08em] block size-[0.22em] text-spark"
					>
						<Spark className="size-full" />
					</motion.span>
				</span>
				t
			</div>
		</footer>
	);
}
