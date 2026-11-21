// This page presents the trust's coastal restoration work.
// The home route renders it. It reads the site copy from the app dictionary.

import { ArrowDownIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";

/** Guides visitors from the underwater habitat to shore monitoring and volunteer contact. */
export function LandingPage() {
	const { t } = useT();
	const programs = [
		{ title: t("landing.mapTitle"), detail: t("landing.mapBody") },
		{ title: t("landing.restoreTitle"), detail: t("landing.restoreBody") },
		{ title: t("landing.shareTitle"), detail: t("landing.shareBody") },
	];

	return (
		<div className="min-h-svh">
			<header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-12">
				<a className="font-bold font-display text-lg sm:text-2xl" href="#top">
					{t("common.appName")}
				</a>
				<nav
					className="flex flex-wrap gap-x-6 gap-y-2 font-semibold text-sm"
					aria-label="Trust"
				>
					<a className="hover:underline" href="#work">
						{t("landing.work")}
					</a>
					<a className="hover:underline" href="#field-notes">
						{t("landing.notes")}
					</a>
					<a className="hover:underline" href="#volunteer">
						{t("landing.volunteer")}
					</a>
				</nav>
			</header>
			<main id="top">
				<figure className="relative isolate flex min-h-[min(50rem,88svh)] items-end">
					<img
						src="/images/studio.webp"
						width={1440}
						height={960}
						alt={t("landing.heroAlt")}
						className="absolute inset-0 -z-20 size-full object-cover"
					/>
					<div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/45 to-background/65" />
					<figcaption className="mx-auto flex w-full max-w-[90rem] flex-wrap items-end justify-between gap-8 px-5 pt-36 pb-12 sm:px-12 sm:pb-16">
						<div>
							<p className="mb-5 font-bold text-sm">{t("landing.place")}</p>
							<h1 className="max-w-[12ch] text-[clamp(3.1rem,8vw,8.6rem)] leading-[0.92] tracking-[-0.065em]">
								{t("landing.heroTitle")}
							</h1>
						</div>
						<a
							className="inline-flex items-center gap-3 border-foreground border-b pb-2 font-bold text-sm"
							href="#work"
						>
							{t("landing.explore")}
							<ArrowDownIcon aria-hidden="true" />
						</a>
					</figcaption>
				</figure>
				<section
					id="work"
					className="mx-auto grid max-w-[90rem] gap-10 px-5 py-16 sm:px-12 sm:py-24 lg:grid-cols-[0.85fr_1fr] lg:gap-20"
				>
					<div>
						<h2 className="max-w-[15ch] text-4xl leading-tight sm:text-6xl">
							{t("landing.workTitle")}
						</h2>
						<p className="mt-5 max-w-md leading-relaxed">
							{t("landing.heroSubtitle")}
						</p>
					</div>
					<dl className="grid divide-y divide-foreground/30 border-foreground/30 border-y">
						{programs.map((program) => (
							<div
								className="grid gap-2 py-5 sm:grid-cols-[1fr_1.7fr] sm:gap-4"
								key={program.title}
							>
								<dt className="font-display text-primary text-xl">
									{program.title}
								</dt>
								<dd className="text-sm leading-relaxed">{program.detail}</dd>
							</div>
						))}
					</dl>
				</section>
				<section
					id="field-notes"
					className="border-foreground/20 border-y bg-card py-14 sm:py-20"
				>
					<div className="mx-auto max-w-3xl px-5">
						<p className="mb-4 font-semibold text-primary">
							{t("landing.notesLabel")}
						</p>
						<h2 className="text-4xl leading-tight sm:text-5xl">
							{t("landing.notesTitle")}
						</h2>
						<p className="my-5 max-w-prose leading-relaxed">
							{t("landing.notesBody")}
						</p>
						<details className="border-foreground/30 border-t py-4">
							<summary className="cursor-pointer font-semibold">
								{t("landing.checklist")}
							</summary>
							<p className="mt-3">{t("landing.checklistBody")}</p>
						</details>
					</div>
				</section>
			</main>
			<footer
				id="volunteer"
				className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-6 px-5 py-12 sm:px-12"
			>
				<h2 className="text-3xl">{t("landing.footer")}</h2>
				<a
					className="inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground"
					href="mailto:field@eelgrass.example"
				>
					{t("landing.email")}
				</a>
			</footer>
		</div>
	);
}
