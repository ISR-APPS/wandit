# Passline

This starter shows kitchen ticket board and service stations.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Group tickets by kitchen station, check course timing, and mark completed orders in the sample board.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
