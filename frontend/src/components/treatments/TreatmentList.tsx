import { useEffect, useRef, useState } from "react";
import { ChevronDown, OctagonPause, Pencil } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { Input } from "../ui/input";
import { courseDays, courseRange, doseLabel, DOSE_UNITS, hexA, isOngoing, type CatalogItem, type Course, type ParamOption } from "./data";
import { TreatmentPicker } from "./TreatmentPicker";

// Master column: pond picker (same native-select format as Digital Twin /
// Forecast / Historical), the always-visible start-a-treatment entry, then
// the selectable Ongoing and Past course lists. Selecting a card feeds the
// stability analysis on the right; start / stop / edit / delete call the
// real course API through the container since 28 Jul 2026.

const SCROLL_AFTER = 4;

export interface PondOption {
  id: string;
  name: string;
}

interface Props {
  ponds: PondOption[];
  pondId: string | null;
  onPondChange: (pondId: string) => void;
  courses: Course[];
  catalog: CatalogItem[];
  paramOptions: ParamOption[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  selCount: number;
  todayIso: string;
  justAddedId: string | null;
  onAdd: (treatmentId: string, start: string, amount: string, unit: string) => void;
  onStop: (id: string) => void;
  onSave: (id: string, start: string, end: string, amount: string, unit: string) => void;
  onDelete: (id: string) => void;
  onCatalogAdd: (name: string, targets: string[], price: number, priceUnit: "kg" | "l") => Promise<string | null>;
  onCatalogSave: (id: string, name: string, targets: string[], price: number, priceUnit: "kg" | "l") => void;
  onCatalogRetire: (id: string) => void;
  onCatalogRestore: (id: string) => void;
  onCatalogDelete: (id: string) => void;
}

interface EditorState {
  id: string;
  start: string;
  end: string;
  amount: string;
  unit: string;
}

// Same look and behavior as the treatment dropdown's trigger + menu, sized
// for the short unit list.
function UnitSelect({ value, options, onChange, className = "w-16", buttonClassName = "h-8" }: { value: string; options: string[]; onChange: (u: string) => void; className?: string; buttonClassName?: string }) {
  const theme = useProfileTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative flex-none ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex ${buttonClassName} w-full items-center justify-between rounded-lg border bg-white px-2.5 text-xs font-bold text-gray-900 ${open ? "" : "border-gray-200 hover:border-gray-300"}`}
        style={open ? { borderColor: theme.primary, boxShadow: `0 0 0 1px ${theme.primary}` } : undefined}
      >
        {value}
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          {options.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => { onChange(u); setOpen(false); }}
              className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-gray-50 ${u === value ? "font-bold" : "font-semibold text-gray-700"}`}
              style={u === value ? { color: theme.primary } : undefined}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TreatmentList({ ponds, pondId, onPondChange, courses, catalog, paramOptions, selected, onToggle, selCount, todayIso, justAddedId, onAdd, onStop, onSave, onDelete, onCatalogAdd, onCatalogSave, onCatalogRetire, onCatalogRestore, onCatalogDelete }: Props) {
  const theme = useProfileTheme();
  const [draftTreatmentId, setDraftTreatmentId] = useState("");
  const [draftStart, setDraftStart] = useState(todayIso);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftUnit, setDraftUnit] = useState("kg");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const ongoing = courses.filter(isOngoing);
  const past = courses.filter((c) => !isOngoing(c));

  const unitsFor = (treatmentId: string): string[] =>
    DOSE_UNITS[catalog.find((t) => t.id === treatmentId)?.priceUnit ?? "kg"];

  const pickDraftTreatment = (id: string) => {
    setDraftTreatmentId(id);
    const units = unitsFor(id);
    if (!units.includes(draftUnit)) setDraftUnit(units[units.length - 1]);
  };

  const startDraft = () => {
    onAdd(draftTreatmentId, draftStart, draftAmount, draftUnit);
    setDraftTreatmentId("");
    setDraftStart(todayIso);
    setDraftAmount("");
    setDraftUnit("kg");
  };

  const openEditor = (c: Course) => {
    setEditor({
      id: c.id,
      start: c.start,
      end: c.end ?? "",
      amount: c.amount != null ? String(c.amount) : "",
      unit: c.unit ?? unitsFor(c.treatmentId).at(-1)!,
    });
    setConfirmingDelete(false);
  };
  const closeEditor = () => {
    setEditor(null);
    setConfirmingDelete(false);
  };
  const saveEditor = () => {
    if (!editor) return;
    onSave(editor.id, editor.start, editor.end, editor.amount, editor.unit);
    closeEditor();
  };
  const editorInvalid = !!editor && (!editor.start || (!!editor.end && editor.end < editor.start));

  const renderEditor = () => {
    if (!editor) return null;
    return (
      <div className="rounded-xl border p-2.5" style={{ borderColor: hexA(theme.primary, 0.5), backgroundColor: hexA(theme.primary, 0.06) }}>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Started</span>
            <Input type="date" max={todayIso} value={editor.start} onChange={(e) => setEditor((s) => (s ? { ...s, start: e.target.value } : s))} className="h-8 bg-white text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Ended</span>
            <Input type="date" max={todayIso} value={editor.end} onChange={(e) => setEditor((s) => (s ? { ...s, end: e.target.value } : s))} className="h-8 bg-white text-xs" />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Amount used</span>
            <Input type="number" min="0" step="any" placeholder="e.g. 40" value={editor.amount} onChange={(e) => setEditor((s) => (s ? { ...s, amount: e.target.value } : s))} className="h-8 bg-white text-xs" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Unit</span>
            <UnitSelect
              value={editor.unit}
              options={unitsFor(courses.find((c) => c.id === editor.id)?.treatmentId ?? "")}
              onChange={(u) => setEditor((s) => (s ? { ...s, unit: u } : s))}
            />
          </div>
        </div>
        {editorInvalid && <p className="mt-1.5 text-[11px] font-semibold text-red-600">End date can't be before the start date.</p>}
        {confirmingDelete ? (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
            <p className="text-[11px] text-red-900"><span className="font-bold">Remove this treatment record for good?</span> It can't be brought back.</p>
            <div className="mt-1.5 flex gap-1.5">
              <button type="button" onClick={() => { onDelete(editor.id); closeEditor(); }} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white">Yes, remove it</button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Keep it</button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50">Delete</button>
            <span className="flex-1" />
            <button type="button" onClick={closeEditor} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
            <button type="button" onClick={saveEditor} disabled={editorInvalid} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60" style={{ backgroundColor: theme.primary }}>Save</button>
          </div>
        )}
      </div>
    );
  };

  const renderCourse = (c: Course) => {
    if (editor?.id === c.id) return <div key={c.id}>{renderEditor()}</div>;
    const on = !!selected[c.id];
    const active = isOngoing(c);
    return (
      <div
        key={c.id}
        role="button"
        tabIndex={0}
        onClick={() => onToggle(c.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle(c.id);
        }}
        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white p-2.5 text-left ${on ? "" : "border-gray-200 hover:border-gray-300"} ${c.id === justAddedId ? "animate-in fade-in slide-in-from-top-3 duration-300 motion-reduce:animate-none" : ""}`}
        style={on ? { borderColor: theme.primary, boxShadow: `0 0 0 1px ${theme.primary}` } : undefined}
      >
        <span
          className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded border text-[11px] font-extrabold ${on ? "text-white" : "border-gray-300"}`}
          style={on ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
        >{on ? "✓" : ""}</span>
        <span className="min-w-0 flex-1">
          <span className="text-[13.5px] font-bold text-gray-900">{c.name}</span>
          {active && (
            <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[9px] font-semibold tracking-wide text-teal-600"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" />ONGOING</span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-gray-700">{courseRange(c, todayIso)}</span>
            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-bold tabular-nums ${active ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "bg-gray-100 text-gray-600"}`}>
              {courseDays(c, todayIso)} days
            </span>
            {doseLabel(c) && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tabular-nums text-gray-600">
                {doseLabel(c)}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-none items-center gap-1">
          {active && (
            <button
              type="button"
              title="Stop this treatment today"
              onClick={(e) => {
                e.stopPropagation();
                onStop(c.id);
              }}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              <OctagonPause className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            title="Edit dates or delete"
            onClick={(e) => {
              e.stopPropagation();
              openEditor(c);
            }}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:border-gray-400 hover:text-gray-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  };

  const groupBadge = (n: number, tone: "teal" | "gray") => (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums ${tone === "teal" ? "bg-teal-100 text-teal-800" : "bg-gray-200 text-gray-700"}`}>{n}</span>
  );

  return (
    <aside className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 p-4 lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">Analyse pond</span>
        <select
          value={pondId ?? ""}
          onChange={(e) => onPondChange(e.target.value)}
          className="w-full rounded-lg border-2 bg-white px-4 py-2 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2"
          style={{ borderColor: theme.primary }}
        >
          {ponds.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-2.5">
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">Start a treatment</p>
        <TreatmentPicker
          catalog={catalog}
          paramOptions={paramOptions}
          value={draftTreatmentId}
          usedCount={(id) => courses.filter((c) => c.treatmentId === id).length}
          onPick={pickDraftTreatment}
          onAdd={onCatalogAdd}
          onSave={onCatalogSave}
          onRetire={onCatalogRetire}
          onRestore={onCatalogRestore}
          onDelete={onCatalogDelete}
        />
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Amount used"
            value={draftAmount}
            onChange={(e) => setDraftAmount(e.target.value)}
            className="h-9 flex-1 text-xs"
          />
          <UnitSelect
            value={draftUnit}
            options={draftTreatmentId ? unitsFor(draftTreatmentId) : [...DOSE_UNITS.kg, ...DOSE_UNITS.l]}
            onChange={setDraftUnit}
            className="w-20"
            buttonClassName="h-9"
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input type="date" max={todayIso} value={draftStart} onChange={(e) => setDraftStart(e.target.value)} className="h-9 flex-1 text-xs" />
          <button type="button" onClick={startDraft} disabled={!draftTreatmentId || !draftStart} className="h-9 rounded-lg px-5 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: theme.primary }}>Start</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">Select for analysis</span>
        <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white" style={{ backgroundColor: theme.primary }}>{selCount} selected</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">Ongoing</span>
          {groupBadge(ongoing.length, "teal")}
        </div>
        <div className={ongoing.length > SCROLL_AFTER ? "flex max-h-[21rem] flex-col gap-2 overflow-y-auto pr-1" : "flex flex-col gap-2"}>
          {ongoing.map(renderCourse)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">Past</span>
          {groupBadge(past.length, "gray")}
        </div>
        <div className={past.length > SCROLL_AFTER ? "flex max-h-[21rem] flex-col gap-2 overflow-y-auto pr-1" : "flex flex-col gap-2"}>
          {past.map(renderCourse)}
        </div>
      </div>
    </aside>
  );
}
