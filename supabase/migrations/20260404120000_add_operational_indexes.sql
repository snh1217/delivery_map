create index if not exists idx_route_runs_phone_created_at
on public.route_runs (phone, created_at desc);

create index if not exists idx_login_logs_phone_created_at
on public.login_logs (phone, created_at desc);

create index if not exists idx_signup_requests_status_created_at
on public.signup_requests (status, created_at desc);

create index if not exists idx_development_requests_owner_created_at
on public.development_requests (owner_phone, created_at desc);

create index if not exists idx_development_requests_status_created_at
on public.development_requests (status, created_at desc);

create index if not exists idx_call_time_estimates_phone_created_at
on public.call_time_estimates (phone, created_at desc);
