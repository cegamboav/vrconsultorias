export const APP_NAV = [
  { to: "/app/dashboard", label: "Dashboard", title: "Dashboard" },
  { to: "/app/leads", label: "Leads", title: "Leads" },
  { to: "/app/reportes", label: "Reportes", title: "Reportes" }
];

export function getPageTitle(pathname) {
  if (pathname === "/app/leads/new") return "Crear lead";
  if (/\/app\/leads\/[^/]+\/edit$/.test(pathname)) return "Editar lead";
  if (/\/app\/leads\/[^/]+$/.test(pathname)) return "Detalle del lead";

  const item = APP_NAV.find((nav) => pathname === nav.to || pathname.startsWith(`${nav.to}/`));
  return item?.title ?? "Plataforma";
}
