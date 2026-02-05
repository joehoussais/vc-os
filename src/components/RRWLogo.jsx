// Red River West Logo - Sunset/Horizon Icon
// Based on official branding

export function RRWLogo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
    >
      {/* Red background */}
      <rect width="100" height="100" fill="#E63424"/>

      {/* Horizon/sunset - semi-circle */}
      <path
        d="M15 50 A35 35 0 0 1 85 50"
        fill="white"
      />

      {/* Perspective lines (road/river going into sunset) */}
      <path
        d="M15 65 L50 50 L85 65"
        stroke="white"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M15 75 L50 55 L85 75"
        stroke="white"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M15 85 L50 60 L85 85"
        stroke="white"
        strokeWidth="4"
        fill="none"
      />
    </svg>
  );
}

export function RRWLogoMark({ size = 24, color = '#E63424', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
    >
      <rect width="100" height="100" rx="12" fill={color}/>
      <path d="M15 50 A35 35 0 0 1 85 50" fill="white"/>
      <path d="M15 65 L50 50 L85 65" stroke="white" strokeWidth="4" fill="none"/>
      <path d="M15 75 L50 55 L85 75" stroke="white" strokeWidth="4" fill="none"/>
      <path d="M15 85 L50 60 L85 85" stroke="white" strokeWidth="4" fill="none"/>
    </svg>
  );
}

// White version for dark backgrounds
export function RRWLogoWhite({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
    >
      <rect width="100" height="100" rx="12" fill="white"/>
      <path d="M15 50 A35 35 0 0 1 85 50" fill="#E63424"/>
      <path d="M15 65 L50 50 L85 65" stroke="#E63424" strokeWidth="4" fill="none"/>
      <path d="M15 75 L50 55 L85 75" stroke="#E63424" strokeWidth="4" fill="none"/>
      <path d="M15 85 L50 60 L85 85" stroke="#E63424" strokeWidth="4" fill="none"/>
    </svg>
  );
}

export default RRWLogo;
