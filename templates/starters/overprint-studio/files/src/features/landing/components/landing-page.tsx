// This page introduces the print studio and explains how to prepare artwork.
// The home route renders it. It reads copy from the app dictionary.

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";

/** Shows the studio's inks, print guide, and email link on one public page. */
export function LandingPage() {
	const { t } = useT();
	const inks = [
		{
			name: t("landing.inkBlue"),
			code: "B–04",
			style: "bg-foreground text-background",
		},
		{
			name: t("landing.inkRed"),
			code: "R–02",
			style: "bg-primary text-primary-foreground",
		},
		{
			name: t("landing.inkGreen"),
			code: "G–07",
			style: "bg-chart-3 text-foreground",
		},
		{
			name: t("landing.inkGold"),
			code: "Y–03",
			style: "bg-chart-4 text-foreground",
		},
	];

	return (
		<div className="mx-auto max-w-[100rem] px-4 pb-4 sm:px-8 sm:pb-8">
			<header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-foreground border-b-2 py-4">
				<a
					className="font-black font-display text-2xl tracking-tight"
					href="#top"
				>
					{t("common.appName")}
				</a>
				<nav
					className="flex flex-wrap gap-x-5 gap-y-2 font-bold text-sm"
					aria-label="Studio"
				>
					<a className="hover:underline" href="#inks">
						{t("landing.inks")}
					</a>
					<a className="hover:underline" href="#print">
						{t("landing.print")}
					</a>
					<a className="hover:underline" href="#quote">
						{t("landing.quote")}
					</a>
				</nav>
			</header>
			<main id="top">
				<section className="grid border-foreground border-b-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
					<div className="flex flex-col justify-between gap-10 py-8 lg:py-12 lg:pr-10">
						<div className="flex justify-between gap-4 font-bold text-primary text-sm">
							<p>{t("landing.discipline")}</p>
							<p>{t("landing.service")}</p>
						</div>
						<h1 className="font-black text-[clamp(3.1rem,8vw,9rem)] uppercase leading-[0.86] tracking-[-0.08em]">
							{t("landing.heroTitle")}
							<br />
							{t("landing.heroLine")}
						</h1>
						<p className="max-w-xs text-base leading-relaxed">
							{t("landing.heroSubtitle")}
						</p>
					</div>
					<figure className="grid min-w-0 grid-rows-[1fr_auto] border-foreground border-t-2 lg:border-t-0 lg:border-l-2">
						<img
							src="/images/studio.webp"
							width={1440}
							height={960}
							alt={t("landing.heroAlt")}
							className="h-full min-h-0 w-full object-cover"
						/>
						<figcaption className="flex justify-between border-foreground border-t-2 p-3 font-mono text-xs">
							<span>{t("landing.caption")}</span>
							<span>{t("landing.sheet")}</span>
						</figcaption>
					</figure>
				</section>
				<section
					id="inks"
					className="grid scroll-m-4 gap-6 border-foreground border-b-2 py-9 md:grid-cols-[1fr_2fr] md:py-16"
				>
					<div>
						<h2 className="font-black text-4xl">{t("landing.inkTitle")}</h2>
						<p className="mt-3 max-w-xs">{t("landing.inkIntro")}</p>
					</div>
					<ul className="grid grid-cols-2 md:grid-cols-4">
						{inks.map((ink) => (
							<li key={ink.code} className={ink.style}>
								<div className="grid aspect-square content-between p-3 sm:p-4">
									<span className="font-bold">{ink.name}</span>
									<span className="font-mono text-xs">{ink.code}</span>
								</div>
							</li>
						))}
					</ul>
				</section>
				<section
					id="print"
					className="grid gap-6 border-foreground border-b-2 py-10 md:grid-cols-[1fr_2fr] md:py-16"
				>
					<h2 className="font-black text-4xl">{t("landing.prepare")}</h2>
					<div className="grid divide-y divide-foreground border-foreground border-y">
						<details className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.filesTitle")}
							</summary>
							<p className="mt-3 max-w-prose">{t("landing.filesBody")}</p>
						</details>
						<details className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.paperTitle")}
							</summary>
							<p className="mt-3 max-w-prose">{t("landing.paperBody")}</p>
						</details>
						<details className="py-4">
							<summary className="cursor-pointer font-bold">
								{t("landing.edgeTitle")}
							</summary>
							<p className="mt-3 max-w-prose">{t("landing.edgeBody")}</p>
						</details>
					</div>
				</section>
			</main>
			<footer
				id="quote"
				className="flex flex-wrap items-end justify-between gap-5 bg-foreground p-6 text-background sm:p-10"
			>
				<div>
					<h2 className="font-black text-3xl sm:text-5xl">
						{t("landing.next")}
					</h2>
					<p className="mt-3">{t("landing.quoteBody")}</p>
				</div>
				<a
					className="inline-flex items-center gap-2 border border-background px-4 py-3 font-bold hover:bg-background hover:text-foreground"
					href="mailto:studio@overprint.example"
				>
					{t("landing.email")}
					<ArrowUpRightIcon aria-hidden="true" />
				</a>
			</footer>
		</div>
	);
}
