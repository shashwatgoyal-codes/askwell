export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" rx="28" className="fill-accent" />
      <rect x="26" y="26" width="76" height="52" rx="15" fill="none" className="stroke-on-accent" strokeWidth="9" />
      <path d="M34 90L44 100L62 80" fill="none" className="stroke-on-accent" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
