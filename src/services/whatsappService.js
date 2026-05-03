function normalizeWhatsAppRecipient(to) {
  const digits = String(to || "").replace(/\D/g, "");

  if (digits.startsWith("521") && digits.length === 13) {
    return `52${digits.slice(3)}`;
  }

  return digits;
}

async function sendWhatsAppMessage(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("Faltan variables de entorno");
    return;
  }

  const recipient = normalizeWhatsAppRecipient(to);

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: {
          body: text,
        },
      }),
    }
  );

  const data = await response.json();
  console.log("Respuesta Meta:", data);
}

module.exports = { sendWhatsAppMessage };
