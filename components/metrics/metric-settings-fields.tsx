import {
  NUMBER_KINDS,
  BOOLEAN_PRESETS,
  DURATION_FORMATS,
  TEXT_FORMATS,
  DATETIME_FORMATS,
  SELECTION_MODES,
  FILE_KINDS,
} from '@/lib/metrics/data-types'

type MetricSettingsFieldsProps = {
  dataType: string
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
  disabled?: boolean
  idPrefix: string
}

const HUMAN_LABELS: Record<string, string> = {
  // number kinds
  integer: 'Integer',
  decimal: 'Decimal',
  // boolean presets
  yes_no: 'Yes / No',
  true_false: 'True / False',
  active_inactive: 'Active / Inactive',
  qualified_not_qualified: 'Qualified / Not Qualified',
  completed_not_completed: 'Completed / Not Completed',
  // duration formats
  hh_mm_ss: 'hh:mm:ss',
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  // text formats
  short_text: 'Short text',
  long_text: 'Long text',
  email: 'Email',
  phone: 'Phone',
  url: 'URL',
  // datetime formats
  date: 'Date',
  datetime: 'Date & Time',
  time: 'Time',
  // selection modes
  single: 'Single select',
  multi: 'Multi select',
  radio: 'Radio buttons',
  // file kinds
  file: 'File',
  image: 'Image',
}

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BRL'] as const

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
const textareaClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {HUMAN_LABELS[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}

export function MetricSettingsFields({ dataType, settings, onChange, disabled, idPrefix }: MetricSettingsFieldsProps) {
  function set(key: string, value: unknown) {
    onChange({ ...settings, [key]: value })
  }

  if (dataType === 'number') {
    return (
      <SelectField
        id={`${idPrefix}-number-kind`}
        label="Number kind"
        value={(settings.numberKind as string) || 'integer'}
        options={NUMBER_KINDS}
        onChange={(v) => set('numberKind', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'currency') {
    return (
      <SelectField
        id={`${idPrefix}-currency-code`}
        label="Currency"
        value={(settings.currencyCode as string) || 'USD'}
        options={CURRENCY_CODES}
        onChange={(v) => set('currencyCode', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'boolean') {
    return (
      <SelectField
        id={`${idPrefix}-boolean-preset`}
        label="Display format"
        value={(settings.booleanPreset as string) || 'yes_no'}
        options={BOOLEAN_PRESETS}
        onChange={(v) => set('booleanPreset', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'text') {
    return (
      <SelectField
        id={`${idPrefix}-text-format`}
        label="Text format"
        value={(settings.textFormat as string) || 'short_text'}
        options={TEXT_FORMATS}
        onChange={(v) => set('textFormat', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'duration') {
    return (
      <SelectField
        id={`${idPrefix}-duration-format`}
        label="Duration format"
        value={(settings.durationFormat as string) || 'hh_mm_ss'}
        options={DURATION_FORMATS}
        onChange={(v) => set('durationFormat', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'datetime') {
    return (
      <SelectField
        id={`${idPrefix}-datetime-format`}
        label="Date/time format"
        value={(settings.datetimeFormat as string) || 'date'}
        options={DATETIME_FORMATS}
        onChange={(v) => set('datetimeFormat', v)}
        disabled={disabled}
      />
    )
  }

  if (dataType === 'selection') {
    const optionsText = Array.isArray(settings.selectionOptions)
      ? (settings.selectionOptions as string[]).join('\n')
      : ''

    return (
      <div className="space-y-4">
        <SelectField
          id={`${idPrefix}-selection-mode`}
          label="Selection mode"
          value={(settings.selectionMode as string) || 'single'}
          options={SELECTION_MODES}
          onChange={(v) => set('selectionMode', v)}
          disabled={disabled}
        />
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-selection-options`} className="text-sm font-medium">
            Options (one per line)
          </label>
          <textarea
            id={`${idPrefix}-selection-options`}
            rows={4}
            value={optionsText}
            onChange={(e) => {
              const lines = e.target.value.split('\n').map((l) => l.trimStart())
              set('selectionOptions', lines)
            }}
            disabled={disabled}
            className={textareaClass}
            placeholder={"Option A\nOption B\nOption C"}
          />
        </div>
      </div>
    )
  }

  if (dataType === 'file') {
    return (
      <SelectField
        id={`${idPrefix}-file-kind`}
        label="File kind"
        value={(settings.fileKind as string) || 'file'}
        options={FILE_KINDS}
        onChange={(v) => set('fileKind', v)}
        disabled={disabled}
      />
    )
  }

  // percentage and others: no sub-options
  return null
}
