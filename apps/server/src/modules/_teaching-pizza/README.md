# 🍕 The Teaching Pizza Module

This is a FAKE feature. It is not connected to the app, it never runs, no route
`/v1/pizza-orders` exists in reality. It exists only so you can learn how a
NestJS module in THIS repo is built, using a feature so simple (ordering a
pizza) that the only new thing left to understand is NestJS itself.

It is a miniature copy of `modules/generation`, same folders, same rules.

## Read the files in this order

1. `domain/pizza.types.ts` — the business words (pure TypeScript, no NestJS at all)
2. `domain/errors/pizza-too-big.error.ts` — a business error
3. `infrastructure/persistence/pizza-orders.repository.ts` — the hands (fake DB here)
4. `application/services/pizza-pricing.service.ts` — a tiny brain with zero dependencies
5. `application/services/pizza-orders.service.ts` — the main brain + THE DEPENDENCY INJECTION LESSON
6. `presentation/http/controllers/pizza-orders.controller.ts` — the front door (routes, @Param, @Body)
7. `pizza.module.ts` — the wiring that glues 3–6 together

## The map (same as the real modules)

| Folder            | Nickname           | Allowed to talk about                  |
| ----------------- | ------------------ | -------------------------------------- |
| `presentation/`   | the front door     | HTTP: routes, params, status codes     |
| `application/`    | the brain          | decisions, steps, the "story"          |
| `domain/`         | the business words | pure concepts — NO technology imports  |
| `infrastructure/` | the hands          | real tools: Postgres, Redis, R2...     |

Dependency arrow (who may call whom):
`presentation → application → domain`, and `application → infrastructure`.
Never backwards.

## Why does this module never run?

Because `app.module.ts` does not import it. A NestJS module only comes alive
when some other loaded module puts it in its `imports: []` list. Delete this
whole folder any day — nothing will break.
