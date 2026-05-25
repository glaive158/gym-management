export function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const header = (columns as string[]).join(",");
  const lines = rows.map((row) => columns.map((c) => escape((row as Record<string, unknown>)[c as string])).join(","));
  return [header, ...lines].join("\n");
}

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
