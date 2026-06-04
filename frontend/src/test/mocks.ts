import { vi } from 'vitest'

/**
 * Types for mock factories
 * (Adjust these to match your real hook return types if needed)
 */
export type MockUseAuth = {
  login: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  user: unknown | null
  isLoading: boolean
  error: unknown | null
}

export type MockUseTheme = {
  setTheme: ReturnType<typeof vi.fn>
  theme: 'light' | 'dark' | string
}

export type MockLocation = {
  search: string
  pathname: string
  state: unknown
  hash: string
  key: string
}

/**
 * Factory for useAuth mock
 * Usage:
 * vi.mock('../../hooks/useAuth', () => ({
 *   useAuth: () => createMockUseAuth({ user: mockUser }),
 * }))
 */
export const createMockUseAuth = (
  overrides: Partial<MockUseAuth> = {},
): MockUseAuth => ({
  login: vi.fn(),
  logout: vi.fn(),
  user: null,
  isLoading: false,
  error: null,
  ...overrides,
})

/**
 * Factory for useTheme mock
 * Usage:
 * vi.mock('../../design-system', () => ({
 *   useTheme: () => createMockUseTheme({ theme: 'dark' }),
 * }))
 */
export const createMockUseTheme = (
  overrides: Partial<MockUseTheme> = {},
): MockUseTheme => ({
  setTheme: vi.fn(),
  theme: 'light',
  ...overrides,
})

/**
 * Factory for useNavigate mock (react-router)
 * Usage:
 * const navigate = createMockUseNavigate()
 * vi.mock('react-router-dom', () => ({
 *   ...actualModule,
 *   useNavigate: () => navigate,
 * }))
 */
export const createMockUseNavigate = () => vi.fn()

/**
 * Factory for useLocation mock (react-router)
 */
export const createMockUseLocation = (
  overrides: Partial<MockLocation> = {},
): MockLocation => ({
  search: '',
  pathname: '/',
  state: null,
  hash: '',
  key: 'default',
  ...overrides,
})

/**
 * Example test data — Part 3 shapes.
 *
 * `mockProjects` matches the `Project` type (`projectId`, `name`,
 * `profileTypeId`, `profileType` ∈ shrimp/fish/crab_hatchery/treatment).
 * `mockUser` is the admin sentinel — `[{feature_access: "*", action_controls: ["*"]}]`.
 * `mockRegularUser` carries the canonical default-onboarded array.
 */
export const mockProjects = [
  {
    projectId: 'proj-1',
    name: 'Shrimp Farm',
    profileTypeId: 'pt-1',
    profileType: 'shrimp',
  },
  {
    projectId: 'proj-2',
    name: 'Fish Pond',
    profileTypeId: 'pt-2',
    profileType: 'fish',
  },
] as const

export const mockUser = {
  userId: 'user-1',
  username: 'Test User',
  role: 'platform_admin',
  featureActionAssigned: [
    { feature_access: '*', action_controls: ['*'] },
  ],
} as const

export const mockRegularUser = {
  userId: 'user-2',
  username: 'Test Farmer',
  role: 'user',
  featureActionAssigned: [
    { feature_access: 'overview', action_controls: [] },
    { feature_access: 'digital_twin', action_controls: [] },
    {
      feature_access: 'realtime_forecast',
      action_controls: ['ai_forecast', 'schedule_forecast'],
    },
    { feature_access: 'historical_data', action_controls: ['export_data'] },
    { feature_access: 'pond_comparison', action_controls: [] },
  ],
} as const
