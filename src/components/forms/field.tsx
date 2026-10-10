import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  readOnly?: boolean;
  required?: boolean;
};

/** Champ de formulaire accessible : libellé, aide et erreur reliés au champ. */
export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  hint,
  autoComplete,
  readOnly,
  required = true,
}: FieldProps) {
  const id = `champ-${name}`;
  const describedBy = error ? `${id}-erreur` : hint ? `${id}-aide` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        readOnly={readOnly}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={readOnly ? "bg-muted" : undefined}
      />
      {error ? (
        <p id={`${id}-erreur`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-aide`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
