export interface GenerateMessageParams {
  kind: "fee_reminder" | "absence" | "exam_score" | "birthday" | "homework" | "custom";
  language: "en" | "hi";
  variables: Record<string, string | number>;
}

export interface MessageGenerator {
  generate(params: GenerateMessageParams): Promise<string>;
}

const TEMPLATES: Record<string, string> = {
  "fee_reminder:en":
    "Dear {{guardian_name}}, this is a reminder that fees of {{amount}} are due for {{student_name}} ({{class_name}}) by {{due_date}}. Please pay at your earliest convenience. – {{institution_name}}",
  "absence:en":
    "Dear {{guardian_name}}, {{student_name}} was marked absent today ({{date}}) in {{class_name}}. Please inform the school if there is a reason. – {{institution_name}}",
  "birthday:en":
    "Happy Birthday {{student_name}}! 🎂 Wishing you a wonderful day from all of us at {{institution_name}}.",
};

/** Template-based stub. Replace with real AI provider post-MVP. */
export class TemplateGenerator implements MessageGenerator {
  async generate({ kind, language, variables }: GenerateMessageParams): Promise<string> {
    const key = `${kind}:${language}`;
    const template = TEMPLATES[key] ?? TEMPLATES[`${kind}:en`] ?? `Message for ${kind}`;
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(variables[k] ?? `{{${k}}}`));
  }
}

export const messageGenerator: MessageGenerator = new TemplateGenerator();
