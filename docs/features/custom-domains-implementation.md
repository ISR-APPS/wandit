# Custom Domains — Journal d'implémentation et décisions

**Prototype initial :** 2026-07-04 → 2026-07-05 · **Direction actuelle mise à jour :** 2026-07-24
**Spec de référence :** `docs/features/custom-domains.md`

Ce document sépare volontairement l'état actuel des notes historiques. Les décisions de la section suivante font foi.

## 1. Direction actuelle

- **Registrar : Name.com CORE v1.** Le nouvel adapter utilise l'API CORE, son sandbox fonctionnel et l'authentification Basic username + API token.
- **Paiement direct, jamais en crédits Wandit.** Achat initial et renouvellement passent par un checkout géré par un futur `PaymentsModule`.
- **Fail-closed obligatoire.** Tant que `PaymentsModule`, la vérification de signature webhook et la réconciliation ne sont pas branchés, aucun endpoint d'achat ou de renouvellement ne peut muter le registrar.
- **Le webhook vérifié est l'autorité.** Le retour navigateur « success » ne déclenche rien. Seul un événement signé, associé au bon ordre, au bon montant et à la bonne devise, enregistré de façon idempotente, peut lancer le job de fulfillment.
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

## 3. Frontière paiement

Le domaine ne doit pas réimplémenter un prestataire de paiement.

DomainsModule possède l'ordre métier domaine : nom, registrant, quote, user,
project et état de fulfillment. `PaymentsModule` reçoit seulement une référence
opaque, le montant et la devise; il ne doit jamais importer le repository domaine.

`PaymentsModule` doit posséder :

- création du checkout et état durable de la tentative de paiement;
- montant, devise, référence métier et expiration;
- vérification cryptographique des webhooks;
- déduplication par event ID et idempotency key;
- états payé/échoué/expiré/remboursé;
- réconciliation et remboursement vers le moyen de paiement d'origine.

### Achat

1. Recherche Name.com en lecture seule avec estimation d'inscription en USD non verrouillée.
2. Recheck et création d'une quote courte durée.
3. Checkout direct.
4. Webhook vérifié et enregistré.
5. Seulement ensuite : `domain-purchase`.
6. Recheck wholesale, enregistrement Name.com avec idempotency key stable, DNS, Cloudflare, activation.

### Renouvellement

1. Détection d'échéance ou action « Renew now ».
2. Quote de renouvellement courante.
3. Paiement autorisé et confirmé.
4. Webhook vérifié.
5. Seulement ensuite : appel Name.com `renew`, puis persistance de la nouvelle expiration.

Si le paiement est confirmé mais que le fulfillment échoue définitivement, la compensation passe par `PaymentsModule`. Aucun grant dans `credit_ledger`.

## 4. État de sécurité

| Surface | État attendu |
|---|---|
| Recherche Name.com | Lecture seule, autorisée avec credentials sandbox |
| BYO domain | Indépendant du registrar et du paiement |
| Achat | Désactivé/fail-closed jusqu'au webhook vérifié |
| Renouvellement manuel | Désactivé/fail-closed jusqu'au webhook vérifié |
| Autorenew | Intention locale uniquement jusqu'au paiement off-session validé |
| Production Name.com | Interdite aux tests locaux et automatiques |

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

1. Le binding Name.com serveur/worker et la compatibilité read-only des anciennes lignes OpenProvider sont en place.
2. Vérifier l'adapter contre le sandbox : availability, register idempotent, contacts, DNS, forwarding, lock/auth code, renewal et erreurs retryables.
3. Construire `PaymentsModule` : checkout, ordre durable, webhook signé, matching montant/devise, déduplication, remboursement et réconciliation.
4. Brancher l'achat et le renouvellement au webhook; prouver par tests qu'aucune mutation registrar n'arrive avant paiement confirmé.
5. Adapter l'UI : checkout externe, retour cancel/success, écran d'état d'ordre et polling.
6. Ajouter suivi de vérification contact, alertes de solde et procédures support.
7. Valider Cloudflare + publishing-serving de bout en bout.
8. Effectuer un smoke test production contrôlé seulement après tous les gates précédents.

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
