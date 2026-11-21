# Specimen

This starter shows sample intake and laboratory processing.
The TanStack /app layout uses Supabase sessions. The profile uses the base Supabase profile table.

Trace samples from accession to release. Search the register by barcode, material, or laboratory bench.

Dashboard records are sample data. Edit them in src/features/dashboard/components/dashboard-page.tsx.
To store your records, add a Supabase migration with row-level security and connect the dashboard to your tables.
The navigation lives in src/features/app-shell.
