import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Plus, Search } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { apiService } from "../../services/api.service";
import { hexA } from "./stageBandsPlugin";
import type { FeedTypeRecord } from "./types";

/**
 * The composer's feed-type dropdown, CRUD-capable (feeding_backend.md ·
 * Feed type CRUD on the page, superseded to in-dropdown 27 Jul 2026).
 * Pick a type for the feeding row, or add / rename / retire / restore /
 * delete types without leaving it — wired to /api/feed-types/. Deleting
 * a type used by feed logs is blocked by the backend; the message shows
 * inline and Retire stays the way out. Past feedings are safe either
 * way: feed logs snapshot pack prices at write time.
 */

interface Props {
  projectId: string;
  value: string;
  valueName: string;
  onPick: (feedTypeId: string) => void;
  onTypesChanged: () => void;
}

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; id: string };

interface Draft {
  name: string;
  packKg: string;
  packPrice: string;
}

function firstError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return "Could not save. Try again.";
}

export function FeedTypePicker({ projectId, value, valueName, onPick, onTypesChanged }: Props) {
  const theme = useProfileTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<FeedTypeRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [draft, setDraft] = useState<Draft>({ name: "", packKg: "", packPrice: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTypes(await apiService.getFeedTypes(projectId));
    } catch {
      setTypes([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setMode({ kind: "list" });
    setFormError(null);
    setRowError(null);
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
  const all = types ?? [];
  const active = all.filter((t) => t.active && (!q || t.name.toLowerCase().includes(q)));
  const retired = all.filter((t) => !t.active && (!q || t.name.toLowerCase().includes(q)));
  const exactMatch = all.some((t) => t.name.toLowerCase() === q);

  const openAdd = () => {
    setDraft({ name: query.trim(), packKg: "", packPrice: "" });
    setMode({ kind: "add" });
    setFormError(null);
  };
  const openEdit = (t: FeedTypeRecord) => {
    setDraft({ name: t.name, packKg: String(t.pack_kg), packPrice: String(t.pack_price) });
    setMode({ kind: "edit", id: t.feed_type_id });
    setFormError(null);
    setRowError(null);
    setConfirmingDelete(false);
  };

  const draftInvalid = !draft.name.trim() || !(parseFloat(draft.packKg) > 0) || !(parseFloat(draft.packPrice) >= 0);

  const submitForm = async () => {
    setBusy(true);
    try {
      const body = { name: draft.name.trim(), pack_kg: draft.packKg, pack_price: draft.packPrice };
      if (mode.kind === "add") {
        const created = await apiService.createFeedType({ project: projectId, ...body });
        setTypes((prev) => (prev ? [...prev, created] : [created]));
        onPick(created.feed_type_id);
        onTypesChanged();
        close();
      } else if (mode.kind === "edit") {
        await apiService.updateFeedType(mode.id, body);
        onTypesChanged();
        close();
      }
    } catch (err) {
      setFormError(firstError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (t: FeedTypeRecord) => {
    setBusy(true);
    try {
      await apiService.updateFeedType(t.feed_type_id, { active: !t.active });
      await load();
      onTypesChanged();
      setMode({ kind: "list" });
    } catch (err) {
      setRowError(firstError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteType = async (t: FeedTypeRecord) => {
    setBusy(true);
    setConfirmingDelete(false);
    try {
      await apiService.deleteFeedType(t.feed_type_id);
      await load();
      onTypesChanged();
      setMode({ kind: "list" });
    } catch (err) {
      setRowError(firstError(err));
    } finally {
      setBusy(false);
    }
  };

  const editing = mode.kind === "edit" ? all.find((t) => t.feed_type_id === mode.id) : undefined;

  const renderForm = () => (
    <div>
      <div className="flex flex-col gap-2.5 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Grower Pellet 3mm"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Pack size · kg</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={draft.packKg}
              onChange={(e) => setDraft((d) => ({ ...d, packKg: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Pack price · S$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.packPrice}
              onChange={(e) => setDraft((d) => ({ ...d, packPrice: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </label>
        </div>
        {formError && <p className="text-[11px] font-semibold text-red-600">{formError}</p>}
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => { setMode({ kind: "list" }); setFormError(null); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
          <button type="button" onClick={submitForm} disabled={draftInvalid || busy} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50" style={{ backgroundColor: theme.primary }}>
            {mode.kind === "add" ? "Add feed type" : "Save"}
          </button>
        </div>
      </div>

      {mode.kind === "edit" && editing && (
        <div className="border-t border-gray-100 p-3">
          {confirmingDelete ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
              <p className="text-[11px] text-red-900"><span className="font-bold">Remove {editing.name} for good?</span> Days already fed with it keep their history.</p>
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={() => deleteType(editing)} disabled={busy} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">Yes, remove it</button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700">Keep it</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {editing.active ? (
                  <button type="button" onClick={() => toggleActive(editing)} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 disabled:opacity-60">Retire</button>
                ) : (
                  <button type="button" onClick={() => toggleActive(editing)} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 disabled:opacity-60">Restore</button>
                )}
                <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 disabled:opacity-60">Delete</button>
              </div>
              {rowError ? (
                <p className="mt-2 text-[10.5px] font-semibold leading-relaxed text-amber-700">{rowError}</p>
              ) : (
                <p className="mt-2 text-[10.5px] leading-relaxed text-gray-500">Delete only works while no feeding ever used it. Retire hides it from new feedings; history stays.</p>
              )}
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
          placeholder="Search or add a feed type"
          className="w-full bg-transparent text-[12.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {types === null && <p className="px-2 py-3 text-[12px] text-gray-500">Loading feed types…</p>}
        {active.map((t) => (
          <div key={t.feed_type_id} className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50" onClick={() => { onPick(t.feed_type_id); close(); }}>
            <span className="text-[13px] font-bold text-gray-900">{t.name}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-bold tabular-nums" style={{ backgroundColor: hexA(theme.primary, 0.1), color: theme.primary }}>{parseFloat(String(t.pack_kg))} kg</span>
              <span className="whitespace-nowrap rounded-full bg-green-50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tabular-nums text-green-700 ring-1 ring-green-200">S$ {parseFloat(String(t.pack_price)).toFixed(2)}</span>
            </span>
            <button
              type="button"
              title="Edit this feed type"
              onClick={(e) => { e.stopPropagation(); openEdit(t); }}
              className="rounded-md border border-gray-200 p-1 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ))}
        {q && !exactMatch && types !== null && (
          <button
            type="button"
            onClick={openAdd}
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-left text-[12.5px] font-bold"
            style={{ borderColor: hexA(theme.primary, 0.5), backgroundColor: hexA(theme.primary, 0.06), color: theme.primary }}
          >
            <Plus className="h-3.5 w-3.5" /> Add "{query.trim()}" as a new feed type
          </button>
        )}
        {retired.length > 0 && (
          <>
            <div className="px-2 pb-0.5 pt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">Retired · {retired.length}</div>
            {retired.map((t) => (
              <div key={t.feed_type_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="text-[13px] font-semibold text-gray-400">{t.name}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => openEdit(t)} title="Edit this feed type" className="rounded-md border border-gray-200 p-1 text-gray-400 hover:text-gray-600">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => toggleActive(t)} disabled={busy} className="font-mono text-[10px] font-bold disabled:opacity-60" style={{ color: theme.primary }}>
                  Restore
                </button>
              </div>
            ))}
          </>
        )}
        {types !== null && active.length === 0 && retired.length === 0 && !q && (
          <p className="px-2 py-3 text-[12px] text-gray-500">No feed types yet. Type a name to add the first one.</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-[11.5px] font-semibold" style={{ color: theme.primary }}>
        <Plus className="h-3.5 w-3.5" /> Type a name that isn't in the list to add it
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between rounded-lg border bg-white px-2.5 text-xs ${valueName || all.some((t) => t.feed_type_id === value) ? "font-semibold text-gray-900" : "text-gray-500"} ${open ? "" : "border-gray-200 hover:border-gray-300"}`}
        style={open ? { borderColor: theme.primary, boxShadow: `0 0 0 1px ${theme.primary}` } : undefined}
      >
        {valueName || all.find((t) => t.feed_type_id === value)?.name || "Feed type"}
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
