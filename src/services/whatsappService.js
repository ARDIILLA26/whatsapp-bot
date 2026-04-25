const https = require("https");
const config = require("../../config/default");

function isWhatsAppConfigured() {
  return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
}

function sendTextMessage(to, body) {
  if (!isWhatsAppConfigured()) {
    console.log(`[WHATSAPP_DISABLED] ${to}: ${body}`);
    return Promise.resolve({ disabled: true });
  }

  const payload = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body,
    },
  });

  const options = {
    hostname: "graph.facebook.com",
    path: `/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        const ok = response.statusCode >= 200 && response.statusCode < 300;

        if (!ok) {
          return reject(
            new Error(`WhatsApp send failed (${response.statusCode}): ${data}`),
          );
        }

        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (error) {
          resolve({ raw: data });
        }
      });
    });

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

module.exports = {
  sendTextMessage,
  isWhatsAppConfigured,
};
