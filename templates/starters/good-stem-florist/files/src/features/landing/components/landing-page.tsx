// This page shows seasonal arrangements and explains repeat deliveries.
// The home route renders it. It reads the bouquet names from the app dictionary.

import { FlowerLotusIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";

/** Shows the bouquet size guide, subscription details, and vase care notes. */
export function LandingPage() {
	const { t } = useT();
	const bouquets = [
		{
			id: "posy",
			name: t("landing.posy"),
			fit: t("landing.posyFit"),
			detail: t("landing.posyBody"),
		},
		{
			id: "market",
			name: t("landing.market"),
			fit: t("landing.marketFit"),
			detail: t("landing.marketBody"),
		},
		{
			id: "statement",
			name: t("landing.statement"),
			fit: t("landing.statementFit"),
			detail: t("landing.statementBody"),
		},
	];

	return (
		<div>
			<header className="mx-auto grid max-w-[88rem] items-center gap-4 px-5 py-5 sm:px-10 lg:grid-cols-[1fr_auto_1fr]">
				<nav
					aria-label="Flower shop"
					className="row-start-2 flex items-center gap-5 font-semibold text-sm lg:row-start-1"
				>
					<a className="hover:underline" href="#bouquets">
						{t("landing.bouquets")}
					</a>
					<a className="hover:underline" href="#subscribe">
						{t("landing.subscriptions")}
					</a>
				</nav>
				<a
					className="row-start-1 inline-flex items-center gap-2 font-display font-semibold text-3xl"
					href="#top"
				>
					<FlowerLotusIcon aria-hidden="true" />
					{t("common.appName")}
				</a>
				<a
					className="row-start-1 justify-self-end rounded-full border border-primary px-4 py-2 font-semibold text-primary text-sm"
					href="#contact"
				>
					{t("landing.contact")}
				</a>
			</header>
			<main id="top">
				<section className="mx-auto grid max-w-[88rem] items-center gap-8 px-5 pt-6 pb-12 sm:px-10 sm:pt-10 md:grid-cols-[0.94fr_1fr] md:gap-12 lg:px-16 lg:pb-20">
					<div className="max-w-lg md:order-2">
						<h1 className="text-[clamp(3.2rem,6.6vw,8rem)] leading-[0.98] tracking-[-0.08em]">
							{t("landing.heroTitle")}
						</h1>
						<p className="mt-5 max-w-72 leading-relaxed">
							{t("landing.heroSubtitle")}
						</p>
						<a
							className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground"
							href="#bouquets"
						>
							{t("landing.choose")}
						</a>
					</div>
					<figure className="relative overflow-hidden rounded-t-[44%] rounded-b-lg">
						<img
							src="/images/studio.webp"
							width={1440}
							height={960}
							alt={t("landing.heroAlt")}
							className="aspect-[1.1] w-full object-cover sm:aspect-[1.08]"
						/>
					</figure>
				</section>
				<section
					id="bouquets"
					className="border-foreground/20 border-y bg-secondary px-5 py-12 text-secondary-foreground sm:px-10 sm:py-20"
				>
					<div className="mx-auto grid max-w-[72rem] gap-8 lg:grid-cols-[0.65fr_1fr]">
						<div>
							<h2 className="text-4xl leading-tight sm:text-6xl">
								{t("landing.size")}
							</h2>
							<p className="mt-4 max-w-xs">{t("landing.sizeBody")}</p>
						</div>
						<ul className="grid divide-y divide-foreground/25 border-foreground/25 border-y">
							{bouquets.map((bouquet) => (
								<li
									className="grid gap-2 py-4 sm:grid-cols-[1fr_1fr]"
									key={bouquet.id}
								>
									<div>
										<h3 className="font-semibold text-xl">{bouquet.name}</h3>
										<p className="mt-1 font-semibold text-primary text-sm">
											{bouquet.fit}
										</p>
									</div>
									<p className="text-sm leading-relaxed">{bouquet.detail}</p>
								</li>
							))}
						</ul>
					</div>
				</section>
				<section
					id="subscribe"
					className="mx-auto grid max-w-[72rem] gap-8 px-5 py-14 sm:px-10 sm:py-20 md:grid-cols-2"
				>
					<div>
						<h2 className="text-3xl sm:text-4xl">
							{t("landing.subscriptionTitle")}
						</h2>
						<p className="mt-4 max-w-sm leading-relaxed">
							{t("landing.subscriptionBody")}
						</p>
					</div>
					<details className="self-start border-foreground/25 border-y py-4">
						<summary className="cursor-pointer font-bold">
							{t("landing.care")}
						</summary>
						<p className="mt-3 max-w-lg leading-relaxed">
							{t("landing.careBody")}
						</p>
					</details>
				</section>
			</main>
			<footer
				id="contact"
				className="bg-primary px-5 py-8 text-primary-foreground sm:px-10"
			>
				<div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-5">
					<p className="font-display text-2xl">{t("common.appName")}</p>
					<a
						className="font-semibold underline underline-offset-4"
						href="mailto:flowers@goodstem.example"
					>
						{t("landing.email")}
					</a>
				</div>
			</footer>
		</div>
	);
}
