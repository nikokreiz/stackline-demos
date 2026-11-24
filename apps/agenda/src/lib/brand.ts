import type { CSSProperties } from "react";

/** Variables CSS para pintar la página pública con el color de cada negocio. */
export function brandStyle(color?: string): CSSProperties | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  return {
    ["--brand" as string]: color,
    ["--brand-strong" as string]: `color-mix(in srgb, ${color} 80%, black)`,
    ["--brand-soft" as string]: `color-mix(in srgb, ${color} 14%, var(--surface))`,
  };
}
