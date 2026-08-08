import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Plus, Search } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { hexA, paramLabel, type CatalogItem, type ParamOption } from "./data";

// The Start-a-treatment dropdown, CRUD-capable (treatment_stability.md
// decision #13; wireframe states A–F). Pick a product to start, or add,
// rename, retire, restore and delete products without leaving it. The
// dropdown only ever touches the catalogue — never the courses.
// `value` and every handler key off the treatment id; targets are
// parameter codes (target_parameters on the wire).

interface Props {
  catalog: CatalogItem[];
  /** The project's configured parameters — the pickable watched readings. */
  paramOptions: ParamOption[];
  value: string;
  usedCount: (id: string) => number;
  onPick: (id: string) => void;
  onAdd: (name: string, targets: string[], price: number, priceUnit: "kg" | "l") => Promise<string | null>;
  onSave: (id: string, name: string, targets: string[], price: number, priceUnit: "kg" | "l") => void;
  onRetire: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; id: string };

export function TreatmentPicker({ catalog, paramOptions, value, usedCount, onPick, onAdd, onSave, onRetire, onRestore, onDelete }: Props) {
  const theme = useProfileTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [formName, setFormName] = useState("");
  const [formTargets, setFormTargets] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState("");
  const [formPriceUnit, setFormPriceUnit] = useState<"kg" | "l">("kg");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => {
    setOpen(false);
    setQuery("");
    setMode({ kind: "list" });
    setConfirmingDelete(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const active = catalog.filter((c) => c.active && (!q || c.name.toLowerCase().includes(q)));
  const retired = catalog.filter((c) => !c.active && (!q || c.name.toLowerCase().includes(q)));
  const exactMatch = catalog.some((c) => c.name.toLowerCase() === q);

  const openAdd = () => {
    setFormName(query.trim());
    setFormTargets([]);
    setFormPrice("");
    setFormPriceUnit("kg");
    setMode({ kind: "add" });
    setConfirmingDelete(false);
  };
  const openEdit = (c: CatalogItem) => {
    setFormName(c.name);
    setFormTargets(c.targets);
    setFormPrice(c.price > 0 ? String(c.price) : "");
    setFormPriceUnit(c.priceUnit);
    setMode({ kind: "edit", id: c.id });
    setConfirmingDelete(false);
  };

  const toggleTarget = (p: string) =>
    setFormTargets((ts) => (ts.includes(p) ? ts.filter((t) => t !== p) : [...ts, p]));

  const nameClash = catalog.some(
    (c) => c.name.toLowerCase() === formName.trim().toLowerCase() && !(mode.kind === "edit" && c.id === mode.id),
  );
  const priceInvalid = formPrice !== "" && (Number.isNaN(Number(formPrice)) || Number(formPrice) < 0);
  const formInvalid = !formName.trim() || formTargets.length === 0 || nameClash || priceInvalid;

  const submitForm = async () => {
    const price = formPrice ? Number(formPrice) : 0;
    if (mode.kind === "add") {
      const id = await onAdd(formName.trim(), formTargets, price, formPriceUnit);
      if (id) onPick(id);
    } else if (mode.kind === "edit") {
      onSave(mode.id, formName.trim(), formTargets, price, formPriceUnit);
    }
    close();
  };

  const editing = mode.kind === "edit" ? catalog.find((c) => c.id === mode.id) : undefined;
  const editingUsed = editing ? usedCount(editing.id) : 0;

  // The project's parameters, plus any code this product already declares
  // that the project no longer configures — still visible and removable.
  const chipOptions: ParamOption[] = [
    ...paramOptions,
    ...formTargets
      .filter((code) => !paramOptions.some((o) => o.code === code))
      .map((code) => ({ code, label: paramLabel(code) })),
  ];

  const renderForm = () => (
    <div>
      <div className="flex flex-col gap-2.5 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Name</span>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Product name"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </label>
        {nameClash && <p className="text-[11px] font-semibold text-red-600">A product with this name already exists.</p>}
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Price for 1 {formPriceUnit}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder="0.00"
              className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </label>
          <div className="flex flex-none gap-1.5 pb-1">
            {(["kg", "l"] as const).map((u) => {
              const on = formPriceUnit === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFormPriceUnit(u)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${on ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                  style={on ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                >
                  per {u}
                </button>
              );
            })}
          </div>
        </div>
        {priceInvalid && <p className="text-[11px] font-semibold text-red-600">The price can't be negative.</p>}
        <div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Watches which readings?</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chipOptions.map((p) => {
              const on = formTargets.includes(p.code);
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => toggleTarget(p.code)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${on ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                  style={on ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {formTargets.length === 0 && <p className="mt-1.5 text-[10.5px] text-gray-500">Pick at least one.</p>}
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => { setMode({ kind: "list" }); setConfirmingDelete(false); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="button" onClick={submitForm} disabled={formInvalid} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50" style={{ backgroundColor: theme.primary }}>
            {mode.kind === "add" ? "Add product" : "Save"}
          </button>
        </div>
      </div>

      {mode.kind === "edit" && editing && (
        <div className="border-t border-gray-100 p-3">
          {confirmingDelete ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
              <p className="text-[11px] text-red-900"><span className="font-bold">Remove {editing.name} for good?</span> No course anywhere used it, so nothing else changes.</p>
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={() => { onDelete(editing.id); close(); }} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white">Yes, remove it</button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Keep it</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {editing.active ? (
                  <button type="button" onClick={() => { onRetire(editing.id); close(); }} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">Retire</button>
                ) : (
                  <button type="button" onClick={() => { onRestore(editing.id); close(); }} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">Restore</button>
                )}
                <button
                  type="button"
                  disabled={editingUsed > 0}
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-gray-500">
                {editingUsed > 0
                  ? `Delete is locked because ${editingUsed} course${editingUsed === 1 ? "" : "s"} on this pond used it. Retire hides it from new courses; all history stays.`
                  : "No course anywhere used it, so delete removes nothing else."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderList = () => (
    <div>
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <Search className="h-3.5 w-3.5 flex-none text-gray-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or add a product"
          className="w-full bg-transparent text-[12.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {active.map((c) => (
          <div key={c.id} className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50" onClick={() => { onPick(c.id); close(); }}>
            <span className="text-[13px] font-bold text-gray-900">{c.name}</span>
            {c.price > 0 && (
              <span className="whitespace-nowrap rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-[8.5px] font-bold tabular-nums text-gray-600">{c.price}/{c.priceUnit}</span>
            )}
            <span className="flex min-w-0 flex-1 gap-1 overflow-hidden">
              {c.targets.length > 0 && (
                <span className="whitespace-nowrap rounded-full border border-gray-200 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-gray-500">{paramLabel(c.targets[0])}</span>
              )}
              {c.targets.length > 1 && <span className="whitespace-nowrap rounded-full border border-gray-200 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-gray-500">+{c.targets.length - 1}</span>}
            </span>
            <button
              type="button"
              title="Edit this product"
              onClick={(e) => { e.stopPropagation(); openEdit(c); }}
              className="rounded-md border border-gray-200 p-1 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ))}
        {q && !exactMatch && (
          <button
            type="button"
            onClick={openAdd}
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-left text-[12.5px] font-bold"
            style={{ borderColor: hexA(theme.primary, 0.5), backgroundColor: hexA(theme.primary, 0.06), color: theme.primary }}
          >
            <Plus className="h-3.5 w-3.5" /> Add "{query.trim()}" as a new product
          </button>
        )}
        {retired.length > 0 && (
          <>
            <div className="px-2 pb-0.5 pt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">Retired · {retired.length}</div>
            {retired.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="text-[13px] font-semibold text-gray-400">{c.name}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => openEdit(c)} title="Edit this product" className="rounded-md border border-gray-200 p-1 text-gray-400 hover:text-gray-600">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => { onRestore(c.id); }} className="font-mono text-[10px] font-bold" style={{ color: theme.primary }}>
                  Restore
                </button>
              </div>
            ))}
          </>
        )}
        {active.length === 0 && retired.length === 0 && !q && (
          <p className="px-2 py-3 text-[12px] text-gray-500">No products yet. Type a name to add the first one.</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-[11.5px] font-semibold" style={{ color: theme.primary }}>
        <Plus className="h-3.5 w-3.5" /> Type a name that isn't in the list to add it
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={`flex h-8 w-full items-center justify-between rounded-lg border bg-white px-2.5 text-xs ${value ? "font-bold text-gray-900" : "text-gray-500"} ${open ? "" : "border-gray-200 hover:border-gray-300"}`}
        style={open ? { borderColor: theme.primary, boxShadow: `0 0 0 1px ${theme.primary}` } : undefined}
      >
        {catalog.find((c) => c.id === value)?.name || "Treatment"}
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {mode.kind === "list" ? renderList() : renderForm()}
        </div>
      )}
    </div>
  );
}
