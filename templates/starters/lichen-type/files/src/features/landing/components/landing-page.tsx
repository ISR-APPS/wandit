/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */
import { useState } from "react";
import "../landing.css";

const fonts = {
	Grotesk: "var(--font-sans)",
	Serif: "var(--font-display)",
	Mono: "ui-monospace, monospace",
};
const SAMPLE_TEXT = "Letters grow wild.";

/** The specimen uses local React state so visitors can change the type face and text at once. */
export function LandingPage() {
	const [specimen, setSpecimen] = useState(SAMPLE_TEXT);
	const [font, setFont] = useState<keyof typeof fonts>("Serif");

	return (
		<div className="lichen">
			<header>
				<a href="#top">lichen.type</a>
				<nav aria-label="Foundry">
					<a href="#tester">Type tester</a>
					<a href="#licensing">Licensing</a>
				</nav>
			</header>
			<main id="top">
				<section id="tester" className="lichen-main">
					<div className="lichen-controls">
						<h1>Type in the wild.</h1>
						<fieldset aria-label="Select a type face">
							<button
								type="button"
								aria-pressed={font === "Grotesk"}
								onClick={() => setFont("Grotesk")}
							>
								Grotesk
							</button>
							<button
								type="button"
								aria-pressed={font === "Serif"}
								onClick={() => setFont("Serif")}
							>
								Serif
							</button>
							<button
								type="button"
								aria-pressed={font === "Mono"}
								onClick={() => setFont("Mono")}
							>
								Mono
							</button>
						</fieldset>
					</div>
					<p className="lichen-test" style={{ fontFamily: fonts[font] }}>
						{specimen || SAMPLE_TEXT}
					</p>
					<div className="lichen-field">
						<label htmlFor="lichen-specimen">Your sample text</label>
						<input
							id="lichen-specimen"
							value={specimen}
							onChange={(event) => setSpecimen(event.currentTarget.value)}
							maxLength={80}
						/>
					</div>
				</section>
				<section className="lichen-family" aria-label="Type families">
					<article>
						<p>Aa</p>
						<h2>Grotesk</h2>
						<p>Open forms for labels and long lines.</p>
					</article>
					<article>
						<p>Aa</p>
						<h2>Serif</h2>
						<p>Soft curves and sharp details for headlines.</p>
					</article>
					<article>
						<p>Aa</p>
						<h2>Mono</h2>
						<p>Fixed-width forms for tables and annotations.</p>
					</article>
				</section>
				<section id="licensing" className="lichen-license">
					<h2>Use the right license.</h2>
					<p>
						Tell us where the type will appear, how many people need access, and
						how you plan to distribute it.
					</p>
					<a href="mailto:type@example.com?subject=Type%20license">
						Ask about a license ↗
					</a>
				</section>
			</main>
		</div>
	);
}
