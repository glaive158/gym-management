// PayDunya Checkout Invoice API client.
// Docs: https://paydunya.com/developers/http-api

export interface PaydunyaConfig {
  mode: string; // "test" | "live"
  masterKey: string;
  privateKey: string;
  token: string;
  storeName: string;
}

export interface CreateInvoiceInput {
  amount: number;
  description: string;
  customData: Record<string, string>;
  callbackUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateInvoiceResult {
  success: boolean;
  token?: string;
  redirectUrl?: string;
  error?: string;
}

export interface ConfirmInvoiceResult {
  success: boolean;
  status?: "completed" | "pending" | "cancelled";
  customData?: Record<string, string>;
  error?: string;
}

export function paydunyaConfigFromEnv(): PaydunyaConfig | null {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  if (!masterKey || !privateKey || !token) return null;
  return {
    mode: process.env.PAYDUNYA_MODE ?? "test",
    masterKey,
    privateKey,
    token,
    storeName: process.env.PAYDUNYA_STORE_NAME ?? "Gym",
  };
}

function baseUrl(mode: string): string {
  return mode === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";
}

function headers(cfg: PaydunyaConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": cfg.masterKey,
    "PAYDUNYA-PRIVATE-KEY": cfg.privateKey,
    "PAYDUNYA-TOKEN": cfg.token,
  };
}

export async function createInvoice(
  cfg: PaydunyaConfig,
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  try {
    const res = await fetch(`${baseUrl(cfg.mode)}/checkout-invoice/create`, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({
        invoice: { total_amount: input.amount, description: input.description },
        store: { name: cfg.storeName },
        custom_data: input.customData,
        actions: {
          callback_url: input.callbackUrl,
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.response_code === "00" && json.token) {
      // PayDunya returns the checkout URL in `checkout_url` (live) or inside
      // `response_text` (sandbox); fall back to building it from the token.
      const fromText = typeof json.response_text === "string" && json.response_text.startsWith("http")
        ? json.response_text
        : undefined;
      const redirectUrl = json.checkout_url || fromText || `https://paydunya.com/checkout/invoice/${json.token}`;
      return { success: true, token: json.token, redirectUrl };
    }
    return { success: false, error: json.response_text ?? `PayDunya error (${res.status})` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "PayDunya request failed" };
  }
}

export async function confirmInvoice(
  cfg: PaydunyaConfig,
  token: string
): Promise<ConfirmInvoiceResult> {
  try {
    const res = await fetch(`${baseUrl(cfg.mode)}/checkout-invoice/confirm/${token}`, {
      method: "GET",
      headers: headers(cfg),
    });
    const json = await res.json().catch(() => ({}));
    if (json.response_code === "00") {
      return { success: true, status: json.status, customData: json.custom_data };
    }
    return { success: false, error: json.response_text ?? `PayDunya error (${res.status})` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "PayDunya request failed" };
  }
}
