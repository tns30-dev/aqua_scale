import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { Users } from "../components/user-management/Users";

export function UsersPage() {
  return (
    <AppShell>
      <PageContainer>
        <h1 className="mb-1 text-[22px] font-bold text-[#0F2B3C]">Users</h1>
        <p className="mb-5 text-xs text-gray-500">Manage users, onboard new team members</p>
        <Users />
      </PageContainer>
    </AppShell>
  );
}
