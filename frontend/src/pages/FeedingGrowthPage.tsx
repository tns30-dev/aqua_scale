import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { DashboardTab } from "../components/feeding/DashboardTab";

export function FeedingGrowthPage() {
  return (
    <AppShell>
      <PageContainer className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feeding &amp; Growth</h1>
          <p className="mt-1 text-sm text-gray-500">
            Feed intake, cost and conversion performance across ponds and production cycles.
          </p>
        </div>
        <DashboardTab />
      </PageContainer>
    </AppShell>
  );
}
