# Custom Domains — Journal d'implémentation & décisions

**Date :** 2026-07-04 → 2026-07-05 · **Branche :** `feat/custom-domains` (worktree `ISR-AI-domains`, tout **non-commité**)
**Spec technique :** `docs/features/custom-domains.md` (anglais) · **Linear :** ISRECOM-42 (ops) / ISRECOM-43 (infra) / ISRECOM-44 (UI)
Ce document résume, en français, tout le travail réalisé et toutes les décisions discutées avec Zack. Il complète le spec, il ne le remplace pas.

---

## 1. C'est quoi cette feature, en une phrase

Un utilisateur Wandit choisit un nom de domaine (ex. `boutique-maya.com`), l'achète directement dans l'app, et son landing page généré est servi dessus automatiquement — DNS, certificat HTTPS, configuration : tout est fait par nous, il ne touche à rien.

## 2. Le modèle économique (décidé)

- **Wandit est reseller** : le client nous paie, et nous achetons le domaine chez un grossiste (**Openprovider**) depuis un **portefeuille prépayé**. La différence = notre marge, sur l'enregistrement ET chaque renouvellement annuel.
- **Décision Zack (2026-07-05) — paiement direct, PAS de crédits** : le client paiera le domaine par carte via Stripe (checkout séparé), contrairement au spec initial qui prévoyait un paiement en crédits. ⚠️ Le code actuel consomme encore des crédits via un port (`CREDITS_PORT`) — c'est volontairement la partie "stop au paiement" : au moment de l'intégration Stripe, ce port sera remplacé par le flow checkout → webhook → enregistrement. Rien d'autre ne change.
- **Devise du compte Openprovider : USD** (alignée sur le code : plafonds `wholesaleCeilingUsd`, prix spec en dollars, un seul taux USD→DZD à gérer).
- **Le client est propriétaire légal du domaine** (registrant of record), WHOIS privacy activé gratuitement, transfert sortant toujours possible (code d'autorisation + verrou ICANN 60 jours affiché).
- Le portefeuille Openprovider est notre **stock** : s'il est vide, les ventes échouent (le client est auto-remboursé par le code, mais c'est une vente perdue). Au go-live : alertes de solde bas + fonds de roulement (~10 domaines d'avance).

## 3. Ce qui a été construit (tout est fonctionnel, testé, non-commité)

### Base de données (`packages/db`)
Table `domains` (migration `0002`, appliquée en local) : cycle de vie `registering → configuring → active → failed / expired / transferred_out`, snapshot du registrant et du prix au moment de l'achat, IDs provider/Cloudflare, contraintes d'intégrité (nom unique, lowercase, un seul domaine "primary" par projet).

### Contrats partagés (`packages/contracts/src/v1/domains.ts`)
- Toutes les routes API + schémas de validation (Zod) : noms de domaine stricts (anti-injection), téléphone E.164, adresse avec wilaya, blocklist (`wandit.app`, `wandit.dev`, `wandit-preview`).
- **Catalogue TLD en code** : 6 TLDs de lancement (`.com .net .shop .store .online .site`) avec 3 chiffres chacun — prix de vente enregistrement, prix de vente renouvellement, **plafond wholesale** (le "prix d'alarme" qui bloque les domaines premium). Chiffres actuels = **PLACEHOLDERS** à calibrer avec les vrais prix du panel Openprovider.

### API serveur (`apps/server/src/modules/domains`)
- 9 endpoints : recherche (avec prix), liste par projet, achat, connexion d'un domaine existant (BYO), vérification, renouvellement, auto-renew, primary, transfer-unlock, détachement.
- **Port registrar swappable** : Openprovider n'est qu'une implémentation derrière une interface (`DomainProvider`). Passer à name.com ou autre = 1 fichier + 1 ligne de binding, rien d'autre ne bouge.
- Client **Cloudflare for SaaS** (certificats HTTPS automatiques pour les domaines clients) + écriture des pointeurs **KV** (`domain:{host}` → quel site afficher) — c'est la couture avec la future slice publishing-serving.
- Sécurité : validation systématique avant tout appel externe, ownership vérifié en SQL (404 jamais 403), rate limiting sur toutes les surfaces sensibles, aucune fuite de secrets/prix wholesale/erreurs brutes vers le client, idempotence sur tout ce qui touche l'argent.

### Worker (`apps/worker`)
4 jobs sur la queue `domains` :
- **domain-purchase** : re-vérifie le prix wholesale du domaine précis (anti-premium) → enregistre → configure le DNS (www CNAME + redirection apex) → crée le custom hostname Cloudflare. Chaque étape est idempotente (un retry ne ré-enregistre/ré-facture jamais) avec retries automatiques ; échec définitif = remboursement automatique garanti.
- **domain-configure** : surveille l'émission du certificat SSL, active le domaine quand tout est prêt.
- **domain-renewals** (quotidien) : renouvelle les domaines à ≤30 jours de l'expiration.
- **domain-sync** (hebdomadaire) : réconcilie les statuts avec Openprovider.

### UI (`apps/web/src/features/domains`)
Dans **Settings → section Domains** du workspace :
- **Modal d'achat** : recherche → disponibilités par TLD avec prix → formulaire registrant (prérempli) → confirmation → progression en temps réel → URL live.
- **Flow BYO** : "j'ai déjà un domaine" → table des enregistrements DNS à copier → bouton Vérifier.
- **Liste** : statuts, primary, auto-renew, renouveler, transfer-out (code d'autorisation), détacher.
- i18n complet **en / fr / ar** (RTL ok).

## 4. Comment ça a été construit (méthode)

Orchestration multi-agents : **Fable** (planning, arbitrages, review finale) · **Codex GPT-5.5** (discovery des conventions du repo + implémentation backend en 2 phases + corrections) · **Opus** (UI).
Qualité : après l'implémentation, review personnelle du chemin critique argent par Fable (5 findings) + **review adversariale de 85 agents** sur 7 dimensions (33 findings confirmés sur 39, 6 réfutés). **Les 38 findings ont tous été corrigés et verrouillés par des tests.** Exemples de bugs attrapés : renouvellement gratuit possible après remboursement, remboursement perdu en cas de panne au mauvais moment, blocage premium inopérant à l'achat, crash du worker au démarrage, activation avant émission du certificat.
État final : **62 tests serveur + 12 tests worker verts, typecheck repo vert, API saine.**

## 5. État des opérations (où on en est côté comptes)

| Étape | Statut |
|---|---|
| Compte Openprovider **live** (RID 321973, USD) | ✅ Créé — 2FA à activer si pas fait |
| Compte Openprovider **sandbox** | ❌ **HS côté Openprovider** — leur support confirme : "sandbox en panne, une nouvelle version arrive" (pas de date) |
| **Plan B validé** : tests lecture-seule sur l'API live (login, disponibilité, prix — gratuits, sans risque, solde 0 $ = filet de sécurité) | ⏳ En attente des identifiants live dans `apps/server/.env` de la worktree |
| Screenshot des prix réels (menu Prices) pour calibrer le catalogue | ⏳ À envoyer par Zack |
| Financement du portefeuille (min 20 $, carte étrangère de Zack — pas de CIB nécessaire côté Wandit) | Plus tard, juste avant le smoke test réel |
| **Cloudflare** : zone `wandit.app` sur le compte ? → Custom Hostnames à activer, namespace KV à créer, token API (SSL:Edit + Zone:Read + KV:Edit) + Zone ID | ⏳ À faire par Zack (~10 min) |

## 6. Ce qu'il reste à faire (dans l'ordre)

1. **[Zack]** Identifiants Openprovider live dans le `.env` de la worktree → **[Agent]** validation lecture-seule des appels API réels + correction des ~10 marqueurs `// VERIFY` du client Openprovider.
2. **[Zack]** Screenshot des prix → **[Agent]** proposition de calibrage du catalogue (wholesale → prix de vente → plafond) → validation Zack → écriture dans le code.
3. **[Zack]** Les 4 points Cloudflare → **[Agent]** validation custom hostname + KV de bout en bout.
4. **[Zack]** Review du diff complet dans l'éditeur, puis commit/PR quand satisfait.
5. Financement 20 $ → **smoke test réel** : 1 vrai domaine pas cher (~2-3 $) acheté de bout en bout.
6. **Intégration paiement** (chantier séparé, décision actée : Stripe checkout direct) — remplace le port crédits.
7. **Publishing-serving** (`apps/edge`) — la slice qui affichera réellement les sites générés sur les domaines (la couture KV est prête de notre côté).
8. Quand le nouveau sandbox Openprovider sort : e2e complet dessus par acquit de conscience.

## 7. Points de vigilance / dettes assumées

- **Le worker importe du code de `apps/server` en chemins relatifs** (`../../server/src/...`) — ça marche (tsx + tsdown), mais c'est la première entorse aux frontières entre apps. Alternative propre si ça dérange : extraire un package partagé. **Décision à prendre par Zack à la review.**
- Le spec dit encore "payé en crédits" — à mettre à jour quand l'intégration Stripe démarrera (décision paiement direct actée ici).
- `vitest` ajouté en devDependency du worker (version déjà présente dans le repo, aucune dépendance externe nouvelle).
- Les prix du catalogue sont des placeholders — **ne pas lancer sans calibrage**.
- Sandbox Openprovider indisponible → les 3 marqueurs VERIFY restants (register/renew/authcode) ne seront validés qu'au smoke test réel.

## 8. Références pratiques

- **Worktree :** `/Users/mac/Desktop/work/projects/ISR-AI-domains` · serveurs dev : API **:3100**, web **:3101** (lancés en processus détachés ; logs `/tmp/wandit-domains-api.log` et `/tmp/wandit-domains-web.log`)
- **Google OAuth (Console) :** origins `http://localhost:3100` + `http://localhost:3101`, redirect `http://localhost:3100/api/auth/callback/google`
- **Env attendues** (`packages/env/src/server.ts`, optionnelles au boot) : `OPENPROVIDER_API_URL`, `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID_WANDIT_APP`, `CLOUDFLARE_KV_NAMESPACE_ID`, `DOMAINS_FALLBACK_ORIGIN` (défaut `customers.wandit.app`) — et `QUEUE_ENABLED=true` + Redis + worker pour le pipeline d'achat.
- **API Openprovider :** live `https://api.openprovider.eu` · sandbox (HS) `http://api.sandbox.openprovider.nl:8480` · panel live `cp.openprovider.eu` · panel sandbox `cp.sandbox.openprovider.nl`
- **Fichiers clés :** catalogue TLD → `packages/contracts/src/v1/domains.ts` · client registrar → `apps/server/src/modules/domains/infrastructure/openprovider/openprovider.provider.ts` · jobs → `apps/worker/src/processors/domains.processor.ts` · UI → `apps/web/src/features/domains/`
