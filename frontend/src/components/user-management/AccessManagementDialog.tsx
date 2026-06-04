import { useEffect, useState } from "react";

import { apiService } from "../../services/api.service";
import type {
  // ActionControl,
  // FeatureAccess,
  // FeatureActionAssigned,
  Project,
  UserAccess,
} from "../../types";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";

import { CheckboxGroup } from "./shared";

type Props = {
  /** Non-null = open this dialog for that user; null = closed. */
  userId: string | null;
  // features: FeatureAccess[];
  // actionControls: ActionControl[];
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
};

// type PopupDraft = { selected: string[] };

/**
 * Access Management dialog (Part 3 — Phase 8, revised UX).
 *
 * Feature/Action access controls are HIDDEN (commented out) per consultant
 * direction — see user_mgmt_reference/control_hide.md §B. The dialog now
 * manages project assignments only. Re-enable by un-commenting the blocks below.
 */
export function AccessManagementDialog({
  userId,
  // features,
  // actionControls,
  projects,
  onClose,
  onSuccess,
}: Props) {
  const [user, setUser] = useState<UserAccess | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  // const [selectedFeatureCodes, setSelectedFeatureCodes] = useState<string[]>([]);
  // const [activeFeatureCode, setActiveFeatureCode] = useState<string | null>(
  //   null,
  // );
  // // Per-feature action ticks — survives focus switches.
  // const [tickedActionsByFeature, setTickedActionsByFeature] = useState<
  //   Record<string, string[]>
  // >({});

  // const [popupDraft, setPopupDraft] = useState<PopupDraft | null>(null);
  // const popupOpen = popupDraft !== null;

  // Hydrate from the existing access record.
  useEffect(() => {
    if (!userId) {
      setUser(null);
      setApiError(null);
      setSelectedProjectIds([]);
      // setSelectedFeatureCodes([]);
      // setActiveFeatureCode(null);
      // setTickedActionsByFeature({});
      // setPopupDraft(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setApiError(null);
        const access = await apiService.getUserAccess(userId);
        if (cancelled) return;
        setUser(access);
        setSelectedProjectIds(access.projects.map((p) => p.projectId));

        /* feature/action hydration — hidden
        const arr: FeatureActionAssigned = access.featureActionAssigned ?? [];
        const isWildcard =
          arr.length > 0 && arr.some((e) => e.feature_access === "*");
        if (isWildcard) {
          // Sentinel collapses to: every feature granted, every action ticked.
          setSelectedFeatureCodes(features.map((f) => f.code));
          const ticks: Record<string, string[]> = {};
          for (const f of features) {
            ticks[f.code] = actionControls
              .filter((a) => a.featureAccessId === f.featureAccessId)
              .map((a) => a.code);
          }
          setTickedActionsByFeature(ticks);
          setActiveFeatureCode(features[0]?.code ?? null);
        } else {
          const grantedCodes = arr.map((e) => e.feature_access);
          setSelectedFeatureCodes(grantedCodes);
          const ticks: Record<string, string[]> = {};
          for (const entry of arr) {
            ticks[entry.feature_access] = entry.action_controls.filter(
              (c) => c !== "*",
            );
          }
          setTickedActionsByFeature(ticks);
          setActiveFeatureCode(grantedCodes[0] ?? null);
        }
        */
      } catch {
        if (cancelled) return;
        setApiError("Failed to load user access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* feature/action handlers + render helpers — hidden
  // ── Pill row interactions ─────────────────────────────────────────
  function focusFeature(code: string) {
    setActiveFeatureCode(code);
  }

  function removeFeature(code: string) {
    setSelectedFeatureCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      if (activeFeatureCode === code) {
        setActiveFeatureCode(next[next.length - 1] ?? null);
      }
      return next;
    });
    setTickedActionsByFeature((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  }

  // ── Popup ─────────────────────────────────────────────────────────
  function openPopup() {
    setPopupDraft({ selected: [...selectedFeatureCodes] });
  }
  function cancelPopup() {
    setPopupDraft(null);
  }
  function commitPopup() {
    if (!popupDraft) return;
    const next = popupDraft.selected;
    setSelectedFeatureCodes(next);
    // Preserve current active focus if still granted; otherwise fall back.
    if (!activeFeatureCode || !next.includes(activeFeatureCode)) {
      setActiveFeatureCode(next[0] ?? null);
    }
    // Drop ticks for ungranted features so payload assembly stays clean.
    setTickedActionsByFeature((prev) => {
      const cleaned: Record<string, string[]> = {};
      for (const code of next) {
        if (prev[code]) cleaned[code] = prev[code];
      }
      return cleaned;
    });
    setPopupDraft(null);
  }
  function togglePopupFeature(code: string) {
    setPopupDraft((prev) => {
      if (!prev) return prev;
      return prev.selected.includes(code)
        ? { selected: prev.selected.filter((c) => c !== code) }
        : { selected: [...prev.selected, code] };
    });
  }

  // ── Action Controls ───────────────────────────────────────────────
  const activeFeatureName = useMemo(() => {
    if (!activeFeatureCode) return null;
    return features.find((f) => f.code === activeFeatureCode)?.name ?? null;
  }, [features, activeFeatureCode]);

  const activeFeatureActions = useMemo(() => {
    if (!activeFeatureCode) return [];
    const feature = features.find((f) => f.code === activeFeatureCode);
    if (!feature) return [];
    return actionControls.filter(
      (a) => a.featureAccessId === feature.featureAccessId,
    );
  }, [features, actionControls, activeFeatureCode]);

  function toggleAction(code: string) {
    if (!activeFeatureCode) return;
    setTickedActionsByFeature((prev) => {
      const current = prev[activeFeatureCode] ?? [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      return { ...prev, [activeFeatureCode]: next };
    });
  }

  // ── Submit ────────────────────────────────────────────────────────
  function buildPayload(): FeatureActionAssigned {
    const payload: FeatureActionAssigned = [];
    for (const feature of features) {
      if (!selectedFeatureCodes.includes(feature.code)) continue;
      const childActions = actionControls
        .filter((a) => a.featureAccessId === feature.featureAccessId)
        .map((a) => a.code);
      const ticked = tickedActionsByFeature[feature.code] ?? [];
      payload.push({
        feature_access: feature.code,
        action_controls: childActions.filter((c) => ticked.includes(c)),
      });
    }
    return payload;
  }
  */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      setSubmitting(true);
      setApiError(null);
      await apiService.updateUserAccess(user.userId, {
        // featureActionAssigned: buildPayload(),
        projectIds: selectedProjectIds,
      });
      onClose();
      onSuccess();
    } catch {
      setApiError("Failed to update access");
    } finally {
      setSubmitting(false);
    }
  }

  /* feature/action render helpers — hidden
  // ── Render helpers ────────────────────────────────────────────────
  function renderPills() {
    if (selectedFeatureCodes.length === 0) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
          <span className="italic">No features granted yet</span>
          <button
            type="button"
            onClick={openPopup}
            className="ml-auto rounded-full border border-dashed px-3 py-0.5 text-xs hover:bg-muted"
          >
            + add feature
          </button>
        </div>
      );
    }
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 pr-9 relative"
      >
        {selectedFeatureCodes.map((code) => {
          const feature = features.find((f) => f.code === code);
          if (!feature) return null;
          const isActive = activeFeatureCode === code;
          return (
            <span
              key={code}
              role="button"
              tabIndex={0}
              onClick={() => focusFeature(code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  focusFeature(code);
                }
              }}
              className={
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs transition " +
                (isActive
                  ? "bg-foreground text-background ring-2 ring-foreground/20"
                  : "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100")
              }
            >
              {feature.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFeature(code);
                }}
                className="opacity-60 hover:opacity-100"
                aria-label={`Remove ${feature.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={openPopup}
          className="rounded-full border border-dashed px-3 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          + add feature
        </button>
      </div>
    );
  }

  function renderActionControls() {
    if (selectedFeatureCodes.length === 0 || !activeFeatureCode) {
      return (
        <div className="rounded-md border border-dashed px-4 py-6 text-center text-xs italic text-muted-foreground">
          Select a feature above to manage its actions.
        </div>
      );
    }
    if (activeFeatureActions.length === 0) {
      return (
        <div className="rounded-md border border-dashed px-4 py-6 text-center text-xs italic text-muted-foreground">
          No actions defined for this feature.
        </div>
      );
    }
    const ticked = tickedActionsByFeature[activeFeatureCode] ?? [];
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="grid grid-cols-2 gap-1">
          {activeFeatureActions.map((a) => {
            const id = `action-${a.code}`;
            return (
              <label
                key={a.code}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm"
              >
                <Checkbox
                  id={id}
                  checked={ticked.includes(a.code)}
                  onCheckedChange={() => toggleAction(a.code)}
                />
                {a.name}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPopup() {
    if (!popupDraft) return null;
    return (
      <>
        <div
          className="absolute inset-0 z-10 bg-slate-900/35"
          onClick={cancelPopup}
        />
        <div className="absolute left-6 right-6 top-1/2 z-20 -translate-y-1/2 overflow-hidden rounded-lg border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
            <div className="text-xs font-semibold">Select features</div>
            <div className="text-xs text-muted-foreground">
              {popupDraft.selected.length} of {features.length} selected
            </div>
          </div>
          {popupDraft.selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Currently selected:
              </span>
              {popupDraft.selected.map((code) => {
                const f = features.find((x) => x.code === code);
                return (
                  <span
                    key={code}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-900"
                  >
                    {f?.name ?? code}
                  </span>
                );
              })}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {features.map((f) => {
              const id = `popup-${f.code}`;
              const checked = popupDraft.selected.includes(f.code);
              return (
                <label
                  key={f.code}
                  htmlFor={id}
                  className={
                    "flex cursor-pointer items-center gap-2.5 border-b px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/50 " +
                    (checked ? "bg-slate-50" : "")
                  }
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => togglePopupFeature(f.code)}
                  />
                  <span className="flex-1">{f.name}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 border-t bg-background px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" onClick={cancelPopup}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={commitPopup}>
              Done
            </Button>
          </div>
        </div>
      </>
    );
  }
  */

  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Access Management</DialogTitle>
          {user && (
            <DialogDescription>
              {user.firstName} {user.lastName} — {user.email}
            </DialogDescription>
          )}
        </DialogHeader>

        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {user && !loading && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <CheckboxGroup
              label="Projects"
              options={projects.map((p) => ({
                value: p.projectId,
                label: p.name,
              }))}
              selected={selectedProjectIds}
              onToggle={(pid) =>
                setSelectedProjectIds((prev) =>
                  prev.includes(pid)
                    ? prev.filter((x) => x !== pid)
                    : [...prev, pid],
                )
              }
            />

            {/* Features + Action Controls — hidden
            <div className="grid gap-2">
              <Label>
                Features{" "}
                <span className="font-normal text-xs text-muted-foreground">
                  — click a pill to switch which one's actions are shown below
                </span>
              </Label>
              {renderPills()}
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                Action Controls
                {activeFeatureName && (
                  <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                    {activeFeatureName}
                  </span>
                )}
              </Label>
              {renderActionControls()}
            </div>
            */}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* {popupOpen && renderPopup()} */}
      </DialogContent>
    </Dialog>
  );
}
