import React from "react";

interface LogoMarkProps {
  size?: number;
  opacity?: number;
}

/** भू logo mark as React component (from public/favicon.svg) */
export const LogoMark: React.FC<LogoMarkProps> = ({ size = 64, opacity = 1 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#166534" }} />
          <stop offset="100%" style={{ stopColor: "#0f4c2c" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill="url(#logoBg)" />
      <text
        x="16"
        y="23"
        fontFamily="Arial, sans-serif"
        fontSize="18"
        fontWeight="bold"
        fill="white"
        textAnchor="middle"
      >
        भू
      </text>
    </svg>
  );
};
