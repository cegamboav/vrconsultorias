export const APP_NAV = [
  { to: "/app/dashboard", label: "Dashboard", title: "Dashboard" },
  { to: "/app/leads", label: "Leads", title: "Leads" },
  { to: "/app/pipeline", label: "Pipeline", title: "Pipeline" },
  { to: "/app/reportes", label: "Reportes", title: "Reportes" }
];

export function getPageTitle(pathname) {
  const item = APP_NAV.find((nav) => pathname === nav.to || pathname.startsWith(`${nav.to}/`));
  return item?.title ?? "Plataforma";
}
