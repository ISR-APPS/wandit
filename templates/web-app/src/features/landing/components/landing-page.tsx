// Public landing page. The "/" route renders it, and the build prerenders it.
// The generated app replaces this hero and these features with its own content.
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleCheckBigIcon } from "lucide-react";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

export function LandingPage() {
	const { t } = useT();
	const features = [
		{ title: t("landing.feature1Title"), body: t("landing.feature1Body") },
		{ title: t("landing.feature2Title"), body: t("landing.feature2Body") },
		{ title: t("landing.feature3Title"), body: t("landing.feature3Body") },
	];

	return (
		<div className="min-h-svh bg-background">
			<header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
				<span className="font-display font-semibold text-lg">
					{t("common.appName")}
				</span>
				<nav className="flex items-center gap-3">
					<a
						href="#features"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						{t("nav.features")}
					</a>
					<LocaleSwitcher />
					<Button asChild variant="outline" size="sm">
						<Link to="/login">{t("nav.signIn")}</Link>
					</Button>
				</nav>
			</header>

			<main className="mx-auto max-w-5xl px-6">
				<section className="grid gap-6 py-20 text-center">
					<h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
						{t("landing.heroTitle")}
					</h1>
					<p className="mx-auto max-w-xl text-lg text-muted-foreground">
						{t("landing.heroSubtitle")}
					</p>
					<div className="flex justify-center">
						<Button asChild size="lg">
							<Link to="/login">
								{t("landing.heroCta")}
								<ArrowRightIcon className="rtl:rotate-180" />
							</Link>
						</Button>
					</div>
				</section>

				<section id="features" className="grid gap-6 py-12">
					<h2 className="text-center font-bold text-2xl">
						{t("landing.featuresTitle")}
					</h2>
					<div className="grid gap-4 sm:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="rounded-xl border bg-card p-6 text-start"
							>
								<CircleCheckBigIcon className="mb-3 size-5 text-primary" />
								<h3 className="font-semibold">{feature.title}</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									{feature.body}
								</p>
							</div>
						))}
					</div>
				</section>
			</main>
		</div>
	);
}
