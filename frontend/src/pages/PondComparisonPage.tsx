import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { ComparisonDashboard } from "../components/pond-comparison/ComparisonDashboard";

export function PondComparisonPage() {
  return (
    <AppShell>
      <PageContainer>
        <div className="mb-1 text-[22px] font-bold text-[#0F2B3C]">Pond Comparison</div>
        <div className="mb-5 text-xs text-gray-500">
          Compare treatment-driven pond parameters across the same date range
        </div>
        <ComparisonDashboard />
      </PageContainer>
    </AppShell>
  );
}
