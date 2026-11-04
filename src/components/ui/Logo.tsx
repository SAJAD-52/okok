import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'dark',
}) => {
  const sizeMap = {
    sm: { mark: 'w-7 h-7', text: 'text-lg', sub: 'text-[9px]' },
    md: { mark: 'w-9 h-9', text: 'text-xl', sub: 'text-[10px]' },
    lg: { mark: 'w-12 h-12', text: 'text-2xl', sub: 'text-xs' },
  };

  const isLight = variant === 'light';

  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 transition-transform duration-150 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary rounded-lg ${className}`}
      aria-label="JADIJCB - Heavy Machinery Marketplace Morocco"
    >
      {/* Industrial Hexagon Excavator Bucket SVG Icon */}
      <div className={`relative flex items-center justify-center shrink-0 rounded-xl bg-ink p-1.5 shadow-sm border border-steel/20 ${sizeMap[size].mark}`}>
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Heavy Equipment Boom & Bucket Geometry */}
          <path
            d="M6 26L14 10L22 14L16 26H6Z"
            fill="#FFB400"
          />
          <path
            d="M22 14L28 20L25 26H16L22 14Z"
            fill="#E6A200"
          />
          <path
            d="M28 20L31 23L29 26H25L28 20Z"
            fill="#FFCC4D"
          />
          <circle cx="14" cy="10" r="2.5" fill="#0B1220" />
          <circle cx="22" cy="14" r="2" fill="#0B1220" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col text-start">
        <span
          className={`font-extrabold tracking-tight leading-none ${
            isLight ? 'text-white' : 'text-ink'
          } ${sizeMap[size].text}`}
        >
          JADI<span className="text-primary">JCB</span>
        </span>
        <span
          className={`font-semibold tracking-wider uppercase font-arabic mt-0.5 leading-none ${
            isLight ? 'text-steel-300' : 'text-steel-500'
          } ${sizeMap[size].sub}`}
        >
          ماروك · MAROC
        </span>
      </div>
    </Link>
  );
};

export default Logo;
