-- ============================================================================
-- ClassPilot AI — 007 Phase 5 launch (notifications, refunds, SaaS payments)
-- Run AFTER 006. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------- in-app notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  audience text not null default 'all'
    check (audience in ('all', 'teachers', 'parents', 'students', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "Members view notifications" on public.notifications;
create policy "Members view notifications"
on public.notifications for select to authenticated
using (
  public.is_institute_member(institute_id)
  and (audience in ('all', 'teachers', 'parents', 'students') or user_id = (select auth.uid()))
);
drop policy if exists "Staff create notifications" on public.notifications;
create policy "Staff create notifications"
on public.notifications for insert to authenticated
with check (public.is_institute_staff(institute_id));
create index if not exists notifications_institute_idx on public.notifications(institute_id, created_at);

-- ------------------------------------------------------- delivery logs (WhatsApp/SMS/email adapter)
create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'inapp')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  idempotency_key text,
  error text,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);
alter table public.notification_delivery_logs enable row level security;
drop policy if exists "Staff view delivery" on public.notification_delivery_logs;
create policy "Staff view delivery"
on public.notification_delivery_logs for select to authenticated
using (public.is_institute_staff(institute_id));
create index if not exists delivery_institute_idx on public.notification_delivery_logs(institute_id, status);

-- ------------------------------------------------------- guardian messaging consent / opt-out
create table if not exists public.notification_preferences (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  whatsapp_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (institute_id, guardian_id)
);
alter table public.notification_preferences enable row level security;
drop policy if exists "Members view prefs" on public.notification_preferences;
create policy "Members view prefs"
on public.notification_preferences for select to authenticated
using (public.is_institute_member(institute_id));

-- ------------------------------------------------------- refunds (never delete payments)
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  payment_id uuid not null references public.fee_payments(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payment_id)
);
alter table public.refunds enable row level security;
drop policy if exists "Staff manage refunds" on public.refunds;
create policy "Staff manage refunds"
on public.refunds for all to authenticated
using (public.is_institute_staff(institute_id))
with check (public.is_institute_staff(institute_id));

-- ------------------------------------------------------- SaaS payment events (Razorpay webhooks, idempotent)
create table if not exists public.saas_payment_events (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text,
  amount numeric(10, 2),
  status text not null default 'received',
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.saas_payment_events enable row level security;
drop policy if exists "Staff view saas payments" on public.saas_payment_events;
create policy "Staff view saas payments"
on public.saas_payment_events for select to authenticated
using (institute_id is null or public.is_institute_staff(institute_id));

NOTIFY pgrst, 'reload schema';
