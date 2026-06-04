import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { ProfileProvider } from '../context/ProfileContext';

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  /** The initial route you want MemoryRouter to start at */
  route?: string;
};

// Wrap all tests with necessary providers (router, profile, etc.)
const AllTheProviders = ({
  children,
  route = '/',
}: {
  children: ReactNode;
  route?: string;
}) => {
  return (
    <MemoryRouter initialEntries={[route]}>
      <ProfileProvider>
        {children}
      </ProfileProvider>
    </MemoryRouter>
  );
};

const customRender = (
  ui: ReactElement,
  { route = '/', ...options }: CustomRenderOptions = {},
) =>
  render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders route={route}>{children}</AllTheProviders>
    ),
    ...options,
  });

// Re-export everything from RTL, but override render
export * from '@testing-library/react';
export { customRender as render };
