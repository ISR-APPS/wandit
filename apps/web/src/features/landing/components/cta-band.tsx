import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";

import { useAuthModal, useSession } from "@/features/auth";

import { CTA_BAND } from "../lib/constants";
import { Reveal } from "./reveal";

const BUTTON_CLASSES =
	"bg-[oklch(0.2_0.015_55)] text-[oklch(0.96_0.005_80)] hover:bg-[oklch(0.27_0.017_55)]";

export function CtaBand() {
	const { data: session } = useSession();
	const { open } = useAuthModal();

	return (
		<section className="px-4 py-16 md:py-24">
			<Reveal className="mx-auto max-w-6xl">
				<div className="relative overflow-hidden rounded-3xl bg-gradient-ember px-6 py-16 text-center md:py-24">
					<span aria-hidden className="absolute inset-0 bg-grain" />
					<div className="relative">
						<h2 className="font-bold font-display text-4xl text-[oklch(0.21_0.03_55)] tracking-[-0.03em] md:text-6xl">
							{CTA_BAND.title}
						</h2>
						<p className="mx-auto mt-4 max-w-md font-medium text-[oklch(0.28_0.03_55)]/90 md:text-lg">
							{CTA_BAND.sub}
						</p>
						{session ? (
							<Button asChild size="lg" className={`mt-8 ${BUTTON_CLASSES}`}>
								<Link to="/dashboard">{CTA_BAND.button}</Link>
							</Button>
						) : (
							<Button
								size="lg"
								className={`mt-8 ${BUTTON_CLASSES}`}
								onClick={() => open()}
							>
								{CTA_BAND.button}
							</Button>
						)}
					</div>
				</div>
			</Reveal>
		</section>
	);
}
