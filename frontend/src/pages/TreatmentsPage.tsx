import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { TreatmentEfficiency } from "../components/treatments/TreatmentEfficiency";

// Wired to the real APIs on 28 Jul 2026 (stability arc; consultant-approved
// UI unchanged). The left panel carries both use cases — start/stop/edit/
// delete a course AND tick courses for the analysis; the right panel shows
// the stability + electricity numbers from /api/pond-treatments/stability/.

export function TreatmentsPage() {
  return (
    <AppShell>
      <PageContainer className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Treatments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Start and manage treatment courses, and see how they hold the water stable, per pond.
          </p>
        </div>
        <TreatmentEfficiency />
      </PageContainer>
    </AppShell>
  );
}
