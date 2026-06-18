import { Link } from "react-router-dom";
import { VR_LOGO_SRC } from "../../brand/assets.js";

const SIZE_BY_VARIANT = {
  light: "h-11 w-auto max-w-[11.5rem] sm:max-w-[13rem]",
  header: "h-[4rem] w-auto max-w-[17rem] sm:h-[4.35rem] sm:max-w-[20rem]",
  dark: "h-12 w-auto max-w-[13rem]",
  crm: "h-10 w-auto max-w-[10.5rem] sm:max-w-[11.5rem]"
};

/**
 * @param {{ variant?: "light" | "header" | "dark" | "crm", className?: string, linkTo?: string | null }} props
 */
export default function VrLogo({ variant = "light", className = "", linkTo = "/" }) {
  const sizeClass = SIZE_BY_VARIANT[variant] ?? SIZE_BY_VARIANT.light;

  const img = (
    <img
      src={VR_LOGO_SRC}
      alt="VR Consultorías — Asesoría financiera"
      className={`vr-logo object-contain object-left ${sizeClass} ${className}`.trim()}
      width={208}
      height={48}
      loading="eager"
      decoding="async"
    />
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="inline-flex shrink-0 rounded-lg outline-none ring-brand-gold/40 focus-visible:ring-2"
        aria-label="VR Consultorías — Inicio"
      >
        {img}
      </Link>
    );
  }

  return img;
}
