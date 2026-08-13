export type TemplateVars = Record<string, string | number | undefined>;

/** Replace `{{name}}` placeholders. Missing keys become empty strings. */
export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function interpolateLines(lines: string[], vars: TemplateVars): string[] {
  return lines.map((line) => interpolate(line, vars));
}
