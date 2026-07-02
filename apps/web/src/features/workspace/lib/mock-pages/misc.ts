// Mock AI-generated landing pages, mixed verticals: Ramadan dates pack (FR), dental clinic
// appointments (FR service page), Meta Ads training cohort (FR), and a gaming chair (EN).

import type { MockPage } from "./shared";

export const MISC_PAGES: Record<string, MockPage> = {
	"dates-1": {
		title: "Pack Ramadan — Dattes Deglet Nour de Tolga",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pack Ramadan — Dattes Deglet Nour de Tolga</title>
<style>
:root{
	--bg:#0e2a1c;
	--bg-deep:#0a2015;
	--panel:#123524;
	--line:#1f4a33;
	--ink:#f4efe3;
	--muted:#b9c9b1;
	--gold:#d4af37;
	--gold-soft:#e8cd7a;
	--radius:18px;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.6;padding-bottom:88px;
}
.wrap{max-width:1020px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:Georgia,serif;font-weight:600;line-height:1.18}
.eyebrow{
	display:inline-block;font-size:12px;letter-spacing:.22em;text-transform:uppercase;
	color:var(--gold);font-weight:700;margin-bottom:14px;
}
section{padding:60px 0}
.btn{
	display:inline-block;background:linear-gradient(135deg,var(--gold-soft),var(--gold));
	color:#241a05;text-decoration:none;font-weight:700;font-size:16px;
	padding:16px 32px;border-radius:999px;border:none;cursor:pointer;
	box-shadow:0 12px 26px -10px rgba(212,175,55,.5);
	transition:transform .15s ease;
}
.btn:hover{transform:translateY(-2px)}
/* Header */
header{padding:18px 0;border-bottom:1px solid var(--line)}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-family:Georgia,serif;font-size:19px}
.brand span{color:var(--gold)}
.header-badge{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:6px 14px;border-radius:999px}
/* Hero */
.hero{padding:52px 0;background:
	radial-gradient(55% 45% at 85% 0%,rgba(212,175,55,.14) 0%,transparent 70%),var(--bg);}
.hero .wrap{display:grid;gap:36px;align-items:center}
.hero h1{font-size:36px;margin-bottom:16px}
.hero h1 em{font-style:italic;color:var(--gold-soft)}
.hero p.lead{color:var(--muted);font-size:17px;max-width:46ch;margin-bottom:26px}
.hero-visual{display:flex;justify-content:center}
.moon-scene{
	width:270px;height:270px;border-radius:50%;position:relative;
	background:radial-gradient(circle at 32% 28%,#1d4c33 0%,#0f2e1e 65%,#0a2015 100%);
	border:1px solid var(--line);display:flex;align-items:center;justify-content:center;
	box-shadow:0 24px 50px -20px rgba(0,0,0,.6);
}
.moon-scene .palm{font-size:100px;filter:drop-shadow(0 14px 18px rgba(0,0,0,.5))}
.moon-scene .moon{position:absolute;top:30px;right:44px;font-size:38px}
.moon-scene .star{position:absolute;bottom:52px;left:38px;font-size:22px}
.trust{
	display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:28px;
	padding:14px 18px;border:1px solid var(--line);border-radius:14px;
	background:var(--panel);font-size:13px;color:var(--muted);
}
.trust b{color:var(--ink);font-weight:600}
/* Story */
.story .wrap{display:grid;gap:28px}
.story h2{font-size:28px;margin-bottom:14px}
.story h2 span{color:var(--gold-soft)}
.story p{color:var(--muted);margin-bottom:14px}
.story p b{color:var(--ink)}
.origin-card{
	background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
	padding:26px 24px;
}
.origin-card h3{font-size:17px;color:var(--gold-soft);margin-bottom:10px}
.origin-card ul{list-style:none}
.origin-card li{padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;color:var(--muted)}
.origin-card li:last-child{border-bottom:none}
.origin-card li b{color:var(--ink)}
/* Benefits */
.benefits{padding-top:0}
.section-head{text-align:center;max-width:56ch;margin:0 auto 36px}
.section-head h2{font-size:28px;margin-bottom:10px}
.section-head p{color:var(--muted)}
.b-grid{display:grid;gap:16px}
.b-card{
	background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
	padding:24px 22px;
}
.b-card .icon{font-size:30px;margin-bottom:12px;display:block}
.b-card h3{font-size:17px;margin-bottom:6px}
.b-card p{font-size:14px;color:var(--muted)}
/* Packs + form */
.order{background:var(--bg-deep);border-top:1px solid var(--line)}
.form-panel{
	max-width:560px;margin:0 auto;background:var(--panel);border:1px solid var(--line);
	border-radius:22px;padding:32px 26px;
}
.form-panel h2{font-size:24px;text-align:center;margin-bottom:6px}
.form-panel .sub{text-align:center;font-size:14px;color:var(--muted);margin-bottom:24px}
.group-label{
	display:block;font-size:12px;font-weight:700;letter-spacing:.14em;
	text-transform:uppercase;color:var(--gold);margin-bottom:10px;
}
.packs{display:grid;gap:12px;margin-bottom:24px}
.packs input{position:absolute;opacity:0;pointer-events:none}
.packs label{
	display:block;border:1px solid var(--line);border-radius:16px;padding:16px 18px;
	cursor:pointer;background:var(--bg);transition:border-color .12s ease;position:relative;
}
.packs label:hover{border-color:var(--gold)}
.packs input:checked + label{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.pack-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.pack-name{font-weight:700;font-size:15px}
.pack-price{font-family:Georgia,serif;font-size:20px;color:var(--gold-soft);white-space:nowrap}
.pack-sub{display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap}
.pack-compare{font-size:13px;color:var(--muted);text-decoration:line-through}
.pack-chip{
	font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
	color:#241a05;background:var(--gold-soft);padding:4px 10px;border-radius:999px;
}
.pack-note{font-size:12px;color:var(--muted);margin-top:4px}
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:12px;
	border:1px solid var(--line);background:var(--bg);color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--gold);border-color:var(--gold)}
.form-panel .btn{width:100%;margin-top:6px}
.form-note{text-align:center;font-size:12px;color:var(--muted);margin-top:12px}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:22px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{padding:34px 0 46px;text-align:center;border-top:1px solid var(--line)}
footer .brand{margin-bottom:6px}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(10,32,21,.94);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-family:Georgia,serif;font-size:19px;color:var(--gold-soft)}
.sticky-cta .c{font-size:12px;color:var(--muted)}
.sticky-cta .btn{padding:12px 22px;font-size:14px}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.1fr .9fr}
	.hero h1{font-size:46px}
	.story .wrap{grid-template-columns:1.1fr .9fr;align-items:start}
	.b-grid{grid-template-columns:repeat(3,1fr)}
	section{padding:84px 0}
	.moon-scene{width:320px;height:320px}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">Dattes <span>de Tolga</span></div>
		<div class="header-badge">Récolte 2025 · Biskra</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">Pack Ramadan · Édition limitée</span>
			<h1>La <em>Deglet Nour</em> de Tolga, sur votre table du ftour</h1>
			<p class="lead">Des dattes premium calibre extra, récoltées à la main dans les palmeraies de Tolga et mises en boîte la même semaine. Moelleuses, mielleuses, jamais sèches.</p>
			<a class="btn" href="#commander">Commander mon pack — Paiement à la livraison</a>
			<div class="trust">
				<span>🚚 <b>Livraison 58 wilayas</b></span>
				<span>💵 <b>Paiement à la livraison</b></span>
				<span>↩️ <b>Retour facile</b></span>
			</div>
		</div>
		<div class="hero-visual">
			<div class="moon-scene">
				<span class="moon">🌙</span>
				<span class="palm">🌴</span>
				<span class="star">✨</span>
			</div>
		</div>
	</div>
</section>

<section class="story">
	<div class="wrap">
		<div>
			<span class="eyebrow">L'origine</span>
			<h2>De la palmeraie de <span>Tolga</span> à votre porte</h2>
			<p>À Tolga, wilaya de Biskra, la Deglet Nour n'est pas un produit — c'est un héritage. Nos palmiers sont cultivés par la même famille depuis trois générations, irrigués par les eaux du Sahara et récoltés à maturité parfaite, entre octobre et novembre.</p>
			<p><b>Aucun intermédiaire, aucun stock qui dort.</b> Chaque boîte de 500g est triée à la main : uniquement le calibre extra, translucide à la lumière, signe d'une datte au miel naturel.</p>
			<p>Pour le Ramadan, nous préparons un nombre limité de packs — réservez le vôtre avant la rupture.</p>
		</div>
		<div class="origin-card">
			<h3>Ce qui rend nos dattes différentes</h3>
			<ul>
				<li><b>Origine unique :</b> palmeraies de Tolga, Biskra</li>
				<li><b>Calibre extra</b> trié à la main, boîte par boîte</li>
				<li><b>Récolte 2025</b> — mise en boîte la semaine de la cueillette</li>
				<li><b>Sans additifs</b> — ni sirop, ni conservateurs</li>
				<li><b>Boîte cadeau</b> prête à offrir pour le ftour</li>
			</ul>
		</div>
	</div>
</section>

<section class="benefits">
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Pourquoi la Deglet Nour</span>
			<h2>L'énergie du ftour, la douceur du terroir</h2>
		</div>
		<div class="b-grid">
			<div class="b-card">
				<span class="icon">⚡</span>
				<h3>Énergie naturelle</h3>
				<p>Sucres naturels à assimilation rapide — l'aliment idéal pour rompre le jeûne en douceur.</p>
			</div>
			<div class="b-card">
				<span class="icon">🍯</span>
				<h3>Goût miel authentique</h3>
				<p>La vraie Deglet Nour translucide, moelleuse à cœur, sans sirop ajouté ni glaçage.</p>
			</div>
			<div class="b-card">
				<span class="icon">🎁</span>
				<h3>Prête à offrir</h3>
				<p>Une boîte élégante qui honore votre table et fait un cadeau de Ramadan apprécié.</p>
			</div>
		</div>
	</div>
</section>

<section class="order">
	<div class="wrap">
		<form class="form-panel" id="commander">
			<h2>Choisissez votre pack</h2>
			<p class="sub">Livraison rapide avant le Ramadan — vous payez à la réception. 💵</p>
			<span class="group-label">Votre pack</span>
			<div class="packs">
				<input type="radio" id="pack-1" name="pack" value="1 boite">
				<label for="pack-1">
					<div class="pack-top">
						<span class="pack-name">1 boîte — 500g</span>
						<span class="pack-price">1 800 DA</span>
					</div>
					<p class="pack-note">Pour découvrir le calibre extra de Tolga.</p>
				</label>
				<input type="radio" id="pack-2" name="pack" value="2 boites" checked>
				<label for="pack-2">
					<div class="pack-top">
						<span class="pack-name">2 boîtes — 1 kg</span>
						<span class="pack-price">3 400 DA</span>
					</div>
					<div class="pack-sub">
						<span class="pack-compare">3 600 DA</span>
						<span class="pack-chip">Livraison offerte</span>
					</div>
					<p class="pack-note">Le choix des familles — de quoi tenir tout le mois.</p>
				</label>
				<input type="radio" id="pack-4" name="pack" value="4 boites">
				<label for="pack-4">
					<div class="pack-top">
						<span class="pack-name">4 boîtes — 2 kg</span>
						<span class="pack-price">6 400 DA</span>
					</div>
					<div class="pack-sub">
						<span class="pack-compare">7 200 DA</span>
						<span class="pack-chip">Économisez 800 DA</span>
					</div>
					<p class="pack-note">Pour la grande famille — ou pour offrir.</p>
				</label>
			</div>
			<div class="field">
				<label for="f-nom">Nom complet</label>
				<input type="text" id="f-nom" name="fullname" placeholder="Votre nom et prénom" required>
			</div>
			<div class="field">
				<label for="f-tel">Numéro de téléphone</label>
				<input type="tel" id="f-tel" name="phone" placeholder="05 XX XX XX XX" required>
			</div>
			<div class="field">
				<label for="f-wilaya">Wilaya</label>
				<select id="f-wilaya" name="wilaya" required>
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
				<label for="f-commune">Commune</label>
				<input type="text" id="f-commune" name="commune" placeholder="Votre commune" required>
			</div>
			<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
			<button class="btn" type="submit">Commander — Paiement à la livraison</button>
			<p class="form-note">Nous vous appelons pour confirmer avant l'expédition. Aucun paiement en ligne.</p>
		</form>
	</div>
</section>

<footer>
	<div class="wrap">
		<div class="brand">Dattes <span>de Tolga</span></div>
		<p>Palmeraies de Tolga, Biskra · Livraison partout en Algérie · saha ftourkoum 🌙</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">Dès 1 800 DA</div>
		<div class="c">Pack Ramadan limité</div>
	</div>
	<a class="btn" href="#commander">Commander</a>
</div>

<script>
(function(){
	var form = document.getElementById("commander");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = '<div class="success"><h3>Commande reçue ✅</h3><p>Nous vous appellerons pour confirmer.</p></div>';
	});
})();
</script>

</body>
</html>`,
	},
	"dental-1": {
		title: "Cabinet Dentaire Dr. Amine — Alger",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cabinet Dentaire Dr. Amine — Hydra, Alger</title>
<style>
:root{
	--bg:#ffffff;
	--bg-soft:#f2fafa;
	--panel:#ffffff;
	--line:#dcecec;
	--ink:#123c3c;
	--muted:#5b7a7a;
	--teal:#0e8583;
	--teal-deep:#0a6866;
	--radius:18px;
	--shadow:0 16px 38px -20px rgba(14,133,131,.28);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.6;padding-bottom:88px;
}
.wrap{max-width:1020px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-weight:700;line-height:1.2;letter-spacing:-.01em}
.eyebrow{
	display:inline-block;font-size:12px;letter-spacing:.18em;text-transform:uppercase;
	color:var(--teal);font-weight:700;margin-bottom:14px;
}
section{padding:60px 0}
.btn{
	display:inline-block;background:linear-gradient(135deg,var(--teal),var(--teal-deep));
	color:#fff;text-decoration:none;font-weight:700;font-size:16px;
	padding:16px 32px;border-radius:14px;border:none;cursor:pointer;
	box-shadow:0 12px 26px -10px rgba(14,133,131,.5);
	transition:transform .15s ease;
}
.btn:hover{transform:translateY(-2px)}
/* Header */
header{padding:18px 0;border-bottom:1px solid var(--line)}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:17px}
.brand span{color:var(--teal)}
.header-badge{font-size:12px;color:var(--muted);background:var(--bg-soft);padding:6px 14px;border-radius:999px}
/* Hero */
.hero{padding:52px 0;background:linear-gradient(180deg,var(--bg) 0%,var(--bg-soft) 100%)}
.hero .wrap{display:grid;gap:34px;align-items:center}
.hero h1{font-size:34px;margin-bottom:14px}
.hero h1 span{color:var(--teal)}
.hero p.lead{color:var(--muted);font-size:17px;max-width:46ch;margin-bottom:24px}
.markers{display:grid;gap:10px;margin-bottom:26px}
.marker{
	display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);
	border-radius:14px;padding:12px 16px;font-size:14px;box-shadow:var(--shadow);
}
.marker .ic{font-size:20px}
.marker b{font-weight:700}
.doctor-card{
	background:#fff;border:1px solid var(--line);border-radius:24px;padding:30px 26px;
	text-align:center;box-shadow:var(--shadow);
}
.doctor-card .avatar{
	width:110px;height:110px;border-radius:50%;margin:0 auto 16px;
	background:radial-gradient(circle at 35% 30%,#d9f3f2,#9ed9d7);
	display:flex;align-items:center;justify-content:center;font-size:52px;
}
.doctor-card h2{font-size:20px;margin-bottom:4px}
.doctor-card .role{font-size:13px;color:var(--muted);margin-bottom:14px}
.doctor-card .quote{font-family:Georgia,serif;font-style:italic;font-size:15px;color:var(--ink)}
/* Services */
.section-head{text-align:center;max-width:58ch;margin:0 auto 36px}
.section-head h2{font-size:28px;margin-bottom:10px}
.section-head p{color:var(--muted)}
.s-grid{display:grid;gap:16px}
.s-card{
	background:#fff;border:1px solid var(--line);border-radius:var(--radius);
	padding:24px 22px;box-shadow:var(--shadow);
}
.s-card .icon{
	width:48px;height:48px;border-radius:14px;background:var(--bg-soft);
	display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:14px;
}
.s-card h3{font-size:17px;margin-bottom:6px}
.s-card p{font-size:14px;color:var(--muted);margin-bottom:12px}
.s-card .from{font-size:13px;font-weight:700;color:var(--teal)}
/* Horaires */
.hours{padding-top:0}
.hours-card{
	max-width:560px;margin:0 auto;background:#fff;border:1px solid var(--line);
	border-radius:22px;padding:28px 26px;box-shadow:var(--shadow);
}
.hours-card h2{font-size:20px;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.hours-card table{width:100%;border-collapse:collapse;font-size:14px}
.hours-card td{padding:10px 4px;border-bottom:1px solid var(--line)}
.hours-card tr:last-child td{border-bottom:none}
.hours-card td:last-child{text-align:right;color:var(--muted)}
.hours-card .open td:last-child{color:var(--teal);font-weight:700}
/* Form */
.book{background:var(--bg-soft);border-top:1px solid var(--line)}
.form-panel{
	max-width:520px;margin:0 auto;background:#fff;border:1px solid var(--line);
	border-radius:24px;padding:32px 26px;box-shadow:var(--shadow);
}
.form-panel h2{font-size:23px;text-align:center;margin-bottom:6px}
.form-panel .sub{text-align:center;font-size:14px;color:var(--muted);margin-bottom:24px}
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:12px;
	border:1px solid var(--line);background:#fbfefe;color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--teal);border-color:var(--teal)}
.form-panel .btn{width:100%;margin-top:6px}
.form-note{text-align:center;font-size:12px;color:var(--muted);margin-top:12px}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:21px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{padding:34px 0 46px;text-align:center;border-top:1px solid var(--line)}
footer .brand{margin-bottom:6px;display:block}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-weight:800;font-size:15px}
.sticky-cta .c{font-size:12px;color:var(--muted)}
.sticky-cta .btn{padding:12px 22px;font-size:14px;white-space:nowrap}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.15fr .85fr}
	.hero h1{font-size:44px}
	.markers{grid-template-columns:repeat(2,1fr)}
	.s-grid{grid-template-columns:repeat(2,1fr)}
	section{padding:84px 0}
}
@media(min-width:980px){
	.s-grid{grid-template-columns:repeat(4,1fr)}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">🦷 Cabinet <span>Dr. Amine</span></div>
		<div class="header-badge">Hydra · Alger</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">Cabinet dentaire · Hydra, Alger</span>
			<h1>Un sourire sain, <span>sans stress</span> et sans attente</h1>
			<p class="lead">Le Dr. Amine et son équipe vous accueillent dans un cabinet moderne au cœur d'Hydra. Diagnostic clair, devis transparent avant tout soin, et des créneaux qui respectent votre temps.</p>
			<div class="markers">
				<div class="marker"><span class="ic">👨‍⚕️</span><span><b>12 ans d'expérience</b> en omnipratique et esthétique</span></div>
				<div class="marker"><span class="ic">🧼</span><span><b>Matériel stérilisé</b> — chaîne d'asepsie contrôlée</span></div>
				<div class="marker"><span class="ic">📋</span><span><b>Devis avant soin</b> — aucune surprise sur les tarifs</span></div>
				<div class="marker"><span class="ic">⭐</span><span><b>4,9/5</b> — plus de 300 patients satisfaits</span></div>
			</div>
			<a class="btn" href="#book">Prendre rendez-vous</a>
		</div>
		<div class="doctor-card">
			<div class="avatar">🦷</div>
			<h2>Dr. Amine Benali</h2>
			<p class="role">Chirurgien-dentiste · Diplômé de la faculté d'Alger</p>
			<p class="quote">« Mon travail commence par vous écouter. Un bon soin, c'est d'abord un patient qui comprend ce qu'on fait et pourquoi. »</p>
		</div>
	</div>
</section>

<section>
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Nos soins</span>
			<h2>Des soins complets, au même endroit</h2>
			<p>Du détartrage de routine à l'implantologie, tout se fait au cabinet — avec le même niveau d'exigence.</p>
		</div>
		<div class="s-grid">
			<div class="s-card">
				<div class="icon">✨</div>
				<h3>Blanchiment</h3>
				<p>Un sourire visiblement plus lumineux en une séance, sans sensibilité excessive.</p>
				<span class="from">À partir de 15 000 DA</span>
			</div>
			<div class="s-card">
				<div class="icon">😁</div>
				<h3>Orthodontie</h3>
				<p>Alignement pour adolescents et adultes — bagues ou gouttières discrètes.</p>
				<span class="from">À partir de 20 000 DA</span>
			</div>
			<div class="s-card">
				<div class="icon">🔩</div>
				<h3>Implants</h3>
				<p>Remplacement fixe et durable d'une ou plusieurs dents, planifié en 3D.</p>
				<span class="from">À partir de 80 000 DA</span>
			</div>
			<div class="s-card">
				<div class="icon">🪥</div>
				<h3>Détartrage</h3>
				<p>Nettoyage complet et polissage pour des gencives saines, deux fois par an.</p>
				<span class="from">À partir de 3 000 DA</span>
			</div>
		</div>
	</div>
</section>

<section class="hours">
	<div class="wrap">
		<div class="hours-card">
			<h2>🕘 Horaires du cabinet</h2>
			<table>
				<tr class="open"><td>Samedi — Jeudi</td><td>9h00 — 18h00</td></tr>
				<tr><td>Vendredi</td><td>Fermé</td></tr>
				<tr><td>Urgences</td><td>Sur appel, selon disponibilité</td></tr>
			</table>
		</div>
	</div>
</section>

<section class="book">
	<div class="wrap">
		<form class="form-panel" id="book">
			<h2>Demandez votre rendez-vous</h2>
			<p class="sub">Laissez vos coordonnées — le cabinet vous rappelle pour fixer le créneau.</p>
			<div class="field">
				<label for="f-nom">Nom complet</label>
				<input type="text" id="f-nom" name="fullname" placeholder="Votre nom et prénom" required>
			</div>
			<div class="field">
				<label for="f-tel">Numéro de téléphone</label>
				<input type="tel" id="f-tel" name="phone" placeholder="05 XX XX XX XX" required>
			</div>
			<div class="field">
				<label for="f-service">Soin souhaité</label>
				<select id="f-service" name="service" required>
					<option value="" disabled selected>Choisissez un soin</option>
					<option value="blanchiment">Blanchiment</option>
					<option value="orthodontie">Orthodontie</option>
					<option value="implants">Implants</option>
					<option value="detartrage">Détartrage</option>
					<option value="consultation">Consultation / autre</option>
				</select>
			</div>
			<div class="field">
				<label for="f-jour">Jour préféré</label>
				<select id="f-jour" name="jour" required>
					<option value="" disabled selected>Choisissez un jour</option>
					<option value="samedi">Samedi</option>
					<option value="dimanche">Dimanche</option>
					<option value="lundi">Lundi</option>
					<option value="mardi">Mardi</option>
					<option value="mercredi">Mercredi</option>
					<option value="jeudi">Jeudi</option>
				</select>
			</div>
			<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
			<button class="btn" type="submit">Demander un rendez-vous</button>
			<p class="form-note">Réponse sous 24h ouvrées. Vos données restent au cabinet.</p>
		</form>
	</div>
</section>

<footer>
	<div class="wrap">
		<span class="brand">🦷 Cabinet <span>Dr. Amine</span></span>
		<p>12 rue des Frères Bouadou, Hydra, Alger · Sam–Jeu 9h–18h · 023 XX XX XX</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">Cabinet Dr. Amine</div>
		<div class="c">Sam–Jeu · 9h–18h · Hydra</div>
	</div>
	<a class="btn" href="#book">Rendez-vous</a>
</div>

<script>
(function(){
	var form = document.getElementById("book");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = '<div class="success"><h3>Demande envoyée ✅</h3><p>Le cabinet vous rappellera pour confirmer le créneau.</p></div>';
	});
})();
</script>

</body>
</html>`,
	},
	"formation-1": {
		title: "Formation Meta Ads — Cohorte 3",
		lang: "fr",
		html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Formation Meta Ads — Cohorte 3 · 20 places</title>
<style>
:root{
	--bg:#14122e;
	--bg-deep:#0e0c22;
	--panel:#1d1a3e;
	--line:#312c5e;
	--ink:#efedff;
	--muted:#a5a0cc;
	--accent:#f5a623;
	--accent-soft:#ffc35c;
	--radius:18px;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.6;padding-bottom:88px;
}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-weight:800;line-height:1.15;letter-spacing:-.01em}
.eyebrow{
	display:inline-block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;
	color:var(--accent);font-weight:700;margin-bottom:14px;
}
section{padding:60px 0}
.btn{
	display:inline-block;background:linear-gradient(135deg,var(--accent-soft),var(--accent));
	color:#241703;text-decoration:none;font-weight:800;font-size:16px;
	padding:16px 32px;border-radius:14px;border:none;cursor:pointer;
	box-shadow:0 12px 28px -10px rgba(245,166,35,.5);
	transition:transform .15s ease;
}
.btn:hover{transform:translateY(-2px)}
/* Header */
header{padding:18px 0;border-bottom:1px solid var(--line)}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:16px}
.brand span{color:var(--accent)}
.seats-tag{
	font-size:12px;font-weight:700;color:var(--accent);
	border:1px solid var(--accent);padding:6px 12px;border-radius:999px;
}
/* Hero */
.hero{padding:52px 0;background:
	radial-gradient(55% 45% at 15% 0%,rgba(245,166,35,.14) 0%,transparent 70%),var(--bg);}
.hero h1{font-size:36px;margin-bottom:16px;max-width:22ch}
.hero h1 span{color:var(--accent)}
.hero p.lead{color:var(--muted);font-size:17px;max-width:52ch;margin-bottom:26px}
.hero p.lead b{color:var(--ink)}
.trust{
	display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:28px;
	padding:14px 18px;border:1px solid var(--line);border-radius:14px;
	background:var(--panel);font-size:13px;color:var(--muted);
}
.trust b{color:var(--ink);font-weight:600}
/* Programme */
.section-head{text-align:center;max-width:56ch;margin:0 auto 36px}
.section-head h2{font-size:28px;margin-bottom:10px}
.section-head p{color:var(--muted)}
.modules{max-width:640px;margin:0 auto;display:grid;gap:12px;counter-reset:mod}
.module{
	display:flex;gap:16px;align-items:flex-start;background:var(--panel);
	border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;
}
.module .num{
	flex:0 0 40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;
	font-weight:800;font-size:16px;color:#241703;
	background:linear-gradient(135deg,var(--accent-soft),var(--accent));
}
.module h3{font-size:16px;margin-bottom:4px}
.module p{font-size:14px;color:var(--muted)}
.module .dur{
	margin-left:auto;flex-shrink:0;font-size:12px;font-weight:700;color:var(--accent);
	border:1px solid var(--line);padding:4px 10px;border-radius:999px;white-space:nowrap;
}
/* Formateur */
.mentor{padding-top:0}
.mentor-card{
	max-width:640px;margin:0 auto;display:flex;gap:20px;align-items:flex-start;
	background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:26px 24px;
}
.mentor-card .avatar{
	flex:0 0 76px;height:76px;border-radius:50%;font-size:36px;
	background:radial-gradient(circle at 35% 30%,#3d3776,#262153);
	display:flex;align-items:center;justify-content:center;
}
.mentor-card h3{font-size:19px;margin-bottom:2px}
.mentor-card .role{font-size:13px;color:var(--accent);font-weight:700;margin-bottom:10px}
.mentor-card p{font-size:14px;color:var(--muted)}
.mentor-stats{display:flex;gap:14px;margin-top:12px;flex-wrap:wrap}
.mentor-stats span{
	font-size:12px;font-weight:700;background:var(--bg-deep);border:1px solid var(--line);
	padding:6px 12px;border-radius:999px;color:var(--ink);
}
/* Testimonials */
.quotes{padding-top:0}
.q-grid{display:grid;gap:16px;max-width:760px;margin:0 auto}
.q-card{
	background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
	padding:24px 22px;
}
.q-card .stars{color:var(--accent);letter-spacing:2px;margin-bottom:10px;font-size:14px}
.q-card p{font-family:Georgia,serif;font-style:italic;font-size:15px;margin-bottom:14px}
.q-card .who{font-size:13px;color:var(--muted)}
.q-card .who b{color:var(--ink)}
/* Offer + form */
.enroll{background:var(--bg-deep);border-top:1px solid var(--line)}
.enroll-grid{display:grid;gap:24px;max-width:560px;margin:0 auto}
.price-card{
	background:var(--panel);border:1px solid var(--accent);border-radius:22px;
	padding:30px 26px;text-align:center;
}
.price-card h2{font-size:22px;margin-bottom:14px}
.price{font-size:44px;font-weight:800;color:var(--accent);margin-bottom:6px}
.price-note{font-size:13px;color:var(--muted);margin-bottom:18px}
.perks{list-style:none;font-size:14px;color:var(--muted);text-align:left;max-width:34ch;margin:0 auto}
.perks li{padding:7px 0;border-bottom:1px solid var(--line)}
.perks li:last-child{border-bottom:none}
.perks b{color:var(--ink)}
form{
	background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:30px 26px;
}
form h3{font-size:20px;text-align:center;margin-bottom:4px}
form .sub{text-align:center;font-size:13px;color:var(--muted);margin-bottom:22px}
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:12px;
	border:1px solid var(--line);background:var(--bg-deep);color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--accent);border-color:var(--accent)}
form .btn{width:100%;margin-top:6px}
.form-note{text-align:center;font-size:12px;color:var(--muted);margin-top:12px}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:21px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{padding:34px 0 46px;text-align:center;border-top:1px solid var(--line)}
footer .brand{display:block;margin-bottom:6px}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(14,12,34,.94);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-weight:800;font-size:19px;color:var(--accent)}
.sticky-cta .c{font-size:12px;color:var(--muted)}
.sticky-cta .btn{padding:12px 22px;font-size:14px;white-space:nowrap}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero h1{font-size:48px}
	.q-grid{grid-template-columns:repeat(2,1fr)}
	.enroll-grid{max-width:960px;grid-template-columns:.9fr 1.1fr;align-items:start}
	section{padding:84px 0}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">Media<span>Buyers</span>.dz</div>
		<div class="seats-tag">Cohorte 3 · 20 places</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<span class="eyebrow">Formation live · Cohorte 3 · 20 places</span>
		<h1>Maîtrisez <span>Meta Ads</span> et vendez en ligne, pour de vrai</h1>
		<p class="lead">Cinq semaines de formation live pour apprendre à lancer, analyser et scaler des campagnes Facebook &amp; Instagram sur le marché algérien. <b>Pas de théorie recyclée :</b> des comptes réels, des budgets réels, des chiffres réels.</p>
		<a class="btn" href="#book">Réserver ma place — 12 000 DA</a>
		<div class="trust">
			<span>🎓 <b>20 places seulement</b></span>
			<span>🎥 <b>Replays inclus à vie</b></span>
			<span>✅ <b>Certificat de fin de formation</b></span>
		</div>
	</div>
</section>

<section>
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Le programme</span>
			<h2>5 modules, du pixel au scaling</h2>
			<p>Chaque module se termine par un exercice pratique corrigé en live.</p>
		</div>
		<div class="modules">
			<div class="module">
				<div class="num">1</div>
				<div>
					<h3>Fondations &amp; Pixel</h3>
					<p>Business Manager propre, pixel, API de conversion, events qui comptent.</p>
				</div>
				<span class="dur">2h</span>
			</div>
			<div class="module">
				<div class="num">2</div>
				<div>
					<h3>Structure de campagnes</h3>
					<p>CBO vs ABO, audiences pour le marché DZ, budgets de test intelligents.</p>
				</div>
				<span class="dur">3h</span>
			</div>
			<div class="module">
				<div class="num">3</div>
				<div>
					<h3>Créatives qui convertissent</h3>
					<p>Hooks vidéo, UGC, angles COD — la vraie variable qui fait ou casse un produit.</p>
				</div>
				<span class="dur">2h30</span>
			</div>
			<div class="module">
				<div class="num">4</div>
				<div>
					<h3>Scaling &amp; budget</h3>
					<p>Scaling vertical et horizontal sans tuer ses performances, gestion du cashflow COD.</p>
				</div>
				<span class="dur">3h</span>
			</div>
			<div class="module">
				<div class="num">5</div>
				<div>
					<h3>Analyse &amp; optimisation</h3>
					<p>Lire ses métriques sans se mentir : CTR, CPM, taux de confirmation, vrai ROAS.</p>
				</div>
				<span class="dur">2h30</span>
			</div>
		</div>
	</div>
</section>

<section class="mentor">
	<div class="wrap">
		<div class="mentor-card">
			<div class="avatar">🎯</div>
			<div>
				<h3>Yacine K.</h3>
				<p class="role">Média buyer senior · votre formateur</p>
				<p>Plus de 4 ans à gérer des budgets publicitaires pour des marques e-commerce algériennes et des clients MENA. Yacine a formé les équipes acquisition de trois agences d'Alger — et il montre ses comptes en live, pas des captures d'écran.</p>
				<div class="mentor-stats">
					<span>+4 ans média buying</span>
					<span>+200M DA gérés</span>
					<span>2 cohortes complètes</span>
				</div>
			</div>
		</div>
	</div>
</section>

<section class="quotes">
	<div class="wrap">
		<div class="q-grid">
			<div class="q-card">
				<div class="stars">★★★★★</div>
				<p>« Avant la formation je brûlais mon budget en tests au hasard. Deux semaines après le module 3, j'ai eu mon premier produit gagnant. Le suivi sur le groupe est réel, pas du marketing. »</p>
				<p class="who"><b>Sofiane B.</b> — vendeur COD, Oran (cohorte 2)</p>
			</div>
			<div class="q-card">
				<div class="stars">★★★★★</div>
				<p>« J'ai suivi trois formations avant celle-là. C'est la seule où le formateur ouvre son gestionnaire de pubs en direct et explique ses décisions chiffre par chiffre. »</p>
				<p class="who"><b>Lina M.</b> — gérante boutique Instagram, Alger (cohorte 1)</p>
			</div>
		</div>
	</div>
</section>

<section class="enroll">
	<div class="wrap">
		<div class="enroll-grid">
			<div class="price-card">
				<span class="eyebrow">Cohorte 3 — début le 15 du mois</span>
				<h2>Formation complète</h2>
				<div class="price">12 000 DA</div>
				<p class="price-note">Paiement à l'inscription · CCP, BaridiMob ou espèces au local</p>
				<ul class="perks">
					<li>✔️ <b>13 heures</b> de live sur 5 semaines</li>
					<li>✔️ <b>Replays à vie</b> + templates de campagnes</li>
					<li>✔️ <b>Groupe privé</b> d'entraide entre cohortes</li>
					<li>✔️ <b>Certificat</b> de fin de formation</li>
				</ul>
			</div>
			<form id="book">
				<h3>Préinscription — Cohorte 3</h3>
				<p class="sub">20 places. On vous appelle sous 24h pour finaliser l'inscription.</p>
				<div class="field">
					<label for="f-nom">Nom complet</label>
					<input type="text" id="f-nom" name="fullname" placeholder="Votre nom et prénom" required>
				</div>
				<div class="field">
					<label for="f-tel">Numéro de téléphone</label>
					<input type="tel" id="f-tel" name="phone" placeholder="05 XX XX XX XX" required>
				</div>
				<div class="field">
					<label for="f-email">Email</label>
					<input type="email" id="f-email" name="email" placeholder="vous@exemple.com" required>
				</div>
				<div class="field">
					<label for="f-niveau">Votre niveau en Meta Ads</label>
					<select id="f-niveau" name="niveau" required>
						<option value="" disabled selected>Choisissez votre niveau</option>
						<option value="debutant">Débutant — je n'ai jamais lancé de campagne</option>
						<option value="intermediaire">Intermédiaire — j'ai déjà dépensé un budget</option>
						<option value="avance">Avancé — je gère des campagnes régulièrement</option>
					</select>
				</div>
				<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<button class="btn" type="submit">Réserver ma place</button>
				<p class="form-note">La préinscription ne vous engage à rien — la place est confirmée après l'appel.</p>
			</form>
		</div>
	</div>
</section>

<footer>
	<div class="wrap">
		<span class="brand">Media<span style="color:var(--accent)">Buyers</span>.dz</span>
		<p>Formation live en ligne · Support en darija et français · contact@mediabuyers.dz</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">12 000 DA</div>
		<div class="c">Cohorte 3 · 20 places</div>
	</div>
	<a class="btn" href="#book">Réserver</a>
</div>

<script>
(function(){
	var form = document.getElementById("book");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = '<div class="success"><h3>Préinscription reçue ✅</h3><p>On vous contacte sous 24h.</p></div>';
	});
})();
</script>

</body>
</html>`,
	},
	"gaming-1": {
		title: "ErgoPro Gaming Chair — Built for the grind",
		lang: "en",
		html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ErgoPro Gaming Chair — Built for the grind</title>
<style>
:root{
	--bg:#0b0d12;
	--panel:#12151d;
	--line:#232838;
	--ink:#e9edf5;
	--muted:#8b93a7;
	--neon:#3dff8b;
	--neon-dim:#22cc6b;
	--red:#ff4d5e;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.55;padding-bottom:86px;
}
.wrap{max-width:1060px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-weight:800;line-height:1.08;letter-spacing:-.02em;text-transform:uppercase}
.eyebrow{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.26em;
	text-transform:uppercase;color:var(--neon);margin-bottom:16px;
}
section{padding:60px 0}
.btn{
	display:inline-block;background:var(--neon);color:#04160b;text-decoration:none;
	font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:15px;
	padding:16px 32px;border:none;border-radius:6px;cursor:pointer;
	box-shadow:0 10px 30px -8px rgba(61,255,139,.45);
	transition:transform .12s ease,background .12s ease;
	clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
}
.btn:hover{transform:translateY(-2px);background:#63ffa4}
/* Header */
header{border-bottom:1px solid var(--line);padding:18px 0}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:15px}
.brand em{color:var(--neon);font-style:normal}
.header-tag{
	font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
	border:1px solid var(--line);color:var(--muted);padding:6px 12px;border-radius:4px;
}
/* Hero */
.hero{padding:54px 0;background:
	radial-gradient(55% 45% at 85% 0%,rgba(61,255,139,.12) 0%,transparent 70%),var(--bg);}
.hero .wrap{display:grid;gap:34px;align-items:center}
.hero h1{font-size:clamp(42px,10vw,80px);margin-bottom:16px}
.hero h1 span{color:var(--neon)}
.hero .sub{color:var(--muted);font-size:17px;max-width:44ch;margin-bottom:26px}
.hero .sub b{color:var(--ink)}
.chair-stage{
	position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);
	background:linear-gradient(160deg,#10131b 0%,#0c2417 60%,#0f3d24 130%);
	min-height:280px;display:flex;align-items:center;justify-content:center;
	clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px);
}
.chair-stage .chair{font-size:140px;filter:drop-shadow(0 22px 22px rgba(0,0,0,.6))}
.chair-stage .tag{
	position:absolute;top:16px;left:16px;font-size:11px;font-weight:800;
	letter-spacing:.2em;text-transform:uppercase;color:var(--neon);
	background:rgba(11,13,18,.7);border:1px solid var(--neon);padding:6px 12px;border-radius:4px;
}
.trust{
	display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:28px;
	padding:14px 18px;border:1px solid var(--line);border-radius:10px;
	background:var(--panel);font-size:13px;color:var(--muted);
}
.trust b{color:var(--ink);font-weight:600}
/* Features */
.section-head{text-align:center;max-width:58ch;margin:0 auto 36px}
.section-head h2{font-size:30px;margin-bottom:10px}
.section-head p{color:var(--muted);text-transform:none}
.f-grid{display:grid;gap:16px}
.f-card{
	background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:24px 22px;
	clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
}
.f-card .icon{
	width:48px;height:48px;border-radius:10px;background:rgba(61,255,139,.1);
	border:1px solid rgba(61,255,139,.35);display:flex;align-items:center;justify-content:center;
	font-size:24px;margin-bottom:14px;
}
.f-card h3{font-size:16px;margin-bottom:6px}
.f-card p{font-size:14px;color:var(--muted)}
/* Comparison */
.vs{padding-top:0}
.table-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
.vs table{width:100%;min-width:480px;border-collapse:collapse;font-size:14px;background:var(--panel)}
.vs th,.vs td{padding:14px 18px;text-align:left;border-bottom:1px solid var(--line)}
.vs tr:last-child td{border-bottom:none}
.vs th{
	font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);
	background:#0e1118;
}
.vs th.hl{color:var(--neon)}
.vs td.yes{color:var(--neon);font-weight:700}
.vs td.no{color:var(--red);font-weight:700}
/* Offer + form */
.offer{border-top:1px solid var(--line);background:
	radial-gradient(50% 40% at 50% 0%,rgba(61,255,139,.1) 0%,transparent 70%),var(--bg);}
.offer-grid{display:grid;gap:26px;max-width:640px;margin:0 auto}
.price-card{
	background:var(--panel);border:1px solid var(--line);border-radius:12px;
	padding:30px 26px;text-align:center;
	clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
}
.price-card h2{font-size:24px;margin-bottom:16px}
.price-row{display:flex;justify-content:center;align-items:baseline;gap:14px;margin-bottom:10px}
.price{font-size:44px;font-weight:800;letter-spacing:-.02em;color:var(--neon)}
.compare{font-size:18px;color:var(--muted);text-decoration:line-through}
.save-chip{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
	color:var(--neon);border:1px solid var(--neon);padding:6px 14px;border-radius:999px;
}
form{
	background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:28px 24px;
}
form h3{font-size:19px;margin-bottom:4px}
form .sub{font-size:13px;color:var(--muted);margin-bottom:22px;text-transform:none}
.field{margin-bottom:16px}
.field label,.group-label{
	display:block;font-size:11px;font-weight:800;letter-spacing:.16em;
	text-transform:uppercase;color:var(--muted);margin-bottom:8px;
}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:8px;
	border:1px solid var(--line);background:#0e1118;color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--neon);border-color:var(--neon)}
.pills{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.pills input{position:absolute;opacity:0;pointer-events:none}
.pills label{
	padding:11px 20px;border:1px solid var(--line);border-radius:6px;cursor:pointer;
	font-size:14px;font-weight:700;color:var(--muted);transition:all .12s ease;
	display:flex;align-items:center;gap:8px;
}
.pills label .dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid var(--line)}
.pills label:hover{border-color:var(--neon);color:var(--ink)}
.pills input:checked + label{border-color:var(--neon);color:var(--ink);box-shadow:0 0 0 1px var(--neon)}
form .btn{width:100%}
.form-note{font-size:12px;color:var(--muted);text-align:center;margin-top:12px;text-transform:none}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:22px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{border-top:1px solid var(--line);padding:34px 0 46px;text-align:center}
footer .brand{display:block;margin-bottom:8px}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(11,13,18,.93);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-size:20px;font-weight:800;color:var(--neon)}
.sticky-cta .c{font-size:12px;color:var(--muted);text-decoration:line-through}
.sticky-cta .btn{padding:12px 22px;font-size:13px}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.05fr .95fr}
	.f-grid{grid-template-columns:repeat(2,1fr)}
	section{padding:86px 0}
	.chair-stage{min-height:380px}
	.chair-stage .chair{font-size:200px}
}
@media(min-width:980px){
	.f-grid{grid-template-columns:repeat(4,1fr)}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">Ergo<em>Pro</em></div>
		<div class="header-tag">Pro series</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">ErgoPro · Pro Series</span>
			<h1>Sit like you <span>mean it</span></h1>
			<p class="sub"><b>12-hour sessions shouldn't wreck your back.</b> The ErgoPro pairs adjustable lumbar support with cold-cure foam and a steel base — built for ranked grinds, remote work and everything between.</p>
			<a class="btn" href="#commander">Order now — Cash on delivery</a>
			<div class="trust">
				<span>🚚 <b>Delivery — 58 wilayas</b></span>
				<span>💵 <b>Cash on delivery</b></span>
				<span>↩️ <b>Easy returns</b></span>
			</div>
		</div>
		<div class="chair-stage">
			<span class="tag">2-year warranty</span>
			<div class="chair">🪑</div>
		</div>
	</div>
</section>

<section>
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Engineered comfort</span>
			<h2>Every hour, supported</h2>
			<p>Four upgrades that separate a real ergonomic chair from a padded seat with RGB stickers.</p>
		</div>
		<div class="f-grid">
			<div class="f-card">
				<div class="icon">🦴</div>
				<h3>Lumbar support</h3>
				<p>Adjustable depth and height — your lower back stays aligned even in hour ten.</p>
			</div>
			<div class="f-card">
				<div class="icon">🦾</div>
				<h3>4D armrests</h3>
				<p>Height, depth, angle and width. Lock your elbows at the exact position your aim needs.</p>
			</div>
			<div class="f-card">
				<div class="icon">😴</div>
				<h3>150° recline</h3>
				<p>Lean back between matches — the frame locks safely at any angle up to 150 degrees.</p>
			</div>
			<div class="f-card">
				<div class="icon">🛡️</div>
				<h3>Steel base</h3>
				<p>Five-star reinforced steel base rated 150 kg, with smooth-roll PU casters.</p>
			</div>
		</div>
	</div>
</section>

<section class="vs">
	<div class="wrap">
		<div class="section-head">
			<span class="eyebrow">Side by side</span>
			<h2>ErgoPro vs a standard chair</h2>
		</div>
		<div class="table-scroll">
			<table>
				<tr>
					<th>Feature</th>
					<th class="hl">ErgoPro</th>
					<th>Standard chair</th>
				</tr>
				<tr>
					<td>Adjustable lumbar support</td>
					<td class="yes">✓ Depth + height</td>
					<td class="no">✗ Fixed cushion</td>
				</tr>
				<tr>
					<td>4D armrests</td>
					<td class="yes">✓ Four axes</td>
					<td class="no">✗ Fixed plastic</td>
				</tr>
				<tr>
					<td>Recline range</td>
					<td class="yes">✓ Up to 150°</td>
					<td class="no">✗ 110° max</td>
				</tr>
				<tr>
					<td>Base</td>
					<td class="yes">✓ Reinforced steel</td>
					<td class="no">✗ Nylon, cracks</td>
				</tr>
				<tr>
					<td>Foam</td>
					<td class="yes">✓ Cold-cure, keeps shape</td>
					<td class="no">✗ Flattens in months</td>
				</tr>
				<tr>
					<td>Warranty</td>
					<td class="yes">✓ 2 years</td>
					<td class="no">✗ None</td>
				</tr>
			</table>
		</div>
	</div>
</section>

<section class="offer">
	<div class="wrap">
		<div class="offer-grid">
			<div class="price-card">
				<span class="eyebrow">Launch offer</span>
				<h2>ErgoPro Gaming Chair</h2>
				<div class="price-row">
					<span class="price">34 900 DA</span>
					<span class="compare">42 000 DA</span>
				</div>
				<span class="save-chip">Save 7 100 DA</span>
			</div>
			<form id="commander">
				<h3>Order your ErgoPro</h3>
				<p class="sub">Pay cash on delivery. We call to confirm before shipping — assembly guide included.</p>
				<span class="group-label">Pick your color</span>
				<div class="pills">
					<input type="radio" id="col-black" name="color" value="Black" checked>
					<label for="col-black"><span class="dot" style="background:#191c24"></span>Black</label>
					<input type="radio" id="col-red" name="color" value="Red">
					<label for="col-red"><span class="dot" style="background:#c8323f"></span>Red</label>
					<input type="radio" id="col-white" name="color" value="White">
					<label for="col-white"><span class="dot" style="background:#e8e8ee"></span>White</label>
				</div>
				<div class="field">
					<label for="f-name">Full name</label>
					<input type="text" id="f-name" name="fullname" placeholder="Your full name" required>
				</div>
				<div class="field">
					<label for="f-phone">Phone</label>
					<input type="tel" id="f-phone" name="phone" placeholder="05 XX XX XX XX" required>
				</div>
				<div class="field">
					<label for="f-wilaya">Wilaya</label>
					<select id="f-wilaya" name="wilaya" required>
						<option value="" disabled selected>Select your wilaya</option>
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
					<label for="f-commune">Commune</label>
					<input type="text" id="f-commune" name="commune" placeholder="Your commune" required>
				</div>
				<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<button class="btn" type="submit">Confirm order — Cash on delivery</button>
				<p class="form-note">No prepayment. You inspect the box, then you pay the courier.</p>
			</form>
		</div>
	</div>
</section>

<footer>
	<div class="wrap">
		<span class="brand">Ergo<em>Pro</em></span>
		<p>Delivery across 58 wilayas · 2-year warranty · support@ergopro.dz</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">34 900 DA</div>
		<div class="c">42 000 DA</div>
	</div>
	<a class="btn" href="#commander">Order</a>
</div>

<script>
(function(){
	var form = document.getElementById("commander");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = "<div class='success'><h3>Order received ✅</h3><p>We'll call you to confirm.</p></div>";
	});
})();
</script>

</body>
</html>`,
	},
};
