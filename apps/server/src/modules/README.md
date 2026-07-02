# Backend Module Structure

Use light DDD inside feature modules when the feature has real behavior:

```txt
feature/
  application/
    commands/
    queries/
    services/
  domain/
    entities/
    repositories/
  infrastructure/
    persistence/
    mappers/
  presentation/
    http/
      controllers/
      dto/
  feature.module.ts
```

Empty layer folders are kept with `.gitkeep` so the intended structure is visible before each feature is implemented.
