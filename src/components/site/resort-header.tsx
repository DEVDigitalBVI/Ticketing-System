import Link from "next/link";

type ResortHeaderProps = {
  context?: string;
};

export function ResortHeader({ context = "IT Service Desk" }: ResortHeaderProps) {
  return (
    <header className="site-header site-frame">
      <Link
        className="brand-line"
        href="/"
        aria-label="Peter Island Resort and Spa IT Service Desk home"
      >
        <span>Peter Island Resort and Spa</span>
        <span className="brand-rule" aria-hidden="true" />
        <span>British Virgin Islands</span>
      </Link>
      <p className="prototype-meta">{context}</p>
    </header>
  );
}
