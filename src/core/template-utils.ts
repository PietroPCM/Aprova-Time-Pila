import type { Field, Template } from "./types";

/** All fields of the form, across sections (conditions may cross sections). */
export function allFields(template: Template): Field[] {
  return template.sections.flatMap((s) => s.fields);
}
