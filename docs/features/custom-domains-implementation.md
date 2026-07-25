# Custom Domains — Journal d'implémentation et décisions

**Prototype initial :** 2026-07-04 → 2026-07-05 · **Direction actuelle mise à jour :** 2026-07-25 (port Name.com sur l'infra paiements Stripe)
**Spec de référence :** `docs/features/custom-domains.md`

Ce document sépare volontairement l'état actuel des notes historiques. Les décisions de la section suivante font foi.

## 1. Direction actuelle

- **Registrar : Name.com CORE v1.** Le nouvel adapter utilise l'API CORE, son sandbox fonctionnel et l'authentification Basic username + API token.
- **Paiement direct, jamais en crédits Wandit.** L'achat passe par le module orders existant : `POST /api/v1/orders/domain` → `payment_orders` → Stripe Checkout → réconciliation/webhook → `DomainRegistrationFulfillment`.
- **Le paiement vérifié est l'autorité.** Le retour navigateur « success » ne déclenche rien par lui-même : la page appelle `reconcile-session`, qui relit la session chez Stripe et vérifie montant/devise/customer/mode/purpose avant de marquer l'ordre payé. Les webhooks signés couvrent les paiements asynchrones, remboursements et litiges.
- **Prix retail sur le fil, wholesale côté serveur.** La recherche expose le prix retail (`DOMAIN_REGISTRATION_USD_CENTS`); la quote wholesale Name.com reste serveur et sert de garde-fou (plafond par TLD < retail, vérifié par test de contrat, re-vérifié avant Stripe et avant l'achat registrar).
- **Le client reste registrant légal.** Ses coordonnées sont envoyées à Name.com; le produit doit suivre et expliquer la vérification de contact.
- **Wandit pilote les renouvellements.** L'autorenew Name.com est désactivé. Le flag local exprime une intention, mais ne permet jamais de renouveler avant paiement confirmé.
- **Premium et aftermarket sont exclus du v1.** L'absence de prix ou tout dépassement du plafond wholesale bloque l'achat.

## 2. Architecture conservée

Le prototype a fourni des briques utiles qui restent valables :

- table `domains` et cycle `registering → configuring → active → failed | expired | transferred_out`;
- validation stricte des domaines et du registrant;
- port `DomainProvider`, aujourd'hui implémenté par `NamecomProvider`;
- queue `domains` et jobs purchase/configure/sync;
- configuration DNS gérée, redirection apex et transfert sortant;
- Cloudflare for SaaS pour certificat et custom hostname;
- pointeur KV `domain:{host}` pour la couture avec publishing-serving;
- UI recherche/BYO/lifecycle et traductions en/fr/ar.

`packages/jobs` reste registrar-agnostique. Le serveur et le worker doivent toutefois utiliser le même binding Name.com.

## 3. Frontière paiement (implémentée)

Le module orders/billing possède `payment_orders`, les sessions Stripe Checkout, la vérification cryptographique des webhooks (inbox durable dédupliquée), les états payé/échoué/expiré/remboursé et les remboursements durables (queue `order-refunds`). DomainsModule fournit `preparePurchase` (disponibilité + quote wholesale plafonnée) et `DomainRegistrationFulfillment` crée la ligne domaine sous advisory lock puis enfile `domain-purchase`.

### Achat

1. Recherche Name.com en lecture seule; prix retail exposé pour les résultats sûrs.
2. `POST /api/v1/orders/domain` : recheck disponibilité/plafond, garde de marge (wholesale × 100 < retail cents sinon rejet avant Stripe), snapshot de prix gelé sur l'ordre.
3. Redirect Stripe Checkout (`mode: payment`, metadata `{orderId, purpose: "order"}`).
4. Retour `/billing/success` → `reconcile-session` (ou webhook) → ordre `paid` → `fulfilling`.
5. Seulement ensuite : `domain-purchase` (`jobId: order-fulfill-{orderId}`).
6. Fence sur l'ordre, recheck wholesale, enregistrement Name.com avec `X-Idempotency-Key: domain-purchase:{domainRowId}` (replay systématique, jamais d'adoption par simple existence), persistance du reçu registrar, DNS + forwarding apex, Cloudflare (avec push des enregistrements de validation), activation, ordre `fulfilled`.

Si le paiement est confirmé mais que le fulfillment échoue définitivement, le remboursement Stripe est enfilé **dans le verrou ordre+domaine, avant toute écriture terminale**. Aucun grant dans `credit_ledger`.

### Renouvellement

Non câblé. `auto_renew` est à false par défaut, l'API refuse de l'activer, et le cron quotidien ne fait qu'enregistrer des avis d'expiration (T-30). Le renouvellement payé exigera un kind `domain_renewal` sur `payment_orders` — et l'ajout préalable d'une idempotency key sur `NamecomProvider.renew()`.

## 4. État de sécurité

| Surface | État actuel |
|---|---|
| Recherche Name.com | Lecture seule, autorisée avec credentials sandbox |
| BYO domain | Indépendant du registrar et du paiement |
| Achat | Actif via orders/Stripe; fail-closed sans quote sûre ou queue désactivée |
| Renouvellement | Inexistant : avis d'expiration uniquement |
| Autorenew | Refusé à l'activation tant que le renouvellement payé n'existe pas |
| Production Name.com | Interdite aux tests locaux et automatiques (garde `-test` bidirectionnelle) |

Une disponibilité ou une quote ne réserve pas le domaine. Le worker doit toujours rechecker avant l'achat payé.

## 5. Opérations Name.com

| Élément | Valeur |
|---|---|
| Sandbox | `https://api.dev.name.com` |
| Production | `https://api.name.com` |
| Auth | HTTP Basic : username + API token |
| Username sandbox | username suffixé `-test` |
| Inventaire v1 | `purchaseType=registration` uniquement |
| Idempotence achat registrar | `X-Idempotency-Key` dérivée de l'ordre/domaine durable |

Variables serveur :

- `NAMECOM_ENVIRONMENT=sandbox|production`
- `NAMECOM_USERNAME`
- `NAMECOM_API_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID_WANDIT_APP`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `DOMAINS_FALLBACK_ORIGIN`
- `QUEUE_ENABLED=true` + Redis pour le fulfillment asynchrone

Le compte registrar doit être financé et monitoré. Les prix publics doivent couvrir le prix Name.com courant, le renouvellement, la privacy éventuelle, la fiscalité applicable et la marge.

## 6. Prochaines étapes, dans l'ordre

1. ~~Binding Name.com serveur/worker + compat read-only OpenProvider~~ — fait.
2. ~~Brancher l'achat sur orders/Stripe (checkout, réconciliation, refund-avant-terminal)~~ — fait sur cette branche.
3. Vérifier l'adapter contre le sandbox : availability, register idempotent, contacts, DNS, forwarding (l'apex doit arriver avec `host: ""`), lock/auth code et erreurs retryables.
4. Smoke test local complet : recherche → checkout test → `paid → fulfilling → fulfilled`, `registering → configuring → active`, reçu registrar persisté; puis chemin d'échec → refund dans `order-refunds` avant l'écriture terminale.
5. Calibrer le catalogue retail sur le coût Name.com complet (privacy, fiscalité, marge) — plafonds actuels = 80 % du retail.
6. Ajouter suivi de vérification contact (ICANN), alertes de solde registrar (402) et procédures support.
7. Valider Cloudflare + publishing-serving de bout en bout (le pointeur KV n'a pas encore de consommateur).
8. Renouvellement payé : kind `domain_renewal`, idempotency key sur `renew()`, UI « Renew now ».
9. Smoke test production contrôlé seulement après tous les gates précédents.

## 7. Points de vigilance

- Le worker importe encore des éléments de `apps/server` par chemins relatifs; extraire un package partagé reste la frontière propre à terme.
- Le prix de découverte Name.com n'inclut pas forcément privacy et TVA. La marge doit être vérifiée sur le coût complet.
- Le statut de transfert et les rejets registry bénéficient de webhooks Name.com; le polling seul ne couvre pas tout.
- Les contacts non vérifiés peuvent provoquer un lock et une interruption de résolution.
- Les migrations historiques OpenProvider ne doivent pas être réécrites; une migration forward adapte les contraintes.

## 8. Notes historiques — ne décrivent plus le produit courant

Le prototype de juillet 2026 utilisait OpenProvider, un portefeuille registrar prépayé et le `credit_ledger` Wandit pour simuler achat, renouvellement et remboursement. Le sandbox OpenProvider était indisponible et plusieurs payloads restaient à vérifier. Ces limites ont motivé le passage à Name.com CORE v1.

Les références suivantes sont donc historiques uniquement :

- `OPENPROVIDER_API_URL`, `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`;
- `OpenproviderProvider`;
- prix exprimés en crédits;
- consommation/grant de crédits pour achat ou renouvellement;
- promesse « changer de registrar = un fichier et une ligne ».

Les détails techniques actuels sont dans `docs/features/custom-domains.md`.
