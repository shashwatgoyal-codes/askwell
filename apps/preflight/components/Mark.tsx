export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" rx="28" className="fill-accent" />
      <path
        d="M30 70L50 90L94 40M70 38H96V64"
        fill="none"
        className="stroke-on-accent"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
