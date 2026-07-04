import { useDictionary } from "@wandit/internationalization/react";

import { Logo } from "@/components/logo";

import { FOOTER_COLUMNS } from "../lib/constants";
import { scrollToId } from "../lib/scroll";

export function LandingFooter() {
	const footer = useDictionary().landing.footer;

	return (
		<footer className="border-border border-t px-4 py-12 md:py-16">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-10 md:flex-row md:justify-between">
					<div className="max-w-xs">
						<Logo size="md" />
						<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
							{footer.tagline}
						</p>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:gap-16">
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.id}>
								<h4 className="font-medium font-sans text-foreground text-sm">
									{footer.columnTitles[column.id]}
								</h4>
								<ul className="mt-3 flex flex-col gap-2">
									{column.links.map((link) => (
										<li key={link.key}>
											<a
												href={link.scrollId ? `#${link.scrollId}` : "#"}
												onClick={(e) => {
													if (link.scrollId) {
														e.preventDefault();
														scrollToId(link.scrollId);
													}
												}}
												className="rounded-sm text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
											>
												{footer.linkLabels[link.key]}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-border border-t pt-6 font-mono text-muted-foreground text-xs">
					<span>{footer.copyright}</span>
					<span>{footer.madeIn}</span>
				</div>
			</div>
		</footer>
	);
}
