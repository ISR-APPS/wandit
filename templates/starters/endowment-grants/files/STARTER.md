# Endowment

This starter shows funding cycles, applications, and awards.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Track a grant cycle from intake to award. Review applications by stage and see which proposals need a decision.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
