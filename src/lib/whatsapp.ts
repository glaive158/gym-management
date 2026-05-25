export interface WhatsAppMessage {
  to: string;
  body: string;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.log("\n📱 WHATSAPP (dev fallback, WHATSAPP_TOKEN not set):");
    console.log(`  To:   ${msg.to}`);
    console.log(`  Body: ${msg.body}\n`);
    return;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "text",
      text: { body: msg.body },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${t}`);
  }
}
