-- Compatibility RPCs for admin configuration screens that still call
-- legacy functions instead of querying the tables directly.

create or replace function public.get_all_areas()
returns table (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  created_by uuid
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.name,
    a.description,
    a.created_at,
    a.created_by
  from public.areas a
  order by a.name;
$$;

create or replace function public.get_all_communities()
returns table (
  id uuid,
  name text,
  area_id uuid,
  created_at timestamptz,
  created_by uuid
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.area_id,
    c.created_at,
    c.created_by
  from public.communities c
  order by c.name;
$$;

revoke all on function public.get_all_areas() from public;
revoke all on function public.get_all_communities() from public;

grant execute on function public.get_all_areas() to authenticated;
grant execute on function public.get_all_communities() to authenticated;
