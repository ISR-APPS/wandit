# Custom Domains — Journal d'implémentation et décisions

**Prototype initial :** 2026-07-04 → 2026-07-05 · **Architecture actuelle mise à jour :** 2026-08-17 (Name.com + Stripe + Trigger.dev v4 + zone Cloudflare pour l'apex)
**Spécification de référence :** `docs/features/custom-domains.md`

Ce document sépare volontairement l'état actuel des notes historiques. Les décisions des sections 1 à 9 font foi; la section 10 est exclusivement historique.

## 1. Direction actuelle

- **Registrar : Name.com CORE v1.** L'adapter utilise l'API CORE, son sandbox fonctionnel et l'authentification Basic username + API token derrière le port `DomainProvider`.
- **Paiement direct, jamais en crédits Wandit.** L'achat passe par `POST /api/v1/orders/domain` → `payment_orders` → Stripe Checkout → réconciliation/webhook → `DomainRegistrationFulfillment` → tâche Trigger `domain-purchase`.
- **Le paiement vérifié est l'autorité.** Le retour navigateur « success » ne déclenche rien par lui-même : `reconcile-session` relit la session chez Stripe et vérifie montant/devise/customer/mode/purpose. Les webhooks signés couvrent les paiements asynchrones, remboursements et litiges.
- **Prix retail sur le fil, wholesale côté serveur.** La recherche expose la quote wholesale Name.com arrondie aux cents plus une marge exacte de 2 USD; la quote wholesale reste privée et sert de garde-fou avant Stripe puis juste avant l'achat registrar.
- **Le client reste registrant légal.** Ses coordonnées sont envoyées à Name.com; le produit doit suivre et expliquer la vérification de contact.
- **Wandit pilote les renouvellements.** L'autorenew Name.com est désactivé. Le flag local exprime une intention mais aucun renouvellement n'est permis sans paiement confirmé.
- **Premium, aftermarket, `.dz`, IDN et transferts entrants sont exclus du v1.** Une quote absente ou supérieure au plafond bloque l'achat.
- **Hôte canonique et apex.** `www.{domain}` sert le site (CNAME vers `customers.wandit.app`). Pour les domaines achetés, l'apex `https://{domain}` est aussi servi par Cloudflare : `ApexZoneStep` héberge le DNS du domaine dans une zone Cloudflare de **notre** compte (`CLOUDFLARE_ACCOUNT_ID`), y écrit des CNAME DNS-only (`{domain}` et `www.{domain}` → origine de repli) plus les TXT de propriété des deux hostnames, crée un second custom hostname pour le nom nu, puis délègue les nameservers Name.com à la zone. `apps/edge` redirige ensuite l'apex vers `https://www.{domain}` en 301. Le forwarding URL Name.com reste écrit en premier comme repli (et reste le mécanisme apex quand `DOMAINS_APEX_ZONE_ENABLED=false`) : son hôte n'a pas de certificat TLS. Un ANAME/forwarding côté registrar ne peut pas fonctionner sur le plan Free : le vérificateur Cloudflare for SaaS répond `Zone does not have apex proxying entitlement and custom hostname does not CNAME to zone.` (tentative annulée, PR #173/#176); seul un CNAME apex DNS-only dans une zone Cloudflare est vu comme un CNAME par le vérificateur.

## 2. Architecture Trigger.dev actuelle

La base de données reste la source de vérité produit. Les états et champs de fulfillment/remboursement de `payment_orders`, les états/erreurs de `domains`, ainsi que le curseur privé de configuration pilotent l'UI et la reprise. Les runs, handles, tags et métadonnées Trigger servent uniquement à l'exploitation.

Les fichiers de tâches sont des wrappers de composition fins : payload strict, assertion de la configuration propre à la tâche, un pool DB local au run, adaptation de `wait.until`/`wait.for`, logs/métadonnées, appel d'un runner indépendant, puis fermeture du pool dans `finally`. Ils ne contiennent aucune logique Name.com, Cloudflare, Stripe ou de machine d'état.

Les étapes métier sont testables indépendamment, sans NestJS ni SDK Trigger, via des interfaces structurelles étroites :

- `DomainFulfillmentStateService` : association ordre/domaine, branches de replay, transition `paid → fulfilling` et fence pré-dépense;
- `DomainRegistrationStep` : disponibilité/plafond, registrant, appel Name.com idempotent et persistance CAS du reçu;
- `PurchasedDomainDnsStep` : CNAME `www`, forwarding apex (repli) et marqueur DNS — inchangé;
- `CustomHostnameConfigurationStep` : hostname Cloudflare `www`, challenges et propagation TXT;
- `ApexZoneStep` (best-effort, ne lève jamais; désactivable par `DOMAINS_APEX_ZONE_ENABLED=false`) : zone Cloudflare dans notre compte (adoptée par nom si elle existe), hostname Cloudflare de l'apex (adopté par nom), CNAME DNS-only apex + www et TXT de propriété dans la zone, marqueur `dns.zoneDelegated` puis `setNameservers` Name.com, activation check, marqueur `dns.apexConfigured` / erreur `dns.apexError`; écrit ses clés `dns` par fusion jsonb (`DomainsRepository.mergeDnsIfStatus`, jamais de remplacement), rejoué avant chaque sonde du `DomainConfigurationRunner` (configuration tant que le marqueur manque, puis sondage de la zone : `pending` → activation check, `active` → un PATCH de revalidation du hostname apex), puis seulement par `domains:backfill-apex` une fois le domaine `active`; l'activation du domaine n'attend jamais la zone ni le hostname apex;
- `CustomHostnameVerificationStep` : exactement une sonde de statut, sans boucle ni planification;
- `DomainConfigurationRunner` : curseur persistant, boucle bornée et attente durable;
- `DomainActivationStep` : politique source/projet, KV, CAS d'activation et ordre fulfilled;
- `DomainTerminalFailureStep` : classification sûre, handoff du refund sous fence, écritures terminales, nettoyage;
- `OrderRefundStep` et `OrderRefundRunner` : effet Stripe protégé et retry durable;
- services de maintenance et de réconciliation : une politique de scan bornée chacun.

`DomainPurchaseOrchestrator` ne fait que composer les étapes. Les services Nest dépendent de ports de dispatch; seuls les adapters Trigger importent le SDK et les types de tâches. Aucun client/transaction DB ne traverse un checkpoint durable.

```text
paiement Stripe vérifié
  -> ligne domaine sous fence + handoff global domain-purchase
  -> wrapper + runtime local au run
  -> état -> Name.com -> DNS www + forwarding -> hostname/challenges Cloudflare www
  -> zone Cloudflare apex best-effort (zone + hostname apex + DNS zone + NS)
  -> runner de vérification avec curseur DB + wait.until (zone sondée avant chaque sonde)
  -> activation KV + domaine active + ordre fulfilled
  -> échec terminal : acceptation de order-refund avant écritures terminales
  -> runner refund + clé Stripe dérivée de l'ordre

backstops planifiés
  -> guérison des achats obsolètes ou handoffs perdus
  -> guérison des refunds éligibles non enregistrés
```

Deux files Trigger à `concurrencyLimit: 1` conservent la sérialisation : `domain-operations` pour fulfillment, configuration, maintenance et réconciliation domaine; `order-refunds` pour refund et réconciliation refund. Un checkpoint passe en `WAITING`, libère le slot de concurrence et ne conserve ni transaction ni connexion louée.

## 3. Tâches, reprises et planifications

| Tâche | File Trigger | Contrat et comportement |
|---|---|---|
| `domain-purchase` | `domain-operations` | Payload strict `{ domainId, orderId }`; cinq tentatives avec backoff 60/120/240/480 s; orchestre enregistrement, DNS, configuration, activation et terminalisation. |
| `domain-configure` | `domain-operations` | Payload strict `{ domainId, nonce }`; trois tentatives pour crash/runtime; l'état provider pending reste dans la boucle durable. |
| `order-refund` | `order-refunds` | Payload strict `{ orderId, failureReason }`; boucle durable à 60 s sans compute détenu, alerte `MANUAL REVIEW REQUIRED` à partir de l'échec 30. |
| `reconcile-domain-purchases` | `domain-operations` | Toutes les 15 minutes UTC; scan borné des achats stale, handoffs perdus et ordres à guérir. |
| `reconcile-order-refunds` | `order-refunds` | Toutes les 5 minutes UTC; ordres domaine payés/échoués sans `providerRefundId`. |
| `domain-renewal-notices` | `domain-operations` | Cron `0 2 * * *` UTC; avis d'expiration uniquement, y compris `autoRenew=false`; aucun débit/renew. |
| `domain-registrar-sync` | `domain-operations` | Cron `0 3 * * 0` UTC; expiry, transfer lock et `transferred_out`, avec isolation des erreurs par ligne. |

Les reconcilers vérifient de nouveau l'éligibilité DB, ne redéclenchent jamais un run vivant et réutilisent les clés globales. La récupération achat ne reset qu'un handle annulé ou réussi-mais-incohérent-en-DB après le seuil stale; la récupération refund revérifie l'éligibilité avant de reset un handle annulé. Trigger v4 libère automatiquement la clé d'un run échoué. Ils ne contactent jamais Stripe directement.

### Curseur durable de vérification

Le polling du certificat Cloudflare ne s'auto-enfile plus et ne dépend d'aucun compteur mémoire. Le JSON privé `domains.dns.triggerConfiguration` contient :

```text
{ nonce, nextAttempt, nextProbeAt }
```

1. Un nonce neuf commence à `nextAttempt=0` et sonde immédiatement. L'achat utilise `purchase:${orderId}`; BYO utilise le nonce de son payload. Retry, récupération après annulation et réconciliation reprennent le même curseur.
2. Après une réponse pending/transitoire à l'essai N < 100, un CAS écrit d'abord `{ nextAttempt: N + 1, nextProbeAt: now + min(30 * 2^N, 900)s }`, puis le runner appelle `wait.until` sur cette date absolue.
3. Les essais 0 à 99 créent 100 fenêtres d'attente totalisant 24h00m30s, puis l'essai 100 sonde une dernière fois. Un retry n'ajoute donc aucun délai et ne redémarre pas le budget.
4. Le CAS compare status, nonce et essai attendu tout en fusionnant le JSON DNS. Une écriture de curseur conserve le `updatedAt` public, les marqueurs DNS et les challenges.
5. Un timeout acheté terminalise avec `Cloudflare SSL verification timed out`; un timeout externe retourne pending et garde `configuring`. Activation/terminalisation efface le curseur; une vérification manuelle délibérée utilise un nouveau nonce.

### Trois frontières d'idempotence

| Frontière | Clé stable |
|---|---|
| Run Trigger d'achat | globale `domain-purchase:${orderId}` |
| Requête Name.com d'enregistrement | `domain-purchase:${domainRowId}` |
| Run Trigger BYO | globale `domain-configure:${domainId}:${nonce}` |
| Run Trigger de remboursement | globale `order-refund:${orderId}` |
| Requête Stripe de remboursement | `order-refund:${orderId}` |

L'idempotence globale Trigger déduplique la livraison ordinaire. Les gardes DB et le reçu provider protègent l'enregistrement; la clé Stripe garantit un seul effet financier, y compris si une récupération crée légitimement un run ultérieur.

## 4. Frontière paiement et parcours métier

Le module orders/billing possède `payment_orders`, Stripe Checkout, l'inbox webhook dédupliquée, les états paiement et la réconciliation. DomainsModule possède registrant, disponibilité/plafond et fulfillment.

### Achat

1. Recherche Name.com en lecture seule; seul le prix retail est exposé pour les résultats sûrs.
2. `POST /api/v1/orders/domain` revalide disponibilité/plafond, exige wholesale × 100 < retail cents, puis fige le snapshot avant Stripe.
3. Stripe Checkout (`mode: payment`, metadata `{ orderId, purpose: "order" }`).
4. `reconcile-session` ou webhook vérifie le paiement, puis l'ordre passe `paid → fulfilling`.
5. `DomainRegistrationFulfillment` crée/réutilise la ligne domaine sous advisory lock puis déclenche globalement `domain-purchase`.
6. Juste avant la dépense, `DomainRegistrationStep` reprend la fence et revalide l'ordre/quote. Name.com reçoit `X-Idempotency-Key: domain-purchase:{domainRowId}`; le reçu, DNS, forwarding, hostname/challenges Cloudflare (www puis zone/hostname apex best-effort), activation et fulfillment sont persistés par CAS (les clés apex par fusion jsonb).

Nettoyage : partout où le hostname `www` est supprimé (échec terminal, nettoyage d'une ligne `failed` à l'activation, détachement), le hostname apex `dns.apexCustomHostnameId` l'est aussi, best-effort. La zone n'est supprimée que sur **échec terminal d'achat**, et seulement si `dns.zoneCreated` est posé sans `dns.zoneDelegated` ni `dns.apexConfigured` (zone créée par nous, appel `setNameservers` jamais atteint). `dns.zoneDelegated` est persisté (fusion jsonb fencée) AVANT l'appel `setNameservers` Name.com : un appel expiré, un fence perdu ou un crash après l'appel comptent donc comme délégués. Une zone adoptée ou déjà déléguée est laissée en place et journalisée; le détachement/dépublication ne supprime jamais la zone (le registre y délègue encore : la supprimer couperait le DNS du client).

En cas d'échec terminal après paiement, `DomainTerminalFailureStep` demande l'acceptation durable de `order-refund` **dans la fence ordre+domaine et avant toute écriture terminale**. Un échec de handoff annule la transaction et laisse les lignes récupérables. Aucun mouvement n'utilise `credit_ledger`.

### BYO et renouvellement

BYO crée une ligne externe, un hostname Cloudflare et les enregistrements requis, puis déclenche `domain-configure` avec une clé globale domaine+nonce. Il ne requiert ni Name.com ni Stripe.

Le renouvellement payé n'est pas câblé. `auto_renew=false`, l'API refuse son activation et la tâche quotidienne n'écrit que les avis T-30. Un futur renouvellement exige un kind `domain_renewal` dans `payment_orders`; aucun renouvellement ni débit silencieux n'est possible.

## 5. État de sécurité

| Surface | État actuel |
|---|---|
| Recherche Name.com | Lecture seule, autorisée avec credentials sandbox |
| BYO domain | Indépendant du registrar et du paiement; tâche configuration + Cloudflare |
| Achat | Actif via orders/Stripe; fail-closed sans quote sûre ou `TRIGGER_SECRET_KEY` API |
| Remboursement | Tâche durable, gardes DB, clé Trigger globale et clé Stripe stable |
| Renouvellement | Inexistant : avis d'expiration uniquement |
| Autorenew | Refusé tant que le renouvellement payé n'existe pas |
| Production Name.com | Interdite aux tests locaux/automatiques; garde `-test` bidirectionnelle |

Une disponibilité ou une quote ne réserve jamais le domaine. Le step d'enregistrement revalide toujours l'ordre et le prix avant l'achat payé.

## 6. Configuration Trigger.dev

### Valeurs métier requises dans les environnements de tâches

La production doit les définir explicitement, même lorsqu'un défaut local existe.

| Variable | Tâches concernées | Assertion / raison |
|---|---|---|
| `DATABASE_URL` | Toutes les tâches domaine/refund/maintenance/réconciliation | Non vide avant construction du pool local au run. |
| `NAMECOM_ENVIRONMENT` | Achat et sync registrar hebdomadaire | Exactement `sandbox` ou `production`; explicite même si le schéma partagé vaut `sandbox` par défaut. |
| `NAMECOM_USERNAME` | Achat et sync registrar | Requis; suffixe `-test` si et seulement si l'environnement est sandbox. |
| `NAMECOM_API_TOKEN` | Achat et sync registrar | Secret Basic-auth Name.com requis. |
| `CLOUDFLARE_API_TOKEN` | Achat, configuration BYO, activation/nettoyage | Hostname custom, zone et KV. |
| `CLOUDFLARE_ZONE_ID_WANDIT_APP` | Achat, configuration BYO, activation/nettoyage | Zone hostname et résolution du compte Cloudflare pour KV. |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Activation/nettoyage achat et BYO | Mutations du pointeur KV `domain:{host}`. |
| `CLOUDFLARE_ACCOUNT_ID` | Achat (étape zone apex), backfill | Compte propriétaire des zones par domaine (`POST /zones`). Non asserté au préflight : absent, l'étape apex écrit `dns.apexError` et le domaine reste www-only. |
| `DOMAINS_APEX_ZONE_ENABLED` | Achat (étape zone apex), backfill | Kill switch, défaut `true`. `false` = forwarding URL registrar pour l'apex, comportement antérieur exact. |
| `DOMAINS_FALLBACK_ORIGIN` | DNS géré des achats | Cible CNAME `www` chez Name.com et des deux CNAME dans la zone Cloudflare du domaine; à définir explicitement (défaut partagé actuel : `customers.wandit.app`). |
| `STRIPE_SECRET_KEY` | Refund et préflight achat | Permet le remboursement; l'achat l'exige avant toute dépense Name.com. |

Première opération par tâche :

- `domain-purchase` valide DB, toutes les valeurs Name.com + leur pairing sandbox, les trois valeurs Cloudflare, fallback origin et secret Stripe avant disponibilité, mutation DB ou registration. Une erreur de config utilise les cinq tentatives puis le même chemin de refund.
- `domain-configure` valide DB + les trois valeurs Cloudflare avant la première sonde/mutation KV; une ligne externe n'exige ni Name.com ni Stripe.
- `order-refund` valide DB + Stripe dans la boucle durable; une config absente attend 60 s puis recommence.
- `domain-registrar-sync` valide DB + Name.com/pairing. Les avis de renouvellement et les deux reconcilers exigent seulement DB.

### Valeur du producteur API

`TRIGGER_SECRET_KEY` est requis dans le **déploiement Nest API** pour le gate avant paiement et les appels typés `tasks.trigger`. Ce n'est pas un credential métier consommé par un run de tâche. Une valeur vide/absente conserve le 503 `DOMAINS_TEMPORARILY_UNAVAILABLE` avant Stripe et Name.com.

### Caveat du bootstrap eager de l'environnement partagé

Les adapters réutilisés et `createDb()` importent `@wandit/env/server`, qui valide immédiatement tout le schéma serveur lors de l'évaluation du module. Jusqu'à refactor de ce package, le déploiement Trigger doit aussi recevoir ces valeurs, bien que les tâches domaine/refund ne les utilisent pas :

- `BETTER_AUTH_SECRET` (au moins 32 caractères)
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Le tableau métier est le contrat fonctionnel; cette liste est uniquement une contrainte d'import du module partagé. Les assertions de tâche restent utiles pour produire une erreur ciblée sur les credentials feature optionnels du schéma.

### Valeurs non requises par ces tâches

- `QUEUE_ENABLED`, `QUEUE_PREFIX` et `REDIS_URL` ne sont pas des dépendances Trigger. Ils restent nécessaires aux fonctions génération/chat et à l'infrastructure Redis du worker restant.
- `STRIPE_WEBHOOK_SECRET` appartient uniquement au webhook API.
- R2, modèles/gateway AI et `SITES_DOMAIN` sont hors de cette migration.
- Seules `CLOUDFLARE_ACCOUNT_ID` (optionnelle) et le kill switch `DOMAINS_APEX_ZONE_ENABLED` ont été ajoutés à `packages/env/src/server.ts` pour l'étape zone apex.

## 7. Opérations Name.com

| Élément | Valeur |
|---|---|
| Sandbox | `https://api.dev.name.com` |
| Production | `https://api.name.com` |
| Auth | HTTP Basic : username + API token |
| Username sandbox | suffixé `-test` |
| Inventaire v1 | `purchaseType=registration` uniquement |
| Idempotence registrar | `X-Idempotency-Key: domain-purchase:{domainRowId}` |

Le compte registrar doit être financé et monitoré. Les prix publics doivent couvrir prix Name.com, renouvellement, privacy, fiscalité et marge. Name.com webhooks devraient compléter le sync hebdomadaire pour transferts, rejets registry et vérification de contact.

Port `DomainProvider` : `checkAvailability`, `register`, `renew`, `setDnsRecords` (A/AAAA/CNAME/NS/TXT), `setNameservers` (`POST /core/v1/domains/{domain}:setNameservers`), `setUrlForwarding` (repli apex), `getAuthCode`, `setTransferLock`, `getDomainInfo`. Adapters Cloudflare : `CustomHostnameService` (hostname www canonicalisé, hostname apex nom nu, recherche par nom, statut, PATCH de revalidation, suppression) et `CustomerZoneService` (zones par domaine dans notre compte : recherche par nom, création avec `CLOUDFLARE_ACCOUNT_ID`, statut, activation check, upsert d'enregistrement DNS-only, suppression).

### Backfill des domaines déjà achetés

```bash
cd apps/server
pnpm domains:backfill-apex -- --dry-run            # liste les candidats, aucune écriture
pnpm domains:backfill-apex                         # traite tous les candidats
pnpm domains:backfill-apex -- --domain example.com # un seul domaine
```

Sélectionne les lignes achetées/`namecom` en `configuring` ou `active` sans `dns.apexConfigured` et exécute le même `ApexZoneStep` que le runtime d'achat (zone et hostname apex existants adoptés par nom — les domaines configurés à la main sont donc simplement enregistrés). Relançable sans risque; sortie non nulle tant qu'un domaine reste à reprendre; refuse de tourner si `DOMAINS_APEX_ZONE_ENABLED=false`.

## 8. Production cutover — runbook opérationnel

> Cette procédure est destinée au déploiement production. Elle est conservée ici mais n'a **pas été exécutée dans ce worktree de feature branch**.

L'ordre suivant est restart-safe et préserve le temps de polling déjà écoulé :

1. Déployer le worker transitionnel sans enregistrement des schedulers domaine legacy pendant que l'API produit encore les anciens jobs. Le redémarrer et confirmer qu'aucun scheduler n'est recréé.
2. Supprimer les ids Redis persistés `domain-renewals-daily` et `domain-sync-weekly`, puis redémarrer encore le worker et vérifier leur absence. Ne pas supprimer les jobs maintenance déjà émis : leurs branches de consommation doivent les terminer.
3. Déployer/indexer les sept tâches Trigger avec les quatre schedules initialement en pause. En environnement de test, vérifier que `domain-purchase`, `domain-configure` et `order-refund` acceptent des runs avant de changer l'API.
4. Déployer le switch des producteurs et du gate API. Garder le worker transitionnel pour les jobs Redis existants, mais vérifier que chaque nouveau handoff domaine/refund part exclusivement vers Trigger.
5. Activer exactement une fois chacun des quatre schedules : réconciliation achat toutes les 15 minutes, réconciliation refund toutes les 5 minutes, avis de renouvellement `0 2 * * *` UTC et sync registrar `0 3 * * 0` UTC. Les trois schedules domaine partagent `domain-operations`; le refund utilise `order-refunds`.
6. Avant toute suppression de consumer, auditer les anciennes files Redis `domains` et `order-refunds` dans les états `waiting`, `active`, `delayed` et `failed`, puis auditer la DB pour :
   - ordres paid/fulfilling avec domaines achetés `registering` ou `configuring`;
   - domaines active dont l'ordre n'est pas `fulfilled`;
   - ordres domaine paid+failed sans `providerRefundId`.
7. Laisser les jobs actifs finir. Pour traduire un job configuration delayed/waiting/failed sans réinitialiser son budget :
   - domaine acheté : initialiser `dns.triggerConfiguration` avec les `{ nonce, attempt }` exacts et l'échéance absolue `job.timestamp + job.delay` (ramenée à maintenant si déjà échue), puis déclencher le `domain-purchase` global; le runner doit adopter ce curseur;
   - domaine externe : initialiser le même curseur puis déclencher `domain-configure` avec le nonce d'origine;
   - supprimer l'ancien job seulement après réussite du CAS curseur **et** du handoff Trigger.
8. Laisser les autres anciens jobs liés à un ordre finir ou déclencher explicitement leur tâche globale achat/refund. Un payload historique payé en crédits sans `orderId` ne respecte pas le nouveau contrat strict et **doit finir dans le worker transitionnel**. Ne jamais retirer un ancien refund avant acceptation du run `order-refund` par Trigger.
9. Confirmer que les deux reconcilers ne trouvent aucune ligne éligible abandonnée. Chaque curseur doit appartenir à un run vivant/de récupération ou à un résultat external-pending délibéré. Les files legacy doivent être vides, ou chaque ligne restante doit avoir un run Trigger de récupération confirmé.
10. Seulement après ces gates, déployer l'état Stage 4 qui retire consumers, registrations, contrats domaine/refund et dépendance Stripe directe du worker. Conserver le worker AI/media/lead/publish et son infrastructure BullMQ/ioredis opérationnels.
11. Après déploiement, vérifier les quatre schedules actifs une seule fois, le démarrage du worker restant, l'absence de nouveaux jobs domaine/refund legacy, des reconcilers propres et des smoke runs qui mettent à jour la vérité DB.

## 9. Prochaines étapes et vigilance

1. Vérifier l'adapter contre Name.com sandbox : availability, register idempotent, contacts, DNS, forwarding (apex `host: ""`), `setNameservers`, lock/auth code et erreurs retryables.
2. Smoke test complet : checkout test → `paid → fulfilling → fulfilled`, domaine `registering → configuring → active`, reçu persisté; puis échec terminal → acceptation refund avant écritures terminales.
3. Calibrer le catalogue retail sur le coût complet et configurer financement/alertes de solde registrar.
4. Ajouter suivi de vérification contact, procédures support et webhooks Name.com.
5. Valider Cloudflare + publishing-serving de bout en bout (`apps/edge` consomme le pointeur KV; voir `docs/features/edge-serving.md`).
6. Concevoir le renouvellement payé : kind `domain_renewal`, clé idempotente sur `renew()`, UI « Renew now ».
7. Exécuter et consigner le runbook de production avant déploiement de la suppression des consumers historiques.

Points permanents : une quote ne réserve pas un domaine; privacy/TVA peuvent modifier le coût complet; les contacts non vérifiés peuvent suspendre la résolution; les migrations OpenProvider historiques restent immuables.

## 10. Notes historiques — ne décrivent pas l'architecture actuelle

Le prototype de juillet 2026 utilisait OpenProvider, un portefeuille registrar prépayé et `credit_ledger`, puis une livraison domaine/refund sur Bull. Cette histoire a fourni le port provider, les fences et les tests de cycle de vie, mais elle ne décrit plus le runtime.

Références historiques uniquement :

- `OPENPROVIDER_API_URL`, `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`;
- `OpenproviderProvider`;
- prix exprimés en crédits;
- consommation/grant de crédits pour achat ou renouvellement;
- anciennes files Redis domaine/refund et leur worker de fulfillment;
- promesse « changer de registrar = un fichier et une ligne ».

Les détails techniques actuels sont dans `docs/features/custom-domains.md`.
