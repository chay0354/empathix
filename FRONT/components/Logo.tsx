/** Vector Empathix logo: speech-bubble mark + wordmark in the site font, sharp at any size. */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size * (48 / 42)} height={size} viewBox="0 0 48 42" fill="none" aria-hidden>
      <path d="M20 1h8c10.5 0 19 8.5 19 19s-8.5 19-19 19H8.6L2.3 41.2c-.9.4-1.8-.5-1.4-1.4l2.8-6.3A18.9 18.9 0 0 1 1 20C1 9.5 9.5 1 20 1Z" fill="var(--blue-500)" />
      <rect x="11" y="12" width="26" height="16" rx="8" fill="var(--white)" />
    </svg>
  );
}

export function Logo({ height = 34 }: { height?: number }) {
  return (
    <span className="ex-logo" dir="ltr" style={{ ["--logo-h" as string]: `${height}px` }}>
      <Mark size={height} />
      <span className="ex-logo__word">Empathix</span>
    </span>
  );
}
