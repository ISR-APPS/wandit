# Range Dispatch

This starter shows field service dispatch and crew coverage.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Review service calls by neighborhood, see crew coverage on a dispatch grid, and find priority jobs.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
