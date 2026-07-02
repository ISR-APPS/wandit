// Mock pages: "Montre Héritage 1969" — three progressive iterations (v1 baseline,
// v2 + avis clients/FAQ, v3 showcase avec urgence et bundles) d'une page COD dark-luxe.

import type { MockPage } from "./shared";

const WATCH_SVG = `<svg viewBox="0 0 260 260" role="img" aria-label="Montre Héritage 1969" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="boitier" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#f0d69c"/>
			<stop offset="0.55" stop-color="#c8963f"/>
			<stop offset="1" stop-color="#8a6127"/>
		</linearGradient>
		<radialGradient id="cadran" cx="0.35" cy="0.28" r="0.95">
			<stop offset="0" stop-color="#2b251b"/>
			<stop offset="1" stop-color="#0f0d09"/>
		</radialGradient>
	</defs>
	<rect x="108" y="2" width="44" height="42" rx="10" fill="#1f1810"/>
	<rect x="108" y="216" width="44" height="42" rx="10" fill="#1f1810"/>
	<rect x="230" y="121" width="14" height="18" rx="4" fill="#c08c37"/>
	<circle cx="130" cy="130" r="104" fill="url(#boitier)"/>
	<circle cx="130" cy="130" r="93" fill="url(#cadran)" stroke="#7a5a24" stroke-width="2"/>
	<g stroke="#d4a24e" stroke-width="2" stroke-linecap="round">
		<line x1="130" y1="46" x2="130" y2="58"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(30 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(60 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(90 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(120 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(150 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(180 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(210 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(240 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(270 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(300 130 130)"/>
		<line x1="130" y1="46" x2="130" y2="58" transform="rotate(330 130 130)"/>
	</g>
	<text x="130" y="96" text-anchor="middle" font-family="Georgia, serif" font-size="12" letter-spacing="4" fill="#d4a24e">HÉRITAGE</text>
	<text x="130" y="180" text-anchor="middle" font-family="Georgia, serif" font-size="10" letter-spacing="3" fill="#8a7a54">1969</text>
	<rect x="176" y="121" width="24" height="18" rx="3" fill="#efe6d2"/>
	<text x="188" y="134" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#241b0d">19</text>
	<line x1="130" y1="130" x2="130" y2="82" stroke="#e8c37c" stroke-width="5" stroke-linecap="round" transform="rotate(305 130 130)"/>
	<line x1="130" y1="130" x2="130" y2="58" stroke="#e8c37c" stroke-width="3.5" stroke-linecap="round" transform="rotate(55 130 130)"/>
	<line x1="130" y1="142" x2="130" y2="66" stroke="#b0532f" stroke-width="1.5" stroke-linecap="round" transform="rotate(150 130 130)"/>
	<circle cx="130" cy="130" r="5" fill="#e8c37c"/>
</svg>`;

const FORM_FIELDS = `<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<div class="field">
					<label for="nom">Nom complet</label>
					<input id="nom" type="text" name="nom" placeholder="Votre nom et prénom" autocomplete="name" required>
				</div>
				<div class="field">
					<label for="telephone">Téléphone</label>
					<input id="telephone" type="tel" name="telephone" placeholder="05 XX XX XX XX" autocomplete="tel" required>
				</div>
				<div class="field">
					<label for="wilaya">Wilaya</label>
					<select id="wilaya" name="wilaya" required>
						<option value="" disabled selected>Choisissez votre wilaya</option>
						<option value="16">16 — Alger</option>
						<option value="31">31 — Oran</option>
						<option value="25">25 — Constantine</option>
						<option value="19">19 — Sétif</option>
						<option value="05">05 — Batna</option>
						<option value="09">09 — Blida</option>
						<option value="23">23 — Annaba</option>
						<option value="13">13 — Tlemcen</option>
						<option value="15">15 — Tizi Ouzou</option>
						<option value="06">06 — Béjaïa</option>
						<option value="07">07 — Biskra</option>
						<option value="17">17 — Djelfa</option>
						<option value="27">27 — Mostaganem</option>
						<option value="48">48 — Relizane</option>
						<option value="30">30 — Ouargla</option>
						<option value="10">10 — Bouira</option>
					</select>
				</div>
				<div class="field">
					<label for="commune">Commune</label>
					<input id="commune" type="text" name="commune" placeholder="Votre commune" required>
				</div>`;

const FORM_SCRIPT = `<script>
	(function () {
		var form = document.getElementById("commander");
		if (!form) return;
		form.addEventListener("submit", function (event) {
			event.preventDefault();
			var honeypot = form.querySelector('input[name="website"]');
			if (honeypot && honeypot.value) return;
			form.innerHTML = '<div class="form-success"><div class="form-success-icon">✅</div><h3>Commande reçue ✅</h3><p>Nous vous appellerons pour confirmer.</p></div>';
			form.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	})();
</script>`;

const BASE_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body {
		font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
		background: #0d0b08;
		color: #f2e9d6;
		line-height: 1.65;
		padding-bottom: 86px;
		-webkit-font-smoothing: antialiased;
	}
	h1, h2, h3, .price, .s-price, .brand { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
	.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
	.site { padding: 18px 0; border-bottom: 1px solid rgba(212, 162, 78, 0.18); }
	.brand { text-align: center; color: #d4a24e; font-size: 14px; letter-spacing: 0.3em; text-transform: uppercase; }
	.eyebrow { color: #d4a24e; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 14px; }
	.hero { padding: 56px 0 44px; text-align: center; }
	.hero h1 { font-size: clamp(32px, 7vw, 54px); line-height: 1.12; color: #f7f0e0; margin-bottom: 18px; }
	.lead { color: #b6a98d; font-size: 16.5px; max-width: 560px; margin: 0 auto 28px; }
	.watch-visual { width: min(250px, 62vw); margin: 0 auto 30px; filter: drop-shadow(0 26px 46px rgba(0, 0, 0, 0.55)); }
	.watch-visual svg { display: block; width: 100%; height: auto; }
	.price-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; flex-wrap: wrap; }
	.price { font-size: 36px; color: #e8c37c; }
	.compare { color: #7c7057; text-decoration: line-through; font-size: 17px; }
	.chip { display: inline-block; margin-top: 10px; background: rgba(212, 162, 78, 0.12); border: 1px solid rgba(212, 162, 78, 0.4); color: #e8c37c; font-size: 12.5px; letter-spacing: 0.04em; padding: 5px 14px; border-radius: 999px; }
	.cta-row { margin-top: 24px; }
	.btn { display: inline-block; background: linear-gradient(135deg, #ecc985, #c08c37); color: #221808; font-weight: 600; font-size: 16px; font-family: inherit; padding: 15px 30px; border: none; border-radius: 12px; cursor: pointer; text-decoration: none; box-shadow: 0 14px 30px rgba(200, 150, 63, 0.25); }
	.btn:hover { filter: brightness(1.07); }
	.btn-full { display: block; width: 100%; text-align: center; }
	.trust { border-top: 1px solid rgba(212, 162, 78, 0.16); border-bottom: 1px solid rgba(212, 162, 78, 0.16); background: rgba(212, 162, 78, 0.04); }
	.trust-inner { display: flex; justify-content: center; gap: 10px 30px; flex-wrap: wrap; padding: 15px 20px; color: #c3b697; font-size: 13.5px; }
	.section { padding: 56px 0; }
	.section-head { text-align: center; max-width: 620px; margin: 0 auto 36px; }
	.section-head h2 { font-size: clamp(26px, 5vw, 36px); line-height: 1.2; color: #f3ebd8; }
	.section-head .sub { color: #a3967b; margin-top: 12px; font-size: 15px; }
	.cards { display: grid; gap: 16px; }
	.card { background: #15120c; border: 1px solid rgba(212, 162, 78, 0.16); border-radius: 16px; padding: 28px 24px; }
	.ico { width: 54px; height: 54px; border-radius: 50%; border: 1px solid rgba(212, 162, 78, 0.45); background: rgba(212, 162, 78, 0.08); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 18px; }
	.card h3 { font-size: 20px; color: #eee0c0; margin-bottom: 8px; }
	.card p { color: #a89b7f; font-size: 14.5px; }
	.offer { max-width: 560px; margin: 0 auto; text-align: center; background: linear-gradient(180deg, #1b160d, #120e08); border: 1px solid rgba(212, 162, 78, 0.38); border-radius: 20px; padding: 38px 26px 30px; box-shadow: 0 34px 70px rgba(0, 0, 0, 0.45); }
	.offer h2 { font-size: 28px; color: #f3ebd8; margin-bottom: 16px; }
	.offer ul { list-style: none; max-width: 340px; margin: 24px auto; text-align: left; }
	.offer li { padding: 9px 0 9px 26px; position: relative; color: #cbbfa2; font-size: 15px; border-bottom: 1px dashed rgba(212, 162, 78, 0.16); }
	.offer li:last-child { border-bottom: none; }
	.offer li::before { content: "✦"; position: absolute; left: 0; color: #d4a24e; }
	.form-card { max-width: 520px; margin: 0 auto; background: #15110b; border: 1px solid rgba(212, 162, 78, 0.24); border-radius: 20px; padding: 32px 24px; }
	.field { margin-bottom: 18px; }
	.field label { display: block; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #b9aa87; margin-bottom: 8px; }
	.field input, .field select { width: 100%; background: #0e0b07; border: 1px solid rgba(212, 162, 78, 0.28); color: #f2e9d6; border-radius: 12px; padding: 13px 15px; font-size: 16px; font-family: inherit; }
	.field select { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, #d4a24e 50%), linear-gradient(135deg, #d4a24e 50%, transparent 50%); background-position: calc(100% - 21px) 50%, calc(100% - 15px) 50%; background-size: 6px 6px; background-repeat: no-repeat; }
	.field input:focus, .field select:focus { outline: none; border-color: #d4a24e; box-shadow: 0 0 0 3px rgba(212, 162, 78, 0.16); }
	.form-note { margin-top: 14px; text-align: center; color: #9c8f74; font-size: 13px; }
	.form-success { text-align: center; padding: 26px 4px; }
	.form-success-icon { font-size: 44px; margin-bottom: 14px; }
	.form-success h3 { font-size: 24px; color: #e8c37c; margin-bottom: 8px; }
	.form-success p { color: #b6a98d; }
	footer { border-top: 1px solid rgba(212, 162, 78, 0.14); padding: 34px 0 44px; text-align: center; color: #6f6450; font-size: 13px; }
	footer p + p { margin-top: 6px; }
	.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; background: rgba(13, 11, 8, 0.94); border-top: 1px solid rgba(212, 162, 78, 0.35); backdrop-filter: blur(10px); }
	.s-price { font-size: 21px; color: #e8c37c; line-height: 1.2; }
	.s-note { font-size: 11.5px; color: #9c8f74; }
	.sticky-cta .btn { padding: 12px 24px; font-size: 15px; box-shadow: none; }
	@media (min-width: 720px) {
		.cards { grid-template-columns: repeat(3, 1fr); }
	}
	@media (min-width: 768px) {
		.sticky-cta { display: none; }
		body { padding-bottom: 0; }
		.hero { padding: 84px 0 64px; }
		.section { padding: 72px 0; }
	}`;

const SOCIAL_CSS = `.reviews { display: grid; gap: 16px; }
	@media (min-width: 720px) { .reviews { grid-template-columns: repeat(3, 1fr); } }
	.review { background: #15120c; border: 1px solid rgba(212, 162, 78, 0.16); border-radius: 16px; padding: 24px 22px; }
	.stars { color: #e8c37c; letter-spacing: 4px; font-size: 14px; margin-bottom: 12px; }
	.review blockquote { color: #cfc3a6; font-size: 14.5px; font-style: italic; margin-bottom: 16px; }
	.who { display: flex; align-items: center; gap: 10px; }
	.avatar { width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(212, 162, 78, 0.5); background: rgba(212, 162, 78, 0.1); color: #e8c37c; font-family: Georgia, "Times New Roman", serif; display: flex; align-items: center; justify-content: center; font-size: 16px; }
	.who-name { font-size: 13.5px; color: #d8cdb0; line-height: 1.3; }
	.who-city { font-size: 12px; color: #8d8166; }
	.faq { max-width: 620px; margin: 0 auto; }
	.faq details { background: #14110b; border: 1px solid rgba(212, 162, 78, 0.18); border-radius: 14px; padding: 0 20px; margin-bottom: 12px; }
	.faq summary { list-style: none; cursor: pointer; padding: 17px 28px 17px 0; position: relative; font-size: 15.5px; color: #eadfc2; }
	.faq summary::-webkit-details-marker { display: none; }
	.faq summary::after { content: "+"; position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: #d4a24e; font-size: 20px; font-family: Georgia, "Times New Roman", serif; }
	.faq details[open] summary::after { content: "−"; }
	.faq details p { color: #a5987c; font-size: 14.5px; padding-bottom: 18px; }`;

const REVIEWS_HTML = `<section class="section">
		<div class="wrap">
			<div class="section-head">
				<p class="eyebrow">Ils l'ont adoptée</p>
				<h2>Plus de 900 clients conquis</h2>
			</div>
			<div class="reviews">
				<article class="review">
					<div class="stars">★★★★★</div>
					<blockquote>Reçue en 48 h à Alger. La qualité du cuir m'a surpris, on dirait une montre à 20&#8239;000 DA. Je recommande.</blockquote>
					<div class="who">
						<div class="avatar">S</div>
						<div>
							<div class="who-name">Sofiane B.</div>
							<div class="who-city">Alger</div>
						</div>
					</div>
				</article>
				<article class="review">
					<div class="stars">★★★★★</div>
					<blockquote>Très belle finition, le cadran est encore plus beau en vrai. Livreur sérieux, j'ai payé à la réception.</blockquote>
					<div class="who">
						<div class="avatar">K</div>
						<div>
							<div class="who-name">Karim M.</div>
							<div class="who-city">Oran</div>
						</div>
					</div>
				</article>
				<article class="review">
					<div class="stars">★★★★★</div>
					<blockquote>Achetée pour l'anniversaire de mon père, il ne la quitte plus. L'écrin cadeau fait vraiment son effet.</blockquote>
					<div class="who">
						<div class="avatar">Y</div>
						<div>
							<div class="who-name">Yacine T.</div>
							<div class="who-city">Constantine</div>
						</div>
					</div>
				</article>
			</div>
		</div>
	</section>`;

const FAQ_HTML = `<section class="section">
		<div class="wrap">
			<div class="section-head">
				<p class="eyebrow">Questions fréquentes</p>
				<h2>Tout ce qu'il faut savoir</h2>
			</div>
			<div class="faq">
				<details>
					<summary>Quel est le délai de livraison ?</summary>
					<p>Entre 24 et 72 h selon votre wilaya. Alger, Blida et Oran sont généralement livrées sous 24 à 48 h. Le livreur vous appelle avant de passer.</p>
				</details>
				<details>
					<summary>Puis-je retourner la montre ?</summary>
					<p>Oui. Vous disposez de 7 jours après réception pour un échange ou un retour si la montre ne vous convient pas — sans justification.</p>
				</details>
				<details>
					<summary>Y a-t-il une garantie ?</summary>
					<p>Chaque montre est garantie 12 mois contre tout défaut de fabrication : mouvement, cadran, couronne et fermoir.</p>
				</details>
				<details>
					<summary>Le bracelet convient-il à tous les poignets ?</summary>
					<p>Oui. Le bracelet en cuir comporte 7 trous d'ajustement et convient aux poignets de 15 à 21 cm.</p>
				</details>
			</div>
		</div>
	</section>`;

const TRUST_HTML = `<div class="trust">
		<div class="wrap trust-inner">
			<span>🚚 Livraison 58 wilayas</span>
			<span>💵 Paiement à la livraison</span>
			<span>↩️ Retour facile</span>
		</div>
	</div>`;

const BENEFITS_HTML = `<section class="section">
		<div class="wrap">
			<div class="section-head">
				<p class="eyebrow">Pourquoi elle fait la différence</p>
				<h2>Pensée pour durer, dessinée pour plaire</h2>
			</div>
			<div class="cards">
				<article class="card">
					<div class="ico">⚙️</div>
					<h3>Mouvement quartz japonais</h3>
					<p>Un mouvement précis et fiable (±20 secondes par mois), conçu pour fonctionner des années sans entretien.</p>
				</article>
				<article class="card">
					<div class="ico">🧵</div>
					<h3>Cuir véritable</h3>
					<p>Bracelet en cuir pleine fleur cousu main, qui se patine joliment et épouse le poignet dès les premiers jours.</p>
				</article>
				<article class="card">
					<div class="ico">💧</div>
					<h3>Étanche 3 ATM</h3>
					<p>Résiste aux éclaboussures et à la pluie. Portez-la au quotidien, au bureau comme en week-end.</p>
				</article>
			</div>
		</div>
	</section>`;

export const WATCH_PAGES: Record<string, MockPage> = {
	"watch-1": {
		title: "Montre Héritage 1969",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Montre Héritage 1969 — 4&#8239;900 DA · Paiement à la livraison</title>
<style>
	${BASE_CSS}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">Atelier Héritage</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">Collection vintage — édition 1969</p>
				<h1>L'élégance vintage,<br>à votre poignet.</h1>
				<p class="lead">Cadran inspiré des années 60, bracelet en cuir véritable et mouvement quartz japonais. Livrée partout en Algérie — vous payez à la réception.</p>
				<div class="watch-visual">${WATCH_SVG}</div>
				<div class="price-row">
					<span class="price">4&#8239;900 DA</span>
					<span class="compare">7&#8239;500 DA</span>
				</div>
				<p><span class="chip">Économisez 2&#8239;600 DA · −35&#8239;%</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Commander — Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_HTML}

		${BENEFITS_HTML}

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">Offre de lancement</p>
					<h2>La Montre Héritage 1969</h2>
					<div class="price-row">
						<span class="price">4&#8239;900 DA</span>
						<span class="compare">7&#8239;500 DA</span>
					</div>
					<p><span class="chip">Économisez 2&#8239;600 DA</span></p>
					<ul>
						<li>Montre Héritage 1969, cadran champagne</li>
						<li>Écrin cadeau offert</li>
						<li>Garantie 12 mois</li>
						<li>Livraison dans les 58 wilayas</li>
					</ul>
					<a class="btn btn-full" href="#commander">Je commande maintenant</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Commande en 30 secondes</p>
					<h2>Commandez maintenant</h2>
					<p class="sub">Remplissez le formulaire, nous vous appelons pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${FORM_FIELDS}
					<button class="btn btn-full" type="submit">Confirmer ma commande — 4&#8239;900 DA</button>
					<p class="form-note">💵 Paiement à la livraison · Vos données restent confidentielles.</p>
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 Atelier Héritage — Alger</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">4&#8239;900 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	${FORM_SCRIPT}
</body>
</html>`,
	},

	"watch-2": {
		title: "Montre Héritage 1969",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Montre Héritage 1969 — 4&#8239;900 DA · Paiement à la livraison</title>
<style>
	${BASE_CSS}
	${SOCIAL_CSS}
</style>
</head>
<body>
	<header class="site">
		<div class="wrap"><div class="brand">Atelier Héritage</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">Collection vintage — édition 1969</p>
				<h1>Une montre qui raconte<br>une époque. La vôtre.</h1>
				<p class="lead">Cadran champagne inspiré des années 60, cuir pleine fleur cousu main, mouvement quartz japonais. Livrée en 24 à 72 h partout en Algérie — vous ne payez qu'à la réception.</p>
				<div class="watch-visual">${WATCH_SVG}</div>
				<div class="price-row">
					<span class="price">4&#8239;900 DA</span>
					<span class="compare">7&#8239;500 DA</span>
				</div>
				<p><span class="chip">Économisez 2&#8239;600 DA · −35&#8239;%</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Commander — Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_HTML}

		${BENEFITS_HTML}

		${REVIEWS_HTML}

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">Offre de lancement</p>
					<h2>La Montre Héritage 1969</h2>
					<div class="price-row">
						<span class="price">4&#8239;900 DA</span>
						<span class="compare">7&#8239;500 DA</span>
					</div>
					<p><span class="chip">Économisez 2&#8239;600 DA</span></p>
					<ul>
						<li>Montre Héritage 1969, cadran champagne</li>
						<li>Écrin cadeau offert</li>
						<li>Garantie 12 mois</li>
						<li>Livraison dans les 58 wilayas</li>
					</ul>
					<a class="btn btn-full" href="#commander">Je commande maintenant</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		${FAQ_HTML}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Commande en 30 secondes</p>
					<h2>Commandez maintenant</h2>
					<p class="sub">Remplissez le formulaire, nous vous appelons pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					${FORM_FIELDS}
					<button class="btn btn-full" type="submit">Confirmer ma commande — 4&#8239;900 DA</button>
					<p class="form-note">💵 Paiement à la livraison · Vos données restent confidentielles.</p>
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 Atelier Héritage — Alger</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">4&#8239;900 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	${FORM_SCRIPT}
</body>
</html>`,
	},

	"watch-3": {
		title: "Montre Héritage 1969",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Montre Héritage 1969 — Offre de lancement · Paiement à la livraison</title>
<style>
	${BASE_CSS}
	${SOCIAL_CSS}
	.banner { background: linear-gradient(90deg, #3a2b10, #241a09); border-bottom: 1px solid rgba(212, 162, 78, 0.35); color: #ecd9a8; text-align: center; font-size: 13px; letter-spacing: 0.04em; padding: 9px 16px; }
	.banner strong { color: #f2dfae; }
	#compte { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-variant-numeric: tabular-nums; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(212, 162, 78, 0.3); color: #f0d69c; padding: 1px 8px; border-radius: 6px; margin-left: 4px; }
	.hero { padding: 64px 0 52px; }
	.hero h1 { font-size: clamp(34px, 7.5vw, 58px); letter-spacing: -0.01em; }
	.bundles { display: grid; gap: 12px; margin-bottom: 22px; }
	.bundle-slot { position: relative; }
	.bundle-slot input { position: absolute; opacity: 0; pointer-events: none; }
	.bundle { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #0e0b07; border: 1px solid rgba(212, 162, 78, 0.24); border-radius: 14px; padding: 15px 16px; cursor: pointer; position: relative; transition: border-color 0.15s ease, background 0.15s ease; }
	.bundle-slot input:checked + .bundle { border-color: #e8c37c; background: rgba(212, 162, 78, 0.1); box-shadow: inset 0 0 0 1px #e8c37c; }
	.b-name { display: block; font-size: 15.5px; color: #f0e6cd; }
	.b-sub { display: block; font-size: 12.5px; color: #9a8d72; margin-top: 2px; }
	.b-price { font-family: Georgia, "Times New Roman", serif; font-size: 19px; color: #e8c37c; white-space: nowrap; }
	.pop { position: absolute; top: -10px; right: 14px; background: linear-gradient(135deg, #ecc985, #c08c37); color: #241b0d; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 10px; border-radius: 999px; }
	@media (min-width: 768px) {
		.hero { padding: 92px 0 72px; }
		.section { padding: 80px 0; }
	}
</style>
</head>
<body>
	<div class="banner">⏳ <strong>Stock limité — offre de lancement</strong> · se termine dans <span id="compte">--:--:--</span></div>

	<header class="site">
		<div class="wrap"><div class="brand">Atelier Héritage</div></div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap">
				<p class="eyebrow">Collection vintage — édition 1969</p>
				<h1>Une montre qui raconte<br>une époque. La vôtre.</h1>
				<p class="lead">Cadran champagne inspiré des années 60, cuir pleine fleur cousu main, mouvement quartz japonais. Livrée en 24 à 72 h partout en Algérie — vous ne payez qu'à la réception.</p>
				<div class="watch-visual">${WATCH_SVG}</div>
				<div class="price-row">
					<span class="price">4&#8239;900 DA</span>
					<span class="compare">7&#8239;500 DA</span>
				</div>
				<p><span class="chip">Économisez 2&#8239;600 DA · −35&#8239;%</span></p>
				<p class="cta-row"><a class="btn" href="#commander">Commander — Paiement à la livraison</a></p>
			</div>
		</section>

		${TRUST_HTML}

		${BENEFITS_HTML}

		${REVIEWS_HTML}

		<section class="section">
			<div class="wrap">
				<div class="offer">
					<p class="eyebrow">Ce qui est inclus</p>
					<h2>Chaque montre est livrée avec</h2>
					<ul>
						<li>Écrin cadeau rigide, prêt à offrir</li>
						<li>Garantie 12 mois, mouvement et cadran</li>
						<li>Livraison 58 wilayas — paiement à la réception</li>
						<li>Retour facile sous 7 jours</li>
					</ul>
					<a class="btn btn-full" href="#commander">Choisir mon offre</a>
					<p class="form-note">💵 Aucun prépaiement — vous payez le livreur à la réception.</p>
				</div>
			</div>
		</section>

		${FAQ_HTML}

		<section class="section">
			<div class="wrap">
				<div class="section-head">
					<p class="eyebrow">Offre de lancement — ce soir minuit</p>
					<h2>Choisissez votre offre</h2>
					<p class="sub">Remplissez le formulaire, nous vous appelons pour confirmer. Paiement à la livraison.</p>
				</div>
				<form id="commander" class="form-card" autocomplete="on">
					<div class="bundles">
						<div class="bundle-slot">
							<input type="radio" name="offre" id="offre-1" value="1-montre" data-prix="4&#8239;900 DA">
							<label class="bundle" for="offre-1">
								<span>
									<span class="b-name">1 montre</span>
									<span class="b-sub">L'essentiel, pour vous</span>
								</span>
								<span class="b-price">4&#8239;900 DA</span>
							</label>
						</div>
						<div class="bundle-slot">
							<input type="radio" name="offre" id="offre-2" value="2-montres" data-prix="8&#8239;900 DA" checked>
							<label class="bundle" for="offre-2">
								<span class="pop">La plus populaire</span>
								<span>
									<span class="b-name">2 montres</span>
									<span class="b-sub">Idéal en duo · économisez 900 DA</span>
								</span>
								<span class="b-price">8&#8239;900 DA</span>
							</label>
						</div>
						<div class="bundle-slot">
							<input type="radio" name="offre" id="offre-3" value="3-montres" data-prix="11&#8239;900 DA">
							<label class="bundle" for="offre-3">
								<span>
									<span class="b-name">3 montres</span>
									<span class="b-sub">Le pack cadeau · économisez 2&#8239;800 DA</span>
								</span>
								<span class="b-price">11&#8239;900 DA</span>
							</label>
						</div>
					</div>
					${FORM_FIELDS}
					<button class="btn btn-full" type="submit">Confirmer ma commande — <span id="total-commande">8&#8239;900 DA</span></button>
					<p class="form-note">💵 Paiement à la livraison · Vos données restent confidentielles.</p>
				</form>
			</div>
		</section>
	</main>

	<footer>
		<div class="wrap">
			<p>© 2026 Atelier Héritage — Alger</p>
			<p>Paiement à la livraison partout en Algérie · Retour sous 7 jours</p>
		</div>
	</footer>

	<div class="sticky-cta">
		<div>
			<div class="s-price">Dès 4&#8239;900 DA</div>
			<div class="s-note">Paiement à la livraison</div>
		</div>
		<a class="btn" href="#commander">Commander</a>
	</div>

	<script>
		(function () {
			var compte = document.getElementById("compte");
			function pad(n) { return (n < 10 ? "0" : "") + n; }
			function tick() {
				var now = new Date();
				var minuit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
				var restant = Math.max(0, Math.floor((minuit.getTime() - now.getTime()) / 1000));
				var h = Math.floor(restant / 3600);
				var m = Math.floor((restant % 3600) / 60);
				var s = restant % 60;
				compte.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
			}
			if (compte) {
				tick();
				setInterval(tick, 1000);
			}

			var form = document.getElementById("commander");
			if (!form) return;
			var total = document.getElementById("total-commande");
			var radios = form.querySelectorAll('input[name="offre"]');
			for (var i = 0; i < radios.length; i++) {
				radios[i].addEventListener("change", function () {
					if (total) total.textContent = this.getAttribute("data-prix");
				});
			}
			form.addEventListener("submit", function (event) {
				event.preventDefault();
				var honeypot = form.querySelector('input[name="website"]');
				if (honeypot && honeypot.value) return;
				form.innerHTML = '<div class="form-success"><div class="form-success-icon">✅</div><h3>Commande reçue ✅</h3><p>Nous vous appellerons pour confirmer.</p></div>';
				form.scrollIntoView({ behavior: "smooth", block: "center" });
			});
		})();
	</script>
</body>
</html>`,
	},
};
