import VrLogo from "../brand/VrLogo";
import { VR_PHONE, VR_PHONE_HREF } from "../../brand/vrContent";
import PrivateAccessLink from "./PrivateAccessLink";

export default function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <VrLogo variant="dark" linkTo="/" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
              Más de 20 años guiando a personas y empresas hacia el éxito financiero con confianza y
              excelencia.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-gold">Servicios</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>
                <a href="#servicios" className="transition hover:text-white">
                  Inversiones
                </a>
              </li>
              <li>
                <a href="#servicios" className="transition hover:text-white">
                  Charlas financieras
                </a>
              </li>
              <li>
                <a href="#servicios" className="transition hover:text-white">
                  Contabilidad
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-gold">Contacto</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>
                <a href={VR_PHONE_HREF} className="transition hover:text-white">
                  {VR_PHONE}
                </a>
              </li>
              <li>
                <a href="#contacto" className="transition hover:text-white">
                  Escríbanos
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} VR Consultorías. Todos los derechos reservados.
          </p>
          <PrivateAccessLink className="!text-slate-500 hover:!text-slate-300" />
        </div>
      </div>
    </footer>
  );
}
