/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': 'rgb(var(--color-primary-50) / <alpha-value>)',
  				'100': 'rgb(var(--color-primary-100) / <alpha-value>)',
  				'200': 'rgb(var(--color-primary-200) / <alpha-value>)',
  				'300': 'rgb(var(--color-primary-300) / <alpha-value>)',
  				'400': 'rgb(var(--color-primary-400) / <alpha-value>)',
  				'500': 'rgb(var(--color-primary-500) / <alpha-value>)',
  				'600': 'rgb(var(--color-primary-600) / <alpha-value>)',
  				'700': 'rgb(var(--color-primary-700) / <alpha-value>)',
  				'800': 'rgb(var(--color-primary-800) / <alpha-value>)',
  				'900': 'rgb(var(--color-primary-900) / <alpha-value>)',
  				DEFAULT: 'var(--primary)',
  				foreground: 'var(--primary-foreground)'
  			},
  			success: 'rgb(var(--color-success) / <alpha-value>)',
  			warning: 'rgb(var(--color-warning) / <alpha-value>)',
  			error: 'rgb(var(--color-error) / <alpha-value>)',
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			card: {
  				DEFAULT: 'var(--card)',
  				foreground: 'var(--card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--popover)',
  				foreground: 'var(--popover-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--secondary)',
  				foreground: 'var(--secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--muted-foreground)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--accent-foreground)'
  			},
  			destructive: 'var(--destructive)',
  			border: 'var(--border)',
  			input: 'var(--input)',
  			ring: 'var(--ring)',
  			chart: {
  				'1': 'var(--chart-1)',
  				'2': 'var(--chart-2)',
  				'3': 'var(--chart-3)',
  				'4': 'var(--chart-4)',
  				'5': 'var(--chart-5)'
  			},
  			sidebar: {
  				DEFAULT: 'var(--sidebar)',
  				foreground: 'var(--sidebar-foreground)',
  				primary: 'var(--sidebar-primary)',
  				'primary-foreground': 'var(--sidebar-primary-foreground)',
  				accent: 'var(--sidebar-accent)',
  				'accent-foreground': 'var(--sidebar-accent-foreground)',
  				border: 'var(--sidebar-border)',
  				ring: 'var(--sidebar-ring)'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		spacing: {
  			xs: 'var(--spacing-xs)',
  			sm: 'var(--spacing-sm)',
  			md: 'var(--spacing-md)',
  			lg: 'var(--spacing-lg)',
  			xl: 'var(--spacing-xl)',
  			'2xl': 'var(--spacing-2xl)'
  		},
  		gridTemplateColumns: {
  			'18': 'repeat(18, minmax(0, 1fr))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
