// Thin typed fetch wrapper for the API: base URL from env, cookies included
// (better-auth), JSON + error normalization, responses parsed by
// packages/contracts schemas. Every feature's api/*.services.ts builds on
// this — it is the only place fetch() is called directly. ISRECOM-26.
