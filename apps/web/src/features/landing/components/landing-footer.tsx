import { Logo } from "@/components/logo";

import { FOOTER } from "../lib/constants";
import { scrollToId } from "../lib/scroll";

export function LandingFooter() {
	return (
		<footer className="border-border border-t px-4 py-12 md:py-16">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-10 md:flex-row md:justify-between">
					<div className="max-w-xs">
						<Logo size="md" />
						<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
							{FOOTER.tagline}
						</p>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:gap-16">
						{FOOTER.columns.map((column) => (
							<div key={column.title}>
								<h4 className="font-medium font-sans text-foreground text-sm">
									{column.title}
								</h4>
								<ul className="mt-3 flex flex-col gap-2">
									{column.links.map((link) => (
										<li key={link.label}>
											<a
												href={link.id ? `#${link.id}` : "#"}
												onClick={(e) => {
													if (link.id) {
														e.preventDefault();
														scrollToId(link.id);
													}
												}}
												className="rounded-sm text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-border border-t pt-6 font-mono text-muted-foreground text-xs">
					<span>{FOOTER.copyright}</span>
					<span>{FOOTER.madeIn}</span>
				</div>
			</div>
		</footer>
	);
}
