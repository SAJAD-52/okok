/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFB400',
          hover: '#E6A200',
          light: '#FFF9E6',
          dark: '#CC9000',
        },
        ink: {
          DEFAULT: '#0B1220',
          light: '#131F36',
          dark: '#060B14',
        },
        steel: {
          DEFAULT: '#1E293B',
          light: '#334155',
          dark: '#0F172A',
        },
        'slate-muted': '#64748B',
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          dark: '#0F172A',
        },
        success: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
          dark: '#15803D',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
          dark: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Cairo', 'system-ui', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(11, 18, 32, 0.06), 0 2px 6px -1px rgba(11, 18, 32, 0.04)',
        'lift': '0 12px 30px -4px rgba(11, 18, 32, 0.12), 0 4px 12px -2px rgba(11, 18, 32, 0.08)',
        'yellow-glow': '0 0 35px -5px rgba(255, 180, 0, 0.35)',
      },
      backgroundImage: {
        'hazard-stripes': 'repeating-linear-gradient(45deg, #FFB400, #FFB400 12px, #0B1220 12px, #0B1220 24px)',
        'hazard-subtle': 'repeating-linear-gradient(45deg, rgba(255,180,0,0.15), rgba(255,180,0,0.15) 10px, transparent 10px, transparent 20px)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
