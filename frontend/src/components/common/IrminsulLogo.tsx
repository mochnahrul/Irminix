export function IrminsulLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-label="Irminsul mark"
    >
      <rect width="36" height="36" rx="9" fill="#246A56" />
      <path d="M18 28V11" stroke="#F7F5F0" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M18 16C14 15.5 11.5 13 11 9.5C14.5 9.8 17 12.2 18 16Z"
        fill="#F7F5F0"
        fillOpacity="0.94"
      />
      <path
        d="M18 14C22 13.5 24.5 11 25 7.5C21.5 7.8 19 10.2 18 14Z"
        fill="#F7F5F0"
        fillOpacity="0.86"
      />
      <circle cx="18" cy="28" r="2" fill="#E8DFC8" />
    </svg>
  );
}
