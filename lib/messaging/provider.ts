export interface SendMessageParams {
  to: string;      // E.164 phone
  body: string;
  channel: "whatsapp" | "sms" | "email";
}

export interface SendMessageResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface MessageProvider {
  send(params: SendMessageParams): Promise<SendMessageResult>;
}

/** Dev stub — logs to console, always succeeds */
export class ConsoleProvider implements MessageProvider {
  async send(params: SendMessageParams): Promise<SendMessageResult> {
    console.log(`[MessageProvider:Console] → ${params.channel} to ${params.to}`);
    console.log(`  Body: ${params.body}`);
    return { ok: true, providerId: `console_${Date.now()}` };
  }
}

// Wire a real provider here when WhatsApp Business API is ready
export const messageProvider: MessageProvider = new ConsoleProvider();
