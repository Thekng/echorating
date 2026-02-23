begin;

alter table public.metrics
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.metrics
  drop constraint if exists metrics_data_type_check;

alter table public.metrics
  add constraint metrics_data_type_check
  check (
    data_type in (
      'number',
      'currency',
      'percent',
      'boolean',
      'duration',
      'text',
      'datetime',
      'selection',
      'file'
    )
  );

comment on column
commit;
 public.metrics.settings is
  'Typed configuration per data_type: numberKind, booleanPreset, durationFormat, textFormat, datetimeFormat, selection options, fileKind.';
