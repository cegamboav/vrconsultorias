import { useState } from "react";
import VrLogo from "../brand/VrLogo";
import { VR_PHONE_HREF } from "../../brand/vrContent";
import AgendaCitaButton from "./AgendaCitaButton";
import PrivateAccessLink from "./PrivateAccessLink";

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#contacto", label: "Contacto" }
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className="marketing-header">
      <div className="marketing-container flex h-[4.25rem] items-center justify-between gap-4">
        <VrLogo variant="light" linkTo="/" />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="marketing-nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a href={VR_PHONE_HREF} className="marketing-nav-link hidden xl:inline">
            (+506) 7200 6360
          </a>
          <AgendaCitaButton className="!h-10 !px-4 !text-sm" />
          <PrivateAccessLink />
        </div>

        <button
          type="button"
          className="marketing-menu-btn lg:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200/80 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-navy hover:bg-slate-50"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3" onClick={closeMenu} role="presentation">
              <AgendaCitaButton className="w-full" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <a href={VR_PHONE_HREF} className="text-sm text-slate-600">
                (+506) 7200 6360
              </a>
              <PrivateAccessLink />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
