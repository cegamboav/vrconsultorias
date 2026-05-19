import { Link } from "react-router-dom";

/**
 * @param {{ variant?: "light" | "dark" | "crm", className?: string, linkTo?: string | null }} props
 */
export default function VrLogo({ variant = "light", className = "", linkTo = "/" }) {
  const isDark = variant === "dark" || variant === "crm";
  const titleClass = isDark ? "text-white" : "text-brand-navy";
  const tagClass = isDark ? "text-brand-gold" : "text-brand-navy-mid";
  const markClass = variant === "crm" ? "bg-brand-gold text-brand-navy" : "bg-brand-navy-mid text-brand-gold";

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${markClass}`}
        aria-hidden
      >
        VR
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={`text-base font-semibold tracking-tight ${titleClass}`}>VR Consultorías</span>
        <span className={`text-[10px] font-medium uppercase tracking-widest ${tagClass}`}>
          Asesoría financiera
        </span>
      </span>
    </span>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="inline-flex rounded-lg outline-none ring-brand-gold/50 focus-visible:ring-2">
        {inner}
      </Link>
    );
  }
  return inner;
}
