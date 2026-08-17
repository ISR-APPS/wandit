import { Link } from "@tanstack/react-router";

import { formatDate, interpolate, useDictionary, useI18n } from "@/lib/i18n";

import { LEGAL_LAST_UPDATED_ISO } from "../lib/constants";
import { LegalText } from "./legal-text";

/**
 * Shape shared by legal.privacy and legal.terms. Declared here rather than
 * indexed off Dictionary so that one component can take either document.
 */
export type LegalDocumentContent = {
	readonly title: string;
	readonly intro: readonly string[];
	readonly sections: readonly {
		readonly id: string;
		readonly title: string;
		readonly paragraphs: readonly string[];
		readonly bullets: readonly string[];
		readonly after: readonly string[];
	}[];
};

const anchorLinkClass =
	"rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function LegalDocument({
	content,
	otherHref,
	otherLabel,
}: {
	content: LegalDocumentContent;
	otherHref: "/privacy" | "/terms";
	otherLabel: string;
}) {
	const common = useDictionary().legal.common;
	const { locale } = useI18n();
	// The ISO date parses as UTC midnight, so a reader west of Greenwich would
	// otherwise read the day before — and both documents say this date names the
	// version in force, which must be the same date for everybody.
	const lastUpdated = formatDate(LEGAL_LAST_UPDATED_ISO, locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});

	return (
		<article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
			<header>
				<h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
					{content.title}
				</h1>
				<p className="mt-3 font-mono text-muted-foreground text-xs">
					{interpolate(common.lastUpdated, { date: lastUpdated })}
				</p>
				<div className="mt-6 flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed">
					{content.intro.map((paragraph) => (
						<p key={paragraph}>
							<LegalText value={paragraph} />
						</p>
					))}
				</div>
			</header>

			<nav
				aria-label={common.contents}
				className="mt-10 rounded-xl border border-border bg-muted/30 p-5"
			>
				<h2 className="font-medium font-sans text-foreground text-sm">
					{common.contents}
				</h2>
				<ol className="mt-3 grid gap-1.5 text-muted-foreground text-sm sm:grid-cols-2">
					{content.sections.map((section) => (
						<li key={section.id}>
							<a href={`#${section.id}`} className={anchorLinkClass}>
								{section.title}
							</a>
						</li>
					))}
				</ol>
			</nav>

			<div className="mt-12 flex flex-col gap-10">
				{content.sections.map((section) => (
					// scroll-mt clears the fixed nav so the heading is not hidden when
					// a contents link jumps to it.
					<section
						key={section.id}
						id={section.id}
						className="scroll-mt-24 text-muted-foreground text-sm leading-relaxed"
					>
						<h2 className="font-sans font-semibold text-foreground text-lg tracking-tight">
							{section.title}
						</h2>
						{section.paragraphs.map((paragraph) => (
							<p key={paragraph} className="mt-3">
								<LegalText value={paragraph} />
							</p>
						))}
						{section.bullets.length > 0 ? (
							<ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
								{section.bullets.map((bullet) => (
									<li key={bullet}>
										<LegalText value={bullet} />
									</li>
								))}
							</ul>
						) : null}
						{section.after.map((paragraph) => (
							<p key={paragraph} className="mt-3">
								<LegalText value={paragraph} />
							</p>
						))}
					</section>
				))}
			</div>

			<footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-border border-t pt-6 text-muted-foreground text-sm">
				<p>
					<LegalText value={common.contactCta} />
				</p>
				<div className="flex flex-wrap items-center gap-4">
					<Link to={otherHref} className={anchorLinkClass}>
						{otherLabel}
					</Link>
					<Link to="/" className={anchorLinkClass}>
						{common.backHome}
					</Link>
				</div>
			</footer>
		</article>
	);
}
