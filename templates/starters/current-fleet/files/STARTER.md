# Current Fleet

This starter shows depot charging and fleet readiness.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Check charge levels at each depot bay, switch depots, and inspect energy demand by hour.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
