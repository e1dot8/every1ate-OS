import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";

type Base = { name: string; label: string; error?: string; hint?: string; required?: boolean };

function Describe({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={`${id}-erreur`} className="text-sm text-danger">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-aide`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    );
  return null;
}

export function SelectField({
  name,
  label,
  error,
  hint,
  required,
  options,
  defaultValue,
}: Base & { options: { value: string; label: string }[]; defaultValue?: string }) {
  const id = `champ-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : hint ? `${id}-aide` : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Describe id={id} error={error} hint={hint} />
    </div>
  );
}

export function TextareaField({
  name,
  label,
  error,
  hint,
  required,
  defaultValue,
  rows = 3,
}: Base & { defaultValue?: string; rows?: number }) {
  const id = `champ-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : hint ? `${id}-aide` : undefined}
      />
      <Describe id={id} error={error} hint={hint} />
    </div>
  );
}

export function CheckboxGroup({
  name,
  label,
  options,
  defaultValues = [],
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValues?: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-tap items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="size-5 accent-[var(--ink)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
