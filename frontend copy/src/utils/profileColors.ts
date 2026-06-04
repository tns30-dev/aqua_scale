/**
 * Profile Color Configuration
 * 
 * Centralized color system for profile types (shrimp, fish, hatchery, treatment)
 * and health status indicators. Works alongside the existing theme system.
 * 
 * @module profileColors
 */

/**
 * Color palette structure for profile types
 */
export interface ProfileColorPalette {
  /** Primary brand color for the profile */
  primary: string;
  /** Darker shade for hover states and emphasis */
  secondary: string;
  /** Accent color for highlights and CTAs */
  accent: string;
  /** Light background color for cards and sections */
  light: string;
}

/**
 * Health status color mapping
 */
export interface HealthStatusColors {
  /** Excellent health - green */
  excellent: string;
  /** Good health - amber/yellow */
  good: string;
  /** Fair health - orange */
  fair: string;
  /** Poor health - red */
  poor: string;
  /** Future/projected status - gray */
  future: string;
}

/**
 * Health status colors used across all profile types
 * These colors are shared and consistent regardless of profile theme
 */
export const HEALTH_STATUS_COLORS: HealthStatusColors = {
  excellent: '#10B981',
  good: '#F59E0B',
  fair: '#FB923C',
  poor: '#EF4444',
  future: '#9CA3AF'
};

/**
 * Profile-specific color palettes
 * Each profile type has a unique color scheme for branding and visual distinction
 */
export const PROFILE_COLORS: Record<string, ProfileColorPalette> = {
  shrimp: {
    primary: '#13b8a7',
    secondary: '#0f9888',
    accent: '#7C3AED',
    light: '#e6f7f5'
  },
  fish: {
    primary: '#7C3AED',    // Purple (matches nav bar)
    secondary: '#6D28D9',  // Darker purple
    accent: '#A78BFA',     // Lighter purple accent
    light: '#F3E8FF'       // Very light purple background
  },
  crab_hatchery: {
    primary: '#F97316',    // Orange (for crabs)
    secondary: '#EA580C',  // Darker orange
    accent: '#FB923C',     // Lighter orange accent
    light: '#FFF7ED'       // Very light orange background
  },
  hatchery: {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    accent: '#10B981',
    light: '#DBEAFE'
  },
  treatment: {
    primary: '#10B981',
    secondary: '#059669',
    accent: '#F59E0B',
    light: '#D1FAE5'
  }
};

/**
 * Comparison colors for Pond A vs Pond B in Pond Comparison page.
 * Each profile has two distinct colors from the same color family
 * that are clearly distinguishable on charts and cards.
 *
 * Consultant feedback: same warmth/family, different intensity
 * (e.g., intense orange vs brown for crab profile).
 */
export interface ComparisonColors {
  /** Pond A color — stronger/deeper shade */
  pondA: string;
  /** Pond B color — contrasting shade from same family */
  pondB: string;
}

export const COMPARISON_COLORS: Record<string, ComparisonColors> = {
  shrimp: {
    pondA: '#2E7D32',   // Green
    pondB: '#B8860B',   // Dark goldenrod
  },
  fish: {
    pondA: '#5B21B6',   // Violet
    pondB: '#2563EB',   // Blue
  },
  crab_hatchery: {
    pondA: '#EA580C',   // Intense orange
    pondB: '#92400E',   // Warm brown
  },
  hatchery: {
    pondA: '#1D4ED8',   // Deep blue
    pondB: '#7C3AED',   // Violet
  },
  treatment: {
    pondA: '#047857',   // Deep emerald
    pondB: '#A3842A',   // Olive gold
  },
};

/**
 * Get comparison colors for a specific profile type.
 */
export function getComparisonColors(profileType: string): ComparisonColors {
  return COMPARISON_COLORS[profileType] || COMPARISON_COLORS.shrimp;
}

/**
 * Get color palette for a specific profile type
 * 
 * @param profileType - The profile type (shrimp, fish, hatchery, treatment)
 * @returns Color palette object with primary, secondary, accent, and light colors
 * @example
 * ```ts
 * const colors = getProfileColors('shrimp');
 * console.log(colors.primary); // '#0AADCB'
 * ```
 */
export function getProfileColors(profileType: string): ProfileColorPalette {
  return PROFILE_COLORS[profileType] || PROFILE_COLORS.shrimp;
}

/**
 * Get health status color by status key
 * 
 * @param status - Health status (excellent, good, fair, poor, future)
 * @returns Hex color string
 * @example
 * ```ts
 * const color = getHealthStatusColor('excellent');
 * console.log(color); // '#10B981'
 * ```
 */
export function getHealthStatusColor(status: string): string {
  return HEALTH_STATUS_COLORS[status as keyof HealthStatusColors] || HEALTH_STATUS_COLORS.future;
}

/**
 * Convert hex color to RGB string for Tailwind compatibility
 * 
 * @param hex - Hex color string (with or without #)
 * @returns RGB values as space-separated string (e.g., "10 173 203") or null if invalid
 * @example
 * ```ts
 * const rgb = hexToRgb('#0AADCB');
 * console.log(rgb); // "10 173 203"
 * ```
 */
export function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null;
}

/* ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * Example 1: Get profile colors in a component
 * ---------------------------------------------
 * import { getProfileColors } from '../utils/profileColors';
 * 
 * function MyComponent({ profileType }: { profileType: string }) {
 *   const colors = getProfileColors(profileType);
 *   
 *   return (
 *     <div style={{ 
 *       backgroundColor: colors.primary, 
 *       color: 'white',
 *       padding: '1rem'
 *     }}>
 *       <h2 style={{ color: colors.accent }}>Profile-themed content</h2>
 *       <div style={{ backgroundColor: colors.light }}>Light background</div>
 *     </div>
 *   );
 * }
 * 
 * 
 * Example 2: Health status indicators
 * ------------------------------------
 * import { getHealthStatusColor, HEALTH_STATUS_COLORS } from '../utils/profileColors';
 * 
 * function HealthBadge({ status }: { status: string }) {
 *   const color = getHealthStatusColor(status);
 *   
 *   return (
 *     <div style={{
 *       backgroundColor: color,
 *       color: 'white',
 *       borderRadius: '9999px',
 *       padding: '0.25rem 0.75rem'
 *     }}>
 *       {status.toUpperCase()}
 *     </div>
 *   );
 * }
 * 
 * // Or use constant directly for mapping
 * const statusColors = Object.entries(HEALTH_STATUS_COLORS).map(([status, color]) => (
 *   <div key={status} style={{ backgroundColor: color }}>
 *     {status}
 *   </div>
 * ));
 * 
 * 
 * Example 3: Recharts integration
 * --------------------------------
 * import { getProfileColors, getHealthStatusColor } from '../utils/profileColors';
 * import { LineChart, Line } from 'recharts';
 * 
 * function MyChart({ profileType }: { profileType: string }) {
 *   const colors = getProfileColors(profileType);
 *   
 *   return (
 *     <LineChart data={data}>
 *       <Line 
 *         type="monotone" 
 *         dataKey="temperature" 
 *         stroke={colors.primary} 
 *         strokeWidth={2}
 *       />
 *       <Line 
 *         type="monotone" 
 *         dataKey="ph" 
 *         stroke={colors.accent} 
 *         strokeWidth={2}
 *       />
 *     </LineChart>
 *   );
 * }
 * 
 * 
 * Example 4: Tailwind CSS with inline styles
 * -------------------------------------------
 * import { getProfileColors, hexToRgb } from '../utils/profileColors';
 * 
 * function TailwindStyledComponent({ profileType }: { profileType: string }) {
 *   const colors = getProfileColors(profileType);
 *   const primaryRgb = hexToRgb(colors.primary);
 *   
 *   return (
 *     <div 
 *       className="text-white rounded-lg p-4"
 *       style={{ 
 *         backgroundColor: `rgb(${primaryRgb})` 
 *       }}
 *     >
 *       <span 
 *         className="font-bold"
 *         style={{ color: colors.accent }}
 *       >
 *         Tailwind + Inline Styles
 *       </span>
 *     </div>
 *   );
 * }
 * 
 * 
 * Example 5: Dynamic theme switching
 * -----------------------------------
 * import { PROFILE_COLORS } from '../utils/profileColors';
 * 
 * function ProfileSelector({ onSelect }: { onSelect: (profile: string) => void }) {
 *   return (
 *     <div className="flex gap-2">
 *       {Object.entries(PROFILE_COLORS).map(([profileType, colors]) => (
 *         <button
 *           key={profileType}
 *           onClick={() => onSelect(profileType)}
 *           style={{
 *             backgroundColor: colors.primary,
 *             color: 'white',
 *             padding: '0.5rem 1rem',
 *             borderRadius: '0.375rem'
 *           }}
 *         >
 *           {profileType.charAt(0).toUpperCase() + profileType.slice(1)}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * 
 * 
 * Example 6: Type-safe color access
 * ----------------------------------
 * import { ProfileColorPalette, HealthStatusColors } from '../utils/profileColors';
 * 
 * // Type-safe function accepting profile colors
 * function renderCard(colors: ProfileColorPalette, title: string) {
 *   return {
 *     backgroundColor: colors.light,
 *     borderColor: colors.primary,
 *     titleColor: colors.secondary,
 *     accentColor: colors.accent
 *   };
 * }
 * 
 * // Type-safe health status handling
 * function getStatusStyle(status: keyof HealthStatusColors) {
 *   return HEALTH_STATUS_COLORS[status];
 * }
 */
