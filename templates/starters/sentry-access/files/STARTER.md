# Sentry Access

This starter shows access reviews and entitlement exceptions.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Inspect review coverage by identity source and filter access exceptions by severity. The records are examples.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
