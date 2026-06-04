import { type UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Form primitives used by both OnboardUserDialog and ManageUserAccessDialog.
// Lives here (rather than inside either dialog) so changing the field/group
// look is one edit, not two.

export function Field({
  id,
  label,
  type = "text",
  register,
  error,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} {...register} />
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function CheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2">
        {options.length === 0 && (
          <p className="col-span-2 px-1 py-2 text-xs text-muted-foreground">
            No options available.
          </p>
        )}
        {options.map((opt) => {
          const id = `${label}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
            >
              <Checkbox
                id={id}
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function toggleArrayValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>,
  path: string,
  value: string,
) {
  const current = (form.getValues(path) as string[] | undefined) ?? [];
  form.setValue(
    path,
    current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value],
    { shouldDirty: true, shouldValidate: false },
  );
}
