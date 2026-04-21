-- Transactional daily-log save: entry upsert + value replacement in one boundary.
-- Eliminates partial-failure scenarios where entry saves but values are lost.

create or replace function public.save_daily_log_entry(
  p_entry_id      uuid,        -- null → insert, non-null → update by id
  p_company_id    uuid,
  p_department_id uuid,
  p_user_id       uuid,
  p_entry_date    date,
  p_status        text,
  p_submitted_at  timestamptz,
  p_notes         text,
  p_values        jsonb        -- [{metric_id, value_numeric, value_text, value_bool}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  -- 1. Entry upsert
  if p_entry_id is not null then
    update daily_entries set
      entry_date   = p_entry_date,
      status       = p_status,
      submitted_at = p_submitted_at,
      notes        = p_notes,
      updated_at   = now()
    where entry_id  = p_entry_id
      and company_id = p_company_id
    returning entry_id into v_entry_id;

    if v_entry_id is null then
      raise exception 'Entry not found or does not belong to this company.';
    end if;
  else
    insert into daily_entries (
      company_id, department_id, user_id, entry_date,
      status, submitted_at, notes, updated_at
    ) values (
      p_company_id, p_department_id, p_user_id, p_entry_date,
      p_status, p_submitted_at, p_notes, now()
    )
    on conflict (company_id, department_id, user_id, entry_date)
    do update set
      status       = excluded.status,
      submitted_at = excluded.submitted_at,
      notes        = excluded.notes,
      updated_at   = now()
    returning entry_id into v_entry_id;
  end if;

  -- 2. Clear all old values (manual + calculated) for a clean slate
  delete from entry_values     where entry_id = v_entry_id;
  delete from calculated_values where entry_id = v_entry_id;

  -- 3. Insert new manual values
  if p_values is not null and jsonb_array_length(p_values) > 0 then
    insert into entry_values (
      entry_id, metric_id, value_numeric, value_text, value_bool, value_source
    )
    select
      v_entry_id,
      (v->>'metric_id')::uuid,
      (v->>'value_numeric')::numeric,
      nullif(v->>'value_text', ''),
      (v->>'value_bool')::boolean,
      'manual'
    from jsonb_array_elements(p_values) as v;
  end if;

  return v_entry_id;
end;
$$;
