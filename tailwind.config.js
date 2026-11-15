/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FFB400',
          hover: '#E6A200',
          light: '#FFF8E7',
          dark: '#B37D00',
          50: '#FFFDF5',
          100: '#FFF8E7',
          200: '#FFEDBF',
          300: '#FFE299',
          400: '#FFCC4D',
          500: '#FFB400',
          600: '#E6A200',
          700: '#B37D00',
          800: '#805900',
          900: '#4D3600',
        },
        ink: {
          DEFAULT: '#0B1220',
          light: '#131F36',
          dark: '#060B14',
          card: '#0F172A',
          border: '#1E293B',
          soft: '#162238',
          deep: '#060A12',
        },
        steel: {
          DEFAULT: '#1E293B',
          light: '#334155',
          dark: '#0F172A',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
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
      spacing: {
        18: '4.5rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(11, 18, 32, 0.05), 0 4px 20px -2px rgba(11, 18, 32, 0.04)',
        'elevated': '0 10px 30px -5px rgba(11, 18, 32, 0.08), 0 4px 12px -2px rgba(11, 18, 32, 0.04)',
        'lift': '0 12px 30px -4px rgba(11, 18, 32, 0.12), 0 4px 12px -2px rgba(11, 18, 32, 0.08)',
        'yellow-glow': '0 0 35px -5px rgba(255, 180, 0, 0.35)',
      },
      backgroundImage: {
        'hazard-stripes': 'repeating-linear-gradient(45deg, #FFB400, #FFB400 12px, #0B1220 12px, #0B1220 24px)',
        'hazard-subtle': 'repeating-linear-gradient(45deg, rgba(255,180,0,0.15), rgba(255,180,0,0.15) 10px, transparent 10px, transparent 20px)',
        'industrial-grid': 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        'industrial-grid': '36px 36px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
