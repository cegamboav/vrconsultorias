export const VR_PHONE = "(+506) 7200 6360";
export const VR_PHONE_HREF = "tel:+50672006360";

/** TODO: reemplazar con URL de Calendly cuando esté disponible */
export const VR_CALENDLY_URL = "";

export const VR_SERVICES = [
  {
    id: "inversiones",
    title: "Inversiones",
    subtitle: "Asesoría financiera e inversiones",
    description:
      "Asesoría personalizada en la Bolsa de Comercio con enfoque en renta fija conservadora e interés compuesto.",
    color: "#6B9BD1",
    icon: "chart"
  },
  {
    id: "charlas",
    title: "Charlas financieras",
    subtitle: "Educación financiera",
    description:
      "Charlas informativas que empoderan con conocimiento para decisiones financieras sólidas.",
    color: "#9B7ED4",
    icon: "talk"
  },
  {
    id: "contabilidad",
    title: "Contabilidad",
    subtitle: "Salud financiera empresarial",
    description:
      "Servicios contables de alta calidad para navegar los desafíos financieros de su empresa.",
    color: "#5DAA8A",
    icon: "ledger"
  }
];

export const VR_STATS = [
  { value: "20+", label: "Años de experiencia" },
  { value: "1:1", label: "Atención personalizada" },
  { value: "3", label: "Áreas de asesoría" }
];

export const VR_BENEFITS = [
  {
    title: "Tiempo de respuesta",
    text: "Priorizamos sus requerimientos con respuestas ágiles y claras."
  },
  {
    title: "Atención personalizada",
    text: "Compromiso uno a uno orientado al éxito de cada cliente."
  },
  {
    title: "Rentabilidad",
    text: "Tasas competitivas en productos conservadores de renta fija."
  },
  {
    title: "Experiencia",
    text: "Más de 20 años en finanzas, contabilidad y gerencia."
  },
  {
    title: "Confianza",
    text: "Relaciones de largo plazo basadas en transparencia y resultados."
  },
  {
    title: "Respaldo",
    text: "Transcomer, Bolsa de Comercio y red profesional de confianza."
  }
];

/** Campos previstos para futuro formulario público → CRM */
export const VR_CONTACT_FORM_FIELDS = [
  { name: "fullName", label: "Nombre completo", type: "text" },
  { name: "email", label: "Correo electrónico", type: "email" },
  { name: "phone", label: "Teléfono", type: "tel" },
  {
    name: "serviceInterest",
    label: "Servicio de interés",
    type: "select",
    options: ["Inversiones", "Charlas financieras", "Contabilidad", "No estoy seguro"]
  },
  { name: "message", label: "¿Cómo podemos ayudarle?", type: "textarea" }
];
