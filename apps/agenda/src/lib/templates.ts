/**
 * Plantillas por rubro: al registrarse, el negocio parte con servicios típicos
 * que después puede editar. Precios referenciales en CLP.
 */
export type ServiceTemplate = { name: string; durationMin: number; price: number; deposit: number; description?: string };

export const INDUSTRIES: Record<string, { label: string; staffTitle: string; services: ServiceTemplate[] }> = {
  barberia: {
    label: "Barbería",
    staffTitle: "Barbero",
    services: [
      { name: "Corte clásico", durationMin: 30, price: 12000, deposit: 3000 },
      { name: "Corte + barba", durationMin: 60, price: 18000, deposit: 5000 },
      { name: "Perfilado de barba", durationMin: 30, price: 8000, deposit: 2000 },
    ],
  },
  peluqueria: {
    label: "Peluquería",
    staffTitle: "Estilista",
    services: [
      { name: "Corte de pelo", durationMin: 45, price: 15000, deposit: 4000 },
      { name: "Color completo", durationMin: 120, price: 45000, deposit: 10000 },
      { name: "Brushing", durationMin: 30, price: 10000, deposit: 0 },
    ],
  },
  estetica: {
    label: "Centro de estética",
    staffTitle: "Esteticista",
    services: [
      { name: "Limpieza facial profunda", durationMin: 60, price: 28000, deposit: 8000 },
      { name: "Depilación láser (zona pequeña)", durationMin: 30, price: 20000, deposit: 5000 },
      { name: "Masaje relajante", durationMin: 60, price: 30000, deposit: 8000 },
    ],
  },
  unas: {
    label: "Manicure y uñas",
    staffTitle: "Manicurista",
    services: [
      { name: "Esmaltado permanente", durationMin: 60, price: 15000, deposit: 4000 },
      { name: "Uñas acrílicas", durationMin: 120, price: 28000, deposit: 8000 },
      { name: "Pedicure", durationMin: 60, price: 18000, deposit: 5000 },
    ],
  },
  salud: {
    label: "Kinesiología o consulta de salud",
    staffTitle: "Profesional",
    services: [
      { name: "Evaluación inicial", durationMin: 45, price: 30000, deposit: 10000 },
      { name: "Sesión de tratamiento", durationMin: 45, price: 25000, deposit: 0 },
      { name: "Control", durationMin: 30, price: 20000, deposit: 0 },
    ],
  },
  otro: {
    label: "Otro rubro",
    staffTitle: "Profesional",
    services: [{ name: "Atención", durationMin: 60, price: 20000, deposit: 0 }],
  },
};

export const industryLabel = (key: string | null | undefined) => (key && INDUSTRIES[key]?.label) || "Otro rubro";
