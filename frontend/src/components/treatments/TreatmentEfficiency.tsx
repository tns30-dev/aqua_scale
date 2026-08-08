import { useEffect, useState } from "react";
import { apiService } from "../../services/api.service";
import { getCurrentProjectId } from "../../utils/auth";
import { useProfile } from "../../context/ProfileContext";
import { overlapWindow, sortParamOptions, type CatalogItem, type Course, type ParamOption } from "./data";
import { TooltipProvider } from "./Tooltip";
import { TreatmentList, type PondOption } from "./TreatmentList";
import { StabilityPanel } from "./StabilityPanel";
import type { StabRow } from "./data";
import type { PondTreatment, Treatment, TreatmentStabilityResponse } from "../../types";

/**
 * Treatment Stability — wired to the real APIs on 28 Jul 2026
 * (treatment_stability.md; the approved 27 Jul UI, data source swapped).
 *
 * Live data: ponds + catalogue (per project), courses per pond, and the
 * stability/electricity numbers from /api/pond-treatments/stability/.
 * Local UI state: the selection, editor drafts, toggles. The selection
 * still drives the overlap window (rule C) and the in-the-water
 * suggestion client-side — the endpoint recomputes the same window.
 */

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const todayIso = localTodayIso();
const DOSE_UNITS = new Set(["g", "kg", "ml", "l"]);

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function doseUnit(unit: string): "g" | "kg" | "ml" | "l" | null {
  return DOSE_UNITS.has(unit) ? (unit as "g" | "kg" | "ml" | "l") : null;
}

const toCourse = (row: PondTreatment): Course => ({
  id: row.pond_treatment_id,
  treatmentId: row.treatment,
  name: row.treatment_name,
  start: row.started_at,
  end: row.ended_at ?? undefined,
  amount: row.amount != null ? Number(row.amount) : undefined,
  unit: row.unit ?? undefined,
});

const toCatalogItem = (row: Treatment): CatalogItem => ({
  id: row.treatment_id,
  name: row.name,
  targets: row.target_parameters ?? [],
  active: row.is_active,
  price: Number(row.unit_price ?? 0),
  priceUnit: row.price_unit === "l" ? "l" : "kg",
});

export function TreatmentEfficiency() {
  const { currentProfile } = useProfile();
  void currentProfile;
  const projectId = getCurrentProjectId();

  const [ponds, setPonds] = useState<PondOption[]>([]);
  const [pondId, setPondId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [paramOptions, setParamOptions] = useState<ParamOption[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [stab, setStab] = useState<TreatmentStabilityResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const saved = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    Promise.all([
      apiService.getPonds(projectId),
      apiService.getTreatments(projectId),
      apiService.getProjectParameters(projectId),
    ])
      .then(([pondResp, treatments, parameters]) => {
        if (cancelled) return;
        const options = pondResp.ponds.map((p) => ({ id: p.pond_id, name: p.name }));
        setPonds(options);
        setPondId((prev) =>
          prev && options.some((p) => p.id === prev) ? prev : options[0]?.id ?? null,
        );
        setCatalog(treatments.map(toCatalogItem));
        setParamOptions(
          sortParamOptions(parameters.map((p) => ({ code: p.code, label: p.name }))),
        );
      })
      .catch(() => {
        if (!cancelled) setError("The treatments could not be loaded. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (!pondId) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    apiService
      .getPondTreatments(pondId)
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map(toCourse);
        setCourses(mapped);
        setSelected((sel) => {
          const ids = new Set(mapped.map((c) => c.id));
          return Object.fromEntries(Object.entries(sel).filter(([id]) => ids.has(id)));
        });
      })
      .catch(() => {
        if (!cancelled) setError("The treatments could not be loaded. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [pondId, refreshKey]);

  const selectedCourses = courses.filter((c) => selected[c.id]);
  const selectedNames = [...new Set(selectedCourses.map((c) => c.name))];
  const win = overlapWindow(selectedCourses, todayIso);
  const selectionKey = selectedCourses.map((c) => c.id).sort().join(",");

  useEffect(() => {
    if (!pondId || !selectionKey || win === null) {
      setStab(null);
      return;
    }
    let cancelled = false;
    apiService
      .getTreatmentStability(pondId, selectionKey.split(","))
      .then((resp) => {
        if (!cancelled) setStab(resp);
      })
      .catch(() => {
        if (!cancelled) setStab(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pondId, selectionKey, refreshKey]);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const run = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
      saved();
    } catch {
      setError("That didn't save. Check the connection and try again.");
    }
  };

  const addCourse = (treatmentId: string, start: string, amount: string, unit: string) =>
    run(async () => {
      const created = await apiService.startPondTreatment({
        pond: pondId!,
        treatment: treatmentId,
        started_at: start,
        amount: amount ? Number(amount) : null,
        unit: amount ? doseUnit(unit) : null,
      });
      setJustAddedId(created.pond_treatment_id);
    });
  const stopCourse = (id: string) =>
    run(async () => {
      await apiService.updatePondTreatment(id, { ended_at: todayIso });
    });
  const saveCourse = (id: string, start: string, end: string, amount: string, unit: string) =>
    run(async () => {
      await apiService.updatePondTreatment(id, {
        started_at: start,
        ended_at: end || null,
        amount: amount ? Number(amount) : null,
        unit: amount ? doseUnit(unit) : null,
      });
    });
  const deleteCourse = (id: string) =>
    run(async () => {
      await apiService.deletePondTreatment(id);
      setSelected(({ [id]: _dropped, ...rest }) => rest);
    });

  const catalogAdd = async (
    name: string,
    targets: string[],
    price: number,
    priceUnit: "kg" | "l",
  ): Promise<string | null> => {
    setError(null);
    try {
      const created = await apiService.createTreatment({
        project: projectId!,
        name,
        target_parameters: targets,
        unit_price: price,
        price_unit: priceUnit,
      });
      saved();
      return created.treatment_id;
    } catch {
      setError("That didn't save. Check the connection and try again.");
      return null;
    }
  };
  const catalogSave = (id: string, name: string, targets: string[], price: number, priceUnit: "kg" | "l") =>
    run(async () => {
      await apiService.updateTreatment(id, {
        name,
        target_parameters: targets,
        unit_price: price,
        price_unit: priceUnit,
      });
    });
  const catalogRetire = (id: string) =>
    run(async () => {
      await apiService.updateTreatment(id, { is_active: false });
    });
  const catalogRestore = (id: string) =>
    run(async () => {
      await apiService.updateTreatment(id, { is_active: true });
    });
  const catalogDelete = (id: string) =>
    run(async () => {
      await apiService.deleteTreatment(id);
    });

  // Soft suggestion (option 2): unselected courses whose dates overlap the
  // analysis window were also in the water during it. Including them can
  // never empty the window, because each of them overlaps it.
  const missing = win
    ? courses.filter(
        (c) => !selected[c.id] && c.start <= win.end && (c.end ?? todayIso) >= win.start,
      )
    : [];
  const missingNames = [...new Set(missing.map((c) => c.name))];
  const includeAll = () =>
    setSelected((s) => {
      const next = { ...s };
      missing.forEach((c) => { next[c.id] = true; });
      return next;
    });

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Pick a project from the dropdown at the top right to manage treatments.
      </div>
    );
  }

  const pondName = ponds.find((p) => p.id === pondId)?.name ?? "";
  const activeParams: StabRow[] = (stab?.params ?? []).map((p) => ({
    name: p.name, pct: p.pct, safe: p.safe, total: p.total,
  }));
  const badges = Object.fromEntries((stab?.params ?? []).map((p) => [p.name, p.declaredBy]));
  const overall: StabRow | null = stab?.overall
    ? { name: "Overall", ...stab.overall }
    : null;
  const power = stab?.electricity
    ? {
        ...stab.electricity,
        kwh: toNumber(stab.electricity.kwh),
        cost: toNumber(stab.electricity.cost),
        tariff: toNumber(stab.electricity.tariff),
      }
    : null;
  const tcost = stab?.treatmentCost
    ? {
        ...stab.treatmentCost,
        total: toNumber(stab.treatmentCost.total),
        courses: stab.treatmentCost.courses.map((course) => ({
          ...course,
          amount: toNumber(course.amount),
          cost: toNumber(course.cost),
        })),
      }
    : null;

  return (
    <TooltipProvider>
      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[28%_1fr]">
        <TreatmentList
          ponds={ponds}
          pondId={pondId}
          onPondChange={setPondId}
          courses={courses}
          catalog={catalog}
          paramOptions={paramOptions}
          selected={selected}
          onToggle={toggle}
          selCount={selectedCourses.length}
          todayIso={todayIso}
          justAddedId={justAddedId}
          onAdd={addCourse}
          onStop={stopCourse}
          onSave={saveCourse}
          onDelete={deleteCourse}
          onCatalogAdd={catalogAdd}
          onCatalogSave={catalogSave}
          onCatalogRetire={catalogRetire}
          onCatalogRestore={catalogRestore}
          onCatalogDelete={catalogDelete}
        />
        <div className="flex flex-col gap-4 p-5">
          {selectedCourses.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="text-sm text-gray-500">Select a treatment on the left to see how it holds the water stable.</p>
            </div>
          ) : win === null ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="text-sm text-gray-500">These treatments never ran at the same time, so there is no combined period to analyse. Select them one at a time instead.</p>
            </div>
          ) : stab === null ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="text-sm text-gray-500">Checking the water records…</p>
            </div>
          ) : (
            <StabilityPanel
              pond={pondName}
              selectedNames={selectedNames}
              activeParams={activeParams}
              badges={badges}
              overall={overall}
              power={power}
              tcost={tcost}
              window={win}
              todayIso={todayIso}
              missingNames={missingNames}
              onIncludeAll={includeAll}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
