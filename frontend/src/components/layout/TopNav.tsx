import { TopNavActions } from './TopNavActions';

export function TopNav() {
  return (
    <header className="hidden md:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-6">
      <div className="w-48" />
      <div className="flex-1" />

      <TopNavActions />
    </header>
  );
}
