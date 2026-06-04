import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={clsx('p-6', className)}>{children}</div>;
}

