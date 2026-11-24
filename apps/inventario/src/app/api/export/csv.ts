/** CSV con punto y coma y BOM, para que Excel en español lo abra bien. */
export function toCsv(rows: Array<Array<string | number | null>>) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export function csvResponse(name: string, body: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
