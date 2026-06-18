import "server-only";

export interface SendMessageParams {
  to: string;
  body: string;
  channel: "whatsapp" | "sms" | "email";
}

export interface SendMessageResult {
  accepted: boolean;
  providerId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface MessageProvider {
  readonly name: string;
  send(params: SendMessageParams): Promise<SendMessageResult>;
}

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
}

function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!accessToken || !phoneNumberId || !appSecret || !verifyToken) return null;
  return {
    accessToken,
    phoneNumberId,
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0",
  };
}

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
  error?: {
    code?: number;
  };
}

export class WhatsAppCloudProvider implements MessageProvider {
  readonly name = "meta_whatsapp";

  constructor(private readonly config: WhatsAppConfig) {}

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    if (params.channel !== "whatsapp") {
      return {
        accepted: false,
        errorCode: "UNSUPPORTED_CHANNEL",
        errorMessage: "The configured provider only supports WhatsApp",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.config.graphApiVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.to.replace(/\D/g, ""),
          type: "text",
          text: {
            preview_url: false,
            body: params.body,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const payload = await response.json().catch(() => ({})) as MetaSendResponse;
    const providerId = payload.messages?.[0]?.id;
    if (!response.ok || !providerId) {
      return {
        accepted: false,
        errorCode: payload.error?.code ? String(payload.error.code) : `HTTP_${response.status}`,
        errorMessage: "WhatsApp rejected the message",
      };
    }

    return { accepted: true, providerId };
  }
}

export function getMessageProvider(): MessageProvider | null {
  const config = getWhatsAppConfig();
  return config ? new WhatsAppCloudProvider(config) : null;
}
