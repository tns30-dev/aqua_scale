import { MiniParameterCard } from './MiniParameterCard';
import type { ParameterData } from './PondVisualization';
import { clsx } from 'clsx';

interface ParameterGridProps {
  items: ParameterData[];
}

export function ParameterGrid({ items }: ParameterGridProps) {
  if (items.length === 0) return null;

  // Key parameters first
  const sorted = [...items].sort((a, b) => {
    const ak = a.isKey ? 0 : 1;
    const bk = b.isKey ? 0 : 1;
    return ak - bk;
  });

  return (
    <div
      className="grid gap-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 auto-rows-[120px]">
      {sorted.map((p) => {
        const isKey = p.isKey;

        return (
          <div
            key={p.key}
            className={clsx(
              'min-w-0 flex items-center justify-center',
              isKey
                ? 'col-span-2 row-span-1'
                : 'col-span-1 row-span-1'
            )}
          >
            <MiniParameterCard
              label={p.label}
              value={p.value}
              previousValue={p.previousValue}
              unit={p.unit}
              status={p.status}
              variant={isKey ? 'key' : 'default'}
              className="h-full w-full"
            />
          </div>
        );
      })}
    </div>
  );
}
