# Data: tables, events, read functions, and queries

The example is a factory with work orders. Copy its patterns, never its names.
Every chart and every KPI of the app reads real rows through the rules below.
Section 8 holds the complete example. It is tested.

## 1. Business tables

- Write all tables, policies, triggers, and read functions of the first build in ONE `apply_migration` call.
- Every business table has these columns:
  `id uuid primary key default gen_random_uuid()`,
  `owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade`,
  `created_at timestamptz not null default now()`.
- Enable RLS. Add four policies: select, insert, update, and delete, each `to authenticated`,
  with `owner_id = (select auth.uid())`. The `select` wrapper runs `auth.uid()` once per query, not once per row.
- Sign-up is open: any person can make an account. So never give `authenticated` a `using (true)` policy on business data.
- A status is a `text` column with a `check (status in (...))` constraint.
  The same values are a `const` tuple in the `lib/` folder of the feature.
- A child row points to its parent with `foreign key (parent_id, owner_id)`, and the parent has `unique (id, owner_id)`.
  Then a user cannot attach a row to a row of another user.
- Index `owner_id` (RLS reads it on every query) and every foreign key.

## 2. Event tables

- A chart needs rows with a time. A counter column has no history, so it gives no trend.
- Write one row per event: `production_events`, `stock_movements`, `status_changes`.
  Each event has `occurred_at timestamptz not null default now()` and an index on `(owner_id, occurred_at)`.
- The UI can show a counter, for example `work_orders.quantity_done`.
  An `after insert` trigger on the event table keeps it in sync. A chart never reads the counter.
- An event table with a counter trigger is append-only: it gets select and insert policies only.
  A wrong event gets a correction event with the opposite value. Then the counter stays true.
  The correction event keeps the `occurred_at` of the wrong event, so the chart and the KPIs correct the same day.
- The trigger function is `security invoker`, so RLS also applies to its update.
- An event row never disappears with its parent. Its foreign key uses `on delete set null (<parent>_id)`,
  so a past day keeps its value. Exception: `stock_movements` uses `on delete cascade`.
  The stock item holds the counter, so the database deletes the item and its movements together.

## 3. Read functions

- Each chart and each KPI row reads one SQL function through `rpc`. The database does the math.
  The browser never loads raw events to add them.
- The function header is `language plpgsql stable security invoker set search_path = ''`.
  `security invoker` keeps RLS. Write each table with its schema: `public.production_events`.
- Inputs: `p_days int` (1 to 366) and `p_time_zone text` (an IANA name, for example `Africa/Casablanca`).
  A bad value raises `invalid_input`.
- A daily series does these steps:
  1. Check the inputs. Compute today in the user time zone.
  2. Group the events once by `(occurred_at at time zone p_time_zone)::date`.
     Filter `occurred_at` from the start of the first day in that time zone, so the index applies.
  3. Left join one row per day from `generate_series` and use `coalesce(..., 0)`.
     A day with no event shows 0, not a gap.
  4. Return `day`, `current`, and `previous`. `previous` is the same day `p_days` earlier,
     so both periods have the same length.
- A breakdown returns `label` and `value`: the 5 largest parts and one `other` part.
  The labels are codes. The page translates them.
- A KPI function returns one row of raw counts and sums. TypeScript computes the rates and the changes (section 6).
- A function with no input can be `language sql`.

## 4. Query files

- `<entity>.queries.ts` calls `getSupabase().rpc(...)`, throws on `error`,
  and parses the rows with a zod schema with named fields.
- The query key starts with the entity name and holds the period: `["production", "daily", days]`.
- The time zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `src/features/overview/lib/series.ts` holds the shared shapes: `DailyPoint`, `CategoryPoint`,
  `BreakdownSlice`, and `KpiItem`. The chart and KPI files use them.
- `overviewKpisQueryOptions()` returns one row per KPI: the `KpiItem` fields with `labelKey` (a message key)
  in place of `label`. The home turns `labelKey` into `label` with `t()`.
- A mutation invalidates every key that its write changes: the entity key and `["overview"]`.

## 5. The home page

- This file gives `series.ts` and `overview.queries.ts`. The home file is a spec, not code.
  From it, you write `src/routes/app/index.tsx`, `src/features/overview/index.ts`, and the overview page.
- The route is thin: a loader that prefetches the queries of the home file, a `pendingComponent`, and an `errorComponent`.
  `index.ts` exports the page, its skeleton, its error, `DEFAULT_DAYS`, and the query options of the loader.
- The overview page holds the period of the trend. `DEFAULT_DAYS` is the period of the first load:
  30 days, unless the home file sets another value.
- The home and chart files use slot names. Use your read functions in their place. In the factory example:

| Slot name in the home and chart files | Factory read function |
|---|---|
| `overviewKpisQueryOptions()` | the same name |
| `dailySeriesQueryOptions(days)` | `dailyProductionQueryOptions(days)`; with chart=stacked, `dailyOutputQueryOptions(days)` |
| `breakdownQueryOptions(days)` | `downtimeByReasonQueryOptions(days)` |

- The breakdown rows hold codes. The overview page translates them before the breakdown panel gets them:
  ``slices.map((slice) => ({ label: t(`downtimeReasons.${slice.label}`), value: slice.value }))``.
- `buildOverviewKpis` lists the KPIs in order of importance. A home file that shows the first KPI rows sets its `KPI_COUNT`. tabbed picks rows by id.
  The overview page passes only the first rows to the figures: `kpis.slice(0, KPI_COUNT)`.

## 6. KPI math

- `buildOverviewKpis` in `overview.queries.ts` does this math.
- change = (current - previous) / previous. A previous value of 0 gives `change: null`: no delta shows.
- A count with no history (late items, items under a minimum) has `change: null`.
- A rate (scrap rate, no-show rate) compares the rate of this period with the rate of the period before.
- `goodWhen: "down"` for costs, delays, scrap, downtime, absences, and late items.

## 7. Domain table

Each family gives: nav items, entities, event tables, KPIs with `goodWhen`, the main chart, the breakdown,
the attention list, and the status words with their Badge variant.
Badge rule: `success` done or healthy; `info` in progress; `warning` needs action soon;
`destructive` failed, blocked, or late; `secondary` waiting or idle; `outline` closed or cancelled.

**Operations, manufacturing** (factory, workshop, plant). Section 8 builds it.
- Nav: Overview, Work orders, Machines, Production, Stock. Entities: machines, work_orders, stock_items.
- Events: production_events (quantity, scrap), downtime_events (reason, started_at, ended_at), stock_movements.
- KPIs: units today (up), machines running of total (up, meter), late work orders (down), scrap rate 7 days (down), stock items under minimum (down).
- Chart: units per day. Breakdown: downtime minutes by reason. Attention: late and blocked work orders.
- Status: running success, idle secondary, down destructive, maintenance warning; planned secondary, in_progress info, blocked destructive, done success.

**Inventory, stock** (warehouse, depot, shop stock).
- Nav: Overview, Items, Movements, Suppliers, Purchase orders. Entities: stock_items, suppliers, purchase_orders.
- Events: stock_movements (delta, reason: receipt, sale, loss, adjustment), purchase order status_changes.
- KPIs: units out this period (up), items under minimum (down), items out of stock (down), late purchase orders (down).
- Chart: units in and out per day (stacked by reason). Breakdown: units out by category.
- Attention: items under minimum, purchase orders past their expected date.
- Status: draft secondary, ordered info, partly_received warning, received success, cancelled outline.

**Maintenance, field service**.
- Nav: Overview, Interventions, Assets, Technicians, Clients. Entities: interventions, assets, technicians, clients.
- Events: intervention status_changes (opened, started, closed), meter_readings.
- KPIs: open interventions (down), closed this period (up), mean time to repair in hours (down), overdue preventive tasks (down).
- Chart: interventions opened and closed per day (compare). Breakdown: interventions by type.
- Attention: overdue interventions, urgent interventions with no technician.
- Status: new secondary, scheduled info, in_progress warning, done success, cancelled outline.

**Logistics, delivery**.
- Nav: Overview, Deliveries, Drivers, Vehicles, Customers. Entities: deliveries, drivers, vehicles, customers.
- Events: delivery status_changes (picked_up, delivered, failed).
- KPIs: deliveries today (up), on-time rate 7 days (up), failed deliveries (down), mean delay in minutes (down).
- Chart: deliveries per day. Breakdown: failed deliveries by reason.
- Attention: late deliveries, failed deliveries with no new attempt.
- Status: pending secondary, in_transit info, delivered success, failed destructive, returned warning.

**CRM, sales**.
- Nav: Overview, Deals, Contacts, Companies, Activities. Entities: deals, contacts, companies.
- Events: deal stage_changes, activities (call, email, meeting).
- KPIs: won amount this period (up), win rate (up), open pipeline amount (up), deals with no activity for 14 days (down).
- Chart: won amount per day. Breakdown: open pipeline by stage.
- Attention: deals with a close date in the past, deals with no activity for 14 days.
- Status: lead secondary, qualified info, proposal warning, won success, lost destructive.

**Bookings, appointments** (clinic, salon, studio).
- Nav: Overview, Appointments, Clients, Services, Staff. Entities: appointments, clients, services, staff.
- Events: appointments (starts_at is the event time), appointment status_changes.
- KPIs: appointments today (up), no-show rate 30 days (down), booked revenue this period (up), cancellations (down).
- Chart: appointments per day. Breakdown: appointments by service.
- Attention: appointments today that are not confirmed, no-shows to call back.
- Status: pending secondary, confirmed info, done success, no_show destructive, cancelled outline.

**Education, school**.
- Nav: Overview, Students, Classes, Attendance, Fees. Entities: students, classes, enrollments.
- Events: attendance_records (present, absent, late), fee_payments.
- KPIs: attendance rate 30 days (up), absences today (down), active students (up), unpaid fees (down).
- Chart: attendance rate per day. Breakdown: students by class.
- Attention: students absent 3 days or more in a row, fees past their due date.
- Status: active success, on_leave warning, withdrawn secondary; paid success, due warning, overdue destructive.

**HR, team**.
- Nav: Overview, Employees, Leave requests, Attendance, Departments. Entities: employees, leave_requests, departments.
- Events: attendance (clock in, clock out), leave request status_changes, employment_events (hire, exit).
- KPIs: headcount (up), absence rate 30 days (down), pending leave requests (down), hires this period (up).
- Chart: absences per day. Breakdown: employees by department.
- Attention: leave requests that wait for approval, contracts that end in the next 30 days.
- Status: pending warning, approved success, rejected destructive; active success, on_leave info, exited secondary.

**Invoicing, finance**. Store money as `numeric(12, 2)`. The currency comes from the user. Never use a float.
- Nav: Overview, Invoices, Quotes, Clients, Expenses. Entities: invoices, quotes, clients, expenses.
- Events: payments (amount, paid_at), expenses (amount, spent_at), invoice status_changes.
- KPIs: cash collected this period (up), outstanding amount (down), overdue amount (down), expenses this period (down).
- Chart: payments per day (compare). Breakdown: expenses by category.
- Attention: overdue invoices, quotes that expire in the next 7 days.
- Status: draft secondary, sent info, paid success, overdue destructive, cancelled outline.

**Projects, tasks**.
- Nav: Overview, Projects, Tasks, Clients, Time. Entities: projects, tasks, clients.
- Events: task status_changes (completed_at), time_entries (minutes).
- KPIs: tasks done this period (up), overdue tasks (down), hours logged (up), projects at risk (down).
- Chart: tasks done per day. Breakdown: open tasks by project.
- Attention: overdue tasks, blocked tasks.
- Status: todo secondary, in_progress info, review warning, blocked destructive, done success.

**Restaurant, orders**.
- Nav: Overview, Orders, Menu, Reservations, Stock. Entities: orders, menu_items, reservations, stock_items.
- Events: orders (placed_at, total), order_items, stock_movements.
- KPIs: orders today (up), revenue today (up), average ticket (up), mean preparation time in minutes (down).
- Chart: revenue per day. Breakdown: sales by menu category.
- Attention: orders that wait more than 20 minutes, ingredients under minimum.
- Status: new info, preparing warning, ready success, served secondary, cancelled destructive.

**Rentals, real estate**.
- Nav: Overview, Units, Tenants, Leases, Payments. Entities: properties, units, tenants, leases.
- Events: rent_payments (amount, paid_at), maintenance_requests (opened_at).
- KPIs: occupancy rate (up, meter), rent collected this period (up), overdue rent (down), open maintenance requests (down).
- Chart: rent collected per day. Breakdown: units by status.
- Attention: overdue rent, leases that end in the next 60 days.
- Status: occupied success, vacant warning, under_repair info; paid success, late destructive.

**Gym, membership**.
- Nav: Overview, Members, Subscriptions, Check-ins, Classes. Entities: members, plans, subscriptions, classes.
- Events: check_ins (occurred_at), subscription_payments.
- KPIs: active members (up), check-ins today (up), new members this period (up), subscriptions that end in 7 days (down).
- Chart: check-ins per day. Breakdown: members by plan.
- Attention: expired subscriptions with recent check-ins, unpaid renewals.
- Status: active success, expiring warning, expired destructive, frozen secondary.

**E-commerce back office**.
- Nav: Overview, Orders, Products, Customers, Returns. Entities: orders, products, customers, returns.
- Events: orders (placed_at, total), order status_changes, stock_movements.
- KPIs: revenue this period (up), orders (up), average order value (up), return rate (down), paid orders to ship (down).
- Chart: revenue per day (compare). Breakdown: revenue by category.
- Attention: paid orders not shipped after 2 days, products out of stock.
- Status: pending warning, paid info, shipped secondary, delivered success, cancelled destructive, returned outline.

## 8. Factory example

Nav: Overview, Work orders, Machines, Production, Stock, Profile.
`tables.md` builds the work orders list and detail pages on the same tables.
You write the home route and the overview page from the home spec, on the reads below (section 5).

### Migration: create_factory

One `apply_migration` call with the name `create_factory`. Then call `get_advisors`.

```sql
-- Business tables. unique (id, owner_id) lets a child row point to a row of the same owner only.
create table public.machines (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	name text not null check (length(name) between 1 and 120),
	zone text check (length(zone) <= 60),
	status text not null default 'idle' check (status in ('running', 'idle', 'down', 'maintenance')),
	created_at timestamptz not null default now(),
	unique (id, owner_id)
);
create index machines_owner_id_idx on public.machines (owner_id);

create table public.work_orders (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	reference text not null check (length(reference) between 1 and 60),
	product text not null check (length(product) between 1 and 120),
	status text not null default 'planned' check (status in ('planned', 'in_progress', 'blocked', 'done')),
	due_at timestamptz not null,
	quantity_target int not null check (quantity_target between 1 and 1000000),
	-- The trigger on production_events keeps this sum. Forms never write it.
	quantity_done int not null default 0,
	notes text check (length(notes) <= 2000),
	created_at timestamptz not null default now(),
	unique (id, owner_id)
);
create index work_orders_owner_id_due_at_idx on public.work_orders (owner_id, due_at);

create table public.stock_items (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	name text not null check (length(name) between 1 and 120),
	unit text not null check (length(unit) between 1 and 20),
	-- The trigger on stock_movements keeps this sum. Forms never write it.
	quantity numeric(12, 2) not null default 0,
	minimum numeric(12, 2) not null default 0 check (minimum >= 0),
	created_at timestamptz not null default now(),
	unique (id, owner_id)
);
create index stock_items_owner_id_idx on public.stock_items (owner_id);

-- Event tables: one row per event, with its time. The charts read them.
-- A deleted parent sets its id to null in the event, so a past day keeps its value.
create table public.production_events (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	machine_id uuid,
	work_order_id uuid,
	-- Good units and scrap units. A correction is a new event with negative values and the occurred_at of the wrong event.
	quantity int not null,
	scrap int not null default 0,
	occurred_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	foreign key (machine_id, owner_id) references public.machines (id, owner_id) on delete set null (machine_id),
	foreign key (work_order_id, owner_id) references public.work_orders (id, owner_id) on delete set null (work_order_id)
);
create index production_events_owner_id_occurred_at_idx on public.production_events (owner_id, occurred_at);
create index production_events_machine_id_owner_id_idx on public.production_events (machine_id, owner_id);
create index production_events_work_order_id_owner_id_idx on public.production_events (work_order_id, owner_id);

create table public.downtime_events (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	machine_id uuid,
	reason text not null check (reason in ('breakdown', 'changeover', 'no_material', 'no_operator', 'planned')),
	started_at timestamptz not null default now(),
	-- null while the machine is still stopped.
	ended_at timestamptz check (ended_at >= started_at),
	created_at timestamptz not null default now(),
	foreign key (machine_id, owner_id) references public.machines (id, owner_id) on delete set null (machine_id)
);
create index downtime_events_owner_id_started_at_idx on public.downtime_events (owner_id, started_at);
create index downtime_events_machine_id_owner_id_idx on public.downtime_events (machine_id, owner_id);

create table public.stock_movements (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	stock_item_id uuid not null,
	-- Positive for a receipt, negative for a consumption.
	delta numeric(12, 2) not null check (delta <> 0),
	reason text not null check (reason in ('receipt', 'consumption', 'adjustment')),
	occurred_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	foreign key (stock_item_id, owner_id) references public.stock_items (id, owner_id) on delete cascade
);
create index stock_movements_owner_id_occurred_at_idx on public.stock_movements (owner_id, occurred_at);
create index stock_movements_stock_item_id_owner_id_idx on public.stock_movements (stock_item_id, owner_id);

-- RLS: each user reads and writes only the rows that they own.
alter table public.machines enable row level security;
alter table public.work_orders enable row level security;
alter table public.stock_items enable row level security;
alter table public.production_events enable row level security;
alter table public.downtime_events enable row level security;
alter table public.stock_movements enable row level security;

create policy machines_select on public.machines for select to authenticated using (owner_id = (select auth.uid()));
create policy machines_insert on public.machines for insert to authenticated with check (owner_id = (select auth.uid()));
create policy machines_update on public.machines for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy machines_delete on public.machines for delete to authenticated using (owner_id = (select auth.uid()));
create policy work_orders_select on public.work_orders for select to authenticated using (owner_id = (select auth.uid()));
create policy work_orders_insert on public.work_orders for insert to authenticated with check (owner_id = (select auth.uid()));
create policy work_orders_update on public.work_orders for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy work_orders_delete on public.work_orders for delete to authenticated using (owner_id = (select auth.uid()));
create policy stock_items_select on public.stock_items for select to authenticated using (owner_id = (select auth.uid()));
create policy stock_items_insert on public.stock_items for insert to authenticated with check (owner_id = (select auth.uid()));
create policy stock_items_update on public.stock_items for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy stock_items_delete on public.stock_items for delete to authenticated using (owner_id = (select auth.uid()));
-- Append-only: a counter trigger reads these rows, so no update and no delete.
create policy production_events_select on public.production_events for select to authenticated using (owner_id = (select auth.uid()));
create policy production_events_insert on public.production_events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy stock_movements_select on public.stock_movements for select to authenticated using (owner_id = (select auth.uid()));
create policy stock_movements_insert on public.stock_movements for insert to authenticated with check (owner_id = (select auth.uid()));
-- A stop gets its end time later, so downtime events allow an update.
create policy downtime_events_select on public.downtime_events for select to authenticated using (owner_id = (select auth.uid()));
create policy downtime_events_insert on public.downtime_events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy downtime_events_update on public.downtime_events for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Counter triggers. security invoker: RLS also applies to the update.
create function public.add_production_to_work_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
	update public.work_orders
	set quantity_done = quantity_done + new.quantity
	where id = new.work_order_id;
	return null;
end;
$$;
create trigger production_events_add_to_work_order
	after insert on public.production_events
	for each row when (new.work_order_id is not null)
	execute function public.add_production_to_work_order();

create function public.add_movement_to_stock_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
	update public.stock_items
	set quantity = quantity + new.delta
	where id = new.stock_item_id;
	return null;
end;
$$;
create trigger stock_movements_add_to_stock_item
	after insert on public.stock_movements
	for each row
	execute function public.add_movement_to_stock_item();

-- Units per day for the last p_days days, and the same days one period earlier. A day with no event gives 0.
create function public.daily_production(p_days int, p_time_zone text)
returns table (day date, current bigint, previous bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare
	v_today date;
	v_first_day date;
begin
	if coalesce(p_days, 0) not between 1 and 366 or p_time_zone is null then
		raise exception 'invalid_input';
	end if;
	begin
		v_today := (now() at time zone p_time_zone)::date;
	exception when invalid_parameter_value then
		raise exception 'invalid_input';
	end;
	v_first_day := v_today - (p_days - 1);
	return query
	with totals as (
		-- One pass over both periods. The bounds on occurred_at use the index.
		select (e.occurred_at at time zone p_time_zone)::date as event_day, sum(e.quantity) as units
		from public.production_events e
		where e.occurred_at >= (v_first_day - p_days)::timestamp at time zone p_time_zone
			and e.occurred_at < (v_today + 1)::timestamp at time zone p_time_zone
		group by event_day
	)
	select days.day, coalesce(cur.units, 0), coalesce(prev.units, 0)
	from (select v_first_day + n as day from generate_series(0, p_days - 1) as n) as days
	left join totals cur on cur.event_day = days.day
	left join totals prev on prev.event_day = days.day - p_days
	order by days.day;
end;
$$;

-- Good and scrap units per day: one row per day and kind, for the stacked chart.
create function public.daily_output(p_days int, p_time_zone text)
returns table (day date, category text, value bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare
	v_today date;
	v_first_day date;
begin
	if coalesce(p_days, 0) not between 1 and 366 or p_time_zone is null then
		raise exception 'invalid_input';
	end if;
	begin
		v_today := (now() at time zone p_time_zone)::date;
	exception when invalid_parameter_value then
		raise exception 'invalid_input';
	end;
	v_first_day := v_today - (p_days - 1);
	return query
	with totals as (
		select (e.occurred_at at time zone p_time_zone)::date as event_day, sum(e.quantity) as good, sum(e.scrap) as scrap
		from public.production_events e
		where e.occurred_at >= v_first_day::timestamp at time zone p_time_zone
			and e.occurred_at < (v_today + 1)::timestamp at time zone p_time_zone
		group by event_day
	)
	-- The cross join gives every day every kind, so a missing kind shows 0.
	select days.day, kinds.category, coalesce(case kinds.category when 'good' then t.good else t.scrap end, 0)
	from (select v_first_day + n as day from generate_series(0, p_days - 1) as n) as days
	cross join (values ('good'), ('scrap')) as kinds (category)
	left join totals t on t.event_day = days.day
	order by days.day, kinds.category;
end;
$$;

-- Downtime minutes by reason in the last p_days days: the 5 largest reasons, then 'other'.
create function public.downtime_by_reason(p_days int, p_time_zone text)
returns table (label text, value bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare
	v_start timestamptz;
begin
	if coalesce(p_days, 0) not between 1 and 366 or p_time_zone is null then
		raise exception 'invalid_input';
	end if;
	begin
		v_start := ((now() at time zone p_time_zone)::date - (p_days - 1))::timestamp at time zone p_time_zone;
	exception when invalid_parameter_value then
		raise exception 'invalid_input';
	end;
	return query
	-- LIMIT: the filter has no lower bound on started_at, so it reads every stop of the user.
	-- Upgrade: a lower bound on started_at with a maximum stop length.
	with stops as (
		-- Cut each stop to the period. A stop with no end counts until now.
		select e.reason,
			extract(epoch from least(coalesce(e.ended_at, now()), now()) - greatest(e.started_at, v_start)) / 60 as minutes
		from public.downtime_events e
		where e.started_at < now() and coalesce(e.ended_at, now()) > v_start
	),
	ranked as (
		select s.reason, sum(s.minutes) as minutes, row_number() over (order by sum(s.minutes) desc) as place
		from stops s
		group by s.reason
	)
	select case when r.place <= 5 then r.reason else 'other' end, round(sum(r.minutes))::bigint
	from ranked r
	group by 1
	order by min(r.place);
end;
$$;

-- Raw totals of the KPI row. TypeScript computes the rates and the changes.
create function public.overview_kpis(p_time_zone text)
returns table (
	units_today bigint,
	units_yesterday bigint,
	machines_running bigint,
	machines_total bigint,
	late_work_orders bigint,
	scrap_week bigint,
	output_week bigint,
	scrap_previous_week bigint,
	output_previous_week bigint,
	stock_below_minimum bigint
)
language plpgsql stable security invoker set search_path = '' as $$
declare
	v_local_now timestamp;
	v_today_start timestamptz;
	v_yesterday_start timestamptz;
	v_yesterday_now timestamptz;
	v_week_start timestamptz;
	v_previous_week_start timestamptz;
begin
	if p_time_zone is null then
		raise exception 'invalid_input';
	end if;
	begin
		v_local_now := now() at time zone p_time_zone;
	exception when invalid_parameter_value then
		raise exception 'invalid_input';
	end;
	v_today_start := v_local_now::date::timestamp at time zone p_time_zone;
	v_yesterday_start := (v_local_now::date - 1)::timestamp at time zone p_time_zone;
	-- Yesterday until the same clock time, so a morning never compares with a full day.
	v_yesterday_now := (v_local_now - interval '1 day') at time zone p_time_zone;
	-- This week is today and the 6 days before. The previous week is the 7 days before it.
	v_week_start := (v_local_now::date - 6)::timestamp at time zone p_time_zone;
	v_previous_week_start := (v_local_now::date - 13)::timestamp at time zone p_time_zone;
	return query
	with production as (
		select
			coalesce(sum(e.quantity) filter (where e.occurred_at >= v_today_start), 0) as units_today,
			coalesce(sum(e.quantity) filter (where e.occurred_at >= v_yesterday_start and e.occurred_at < v_yesterday_now), 0) as units_yesterday,
			coalesce(sum(e.scrap) filter (where e.occurred_at >= v_week_start), 0) as scrap_week,
			coalesce(sum(e.quantity + e.scrap) filter (where e.occurred_at >= v_week_start), 0) as output_week,
			coalesce(sum(e.scrap) filter (where e.occurred_at < v_week_start), 0) as scrap_previous_week,
			coalesce(sum(e.quantity + e.scrap) filter (where e.occurred_at < v_week_start), 0) as output_previous_week
		from public.production_events e
		where e.occurred_at >= v_previous_week_start
	)
	select
		p.units_today,
		p.units_yesterday,
		(select count(*) from public.machines m where m.status = 'running'),
		(select count(*) from public.machines),
		(select count(*) from public.work_orders w where w.status <> 'done' and w.due_at < now()),
		p.scrap_week,
		p.output_week,
		p.scrap_previous_week,
		p.output_previous_week,
		(select count(*) from public.stock_items s where s.quantity < s.minimum)
	from production p;
end;
$$;
```

### Add to: src/shared/i18n/messages.ts

Add these groups to the `messages` object. Translate them into the app language.

```ts
	metrics: {
		unitsToday: "Units today",
		machinesRunning: "Machines running",
		lateWorkOrders: "Late work orders",
		scrapRate: "Scrap rate, 7 days",
		stockBelowMinimum: "Stock items under minimum",
	},
	downtimeReasons: {
		breakdown: "Breakdown",
		changeover: "Changeover",
		no_material: "No material",
		no_operator: "No operator",
		planned: "Planned stop",
		other: "Other",
	},
```

### File: src/features/overview/lib/series.ts

```ts
// Shapes of the home data: daily points, category points, breakdown slices, and KPI items.
// overview.queries.ts parses the rpc rows with these schemas. The KPI, trend, and breakdown panels take the types.
// changeRatio is the one change formula of the app, so every delta compares the same way.
import { z } from "zod";

/** The period choices of a trend panel, in days. The SQL read functions accept 1 to 366. */
export const PERIOD_DAYS = [7, 30, 90] as const;

/** One day of a trend. `day` is YYYY-MM-DD in the user time zone. `previous` is the same day one period earlier. */
export const dailyPointSchema = z.object({
	day: z.iso.date(),
	current: z.number(),
	previous: z.number(),
});

/** One day of a trend, oldest first in a list. Zero on a day with no event. */
export type DailyPoint = z.infer<typeof dailyPointSchema>;

/** One day and one category of a stacked trend. Every day has a row for every category. */
export const categoryPointSchema = z.object({
	day: z.iso.date(),
	category: z.string(),
	value: z.number(),
});

/** One cell of a stacked trend. The stacked chart pivots the rows by `category`. */
export type CategoryPoint = z.infer<typeof categoryPointSchema>;

/** One part of a breakdown. The SQL function keeps 5 parts and folds the rest into "other". */
export const breakdownSliceSchema = z.object({
	label: z.string(),
	value: z.number(),
});

/** One part of a breakdown. `label` is translated before it reaches a panel. */
export type BreakdownSlice = z.infer<typeof breakdownSliceSchema>;

/** One KPI figure of the home. Code builds it from the totals of a KPI function, so it has no schema. */
export type KpiItem = {
	/** Stable id, also the React key, for example "units-today". */
	id: string;
	/** Label, already translated. */
	label: string;
	value: number;
	/** Intl options of the value, for example { style: "percent" }. A plain number when absent. */
	format?: Intl.NumberFormatOptions;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null hides the delta. */
	change: number | null;
	/** "down" for costs, delays, scrap, downtime, and late items: a fall is good news. */
	goodWhen: "up" | "down";
	/** The whole of the value: a count of all, a capacity, the previous-period value, or a user target. The meter form reads it, and a style can read it in other forms (cadran). */
	target?: number;
	/** One value per day, oldest first. Only the spark form reads it. */
	series?: number[];
};

/** Change against the previous period, as a ratio. null when the previous value is 0: no delta shows. */
export function changeRatio(current: number, previous: number): number | null {
	return previous === 0 ? null : (current - previous) / previous;
}
```

### File: src/features/overview/api/overview.queries.ts

```ts
// Reads of the factory home: the KPI rows, the daily series, and the downtime breakdown.
// The loader of the home route prefetches them. OverviewPage reads them from the cache.
// Each read calls one SQL function of the create_factory migration and parses the rows with zod.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { TranslationKey } from "~/shared/i18n";
import { getSupabase } from "~/shared/lib/supabase";
import {
	breakdownSliceSchema,
	categoryPointSchema,
	changeRatio,
	type DailyPoint,
	dailyPointSchema,
	type KpiItem,
} from "../lib/series";

// The SQL functions cut the days in this time zone, so "today" is the user's today.
function userTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// The spark of "units today" shows the same days as the first view of the main chart.
const SPARK_DAYS = 30;

const overviewTotalsSchema = z.object({
	units_today: z.number(),
	units_yesterday: z.number(),
	machines_running: z.number(),
	machines_total: z.number(),
	late_work_orders: z.number(),
	scrap_week: z.number(),
	output_week: z.number(),
	scrap_previous_week: z.number(),
	output_previous_week: z.number(),
	stock_below_minimum: z.number(),
});

// One row of public.overview_kpis: raw counts and sums.
type OverviewTotals = z.infer<typeof overviewTotalsSchema>;

// One KPI before translation. The home turns `labelKey` into the `label` of KpiItem with t().
type OverviewKpi = Omit<KpiItem, "label"> & { labelKey: TranslationKey };

// No output gives no rate, so no delta shows.
function rate(part: number, total: number): number | null {
	return total === 0 ? null : part / total;
}

// The 5 KPIs of the factory home, the most important first. `unitsPerDay` is oldest first, for the spark form.
function buildOverviewKpis(
	totals: OverviewTotals,
	unitsPerDay: number[],
): OverviewKpi[] {
	const scrapRate = rate(totals.scrap_week, totals.output_week);
	const previousScrapRate = rate(
		totals.scrap_previous_week,
		totals.output_previous_week,
	);
	return [
		{
			id: "units-today",
			labelKey: "metrics.unitsToday",
			value: totals.units_today,
			change: changeRatio(totals.units_today, totals.units_yesterday),
			goodWhen: "up",
			series: unitsPerDay,
		},
		{
			id: "machines-running",
			labelKey: "metrics.machinesRunning",
			value: totals.machines_running,
			target: totals.machines_total,
			change: null,
			goodWhen: "up",
		},
		// The database keeps no history of this count, so it shows no delta.
		{
			id: "late-work-orders",
			labelKey: "metrics.lateWorkOrders",
			value: totals.late_work_orders,
			change: null,
			goodWhen: "down",
		},
		{
			id: "scrap-rate",
			labelKey: "metrics.scrapRate",
			value: scrapRate ?? 0,
			format: { style: "percent", maximumFractionDigits: 1 },
			change:
				scrapRate === null || previousScrapRate === null
					? null
					: changeRatio(scrapRate, previousScrapRate),
			goodWhen: "down",
		},
		{
			id: "stock-below-minimum",
			labelKey: "metrics.stockBelowMinimum",
			value: totals.stock_below_minimum,
			change: null,
			goodWhen: "down",
		},
	];
}

async function readDailyProduction(days: number): Promise<DailyPoint[]> {
	const { data, error } = await getSupabase().rpc("daily_production", {
		p_days: days,
		p_time_zone: userTimeZone(),
	});
	if (error) {
		throw error;
	}
	return z.array(dailyPointSchema).parse(data);
}

/** The KPI rows of the home. It reads the totals and the spark series in parallel. The key has no period. */
export function overviewKpisQueryOptions() {
	return queryOptions({
		queryKey: ["overview", "kpis"],
		queryFn: async () => {
			const [totals, production] = await Promise.all([
				getSupabase()
					.rpc("overview_kpis", { p_time_zone: userTimeZone() })
					.single(),
				readDailyProduction(SPARK_DAYS),
			]);
			if (totals.error) {
				throw totals.error;
			}
			return buildOverviewKpis(
				overviewTotalsSchema.parse(totals.data),
				production.map((point) => point.current),
			);
		},
	});
}

/** Units per day for the last `days` days, with the same days one period earlier. Feeds the main trend panel. */
export function dailyProductionQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["production", "daily", days],
		queryFn: () => readDailyProduction(days),
	});
}

/** Good and scrap units per day, one row per day and kind. Feeds the stacked trend panel. */
export function dailyOutputQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["production", "output", days],
		queryFn: async () => {
			const { data, error } = await getSupabase().rpc("daily_output", {
				p_days: days,
				p_time_zone: userTimeZone(),
			});
			if (error) {
				throw error;
			}
			return z
				.array(
					categoryPointSchema.extend({ category: z.enum(["good", "scrap"]) }),
				)
				.parse(data);
		},
	});
}

// The SQL function returns reason codes. OverviewPage translates them with t(`downtimeReasons.${label}`).
const downtimeSliceSchema = breakdownSliceSchema.extend({
	label: z.enum([
		"breakdown",
		"changeover",
		"no_material",
		"no_operator",
		"planned",
		"other",
	]),
});

/** Downtime minutes by reason in the last `days` days: the 5 largest reasons and "other". Feeds the breakdown panel. */
export function downtimeByReasonQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["downtime", "by-reason", days],
		queryFn: async () => {
			const { data, error } = await getSupabase().rpc("downtime_by_reason", {
				p_days: days,
				p_time_zone: userTimeZone(),
			});
			if (error) {
				throw error;
			}
			return z.array(downtimeSliceSchema).parse(data);
		},
	});
}
```
