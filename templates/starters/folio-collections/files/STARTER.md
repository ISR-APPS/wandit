# Folio Collections

This starter shows museum collections, loans, and locations.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Browse a museum collection by medium, locate objects, and see outgoing loans and planned returns.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
