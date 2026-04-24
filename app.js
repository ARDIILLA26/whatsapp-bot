const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const GRAPH_API_VERSION = "v25.0";

// --------------------------------
// HOME
// --------------------------------
app.get("/", (req, res) => {
  res.send("WhatsApp Bot funcionando 🚀");
});

// --------------------------------
// VERIFICACIÓN WEBHOOK
// --------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado");
    return res.status(200).send(challenge);
  }

  console.log("❌ Error verificación webhook");
  return res.sendStatus(403);
});

// --------------------------------
// RECIBIR MENSAJES
// --------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log("📩 Webhook recibido:");
    console.log(JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 👇 IMPORTANTE: detectar mensajes correctamente
    if (!value || !value.messages) {
      console.log("ℹ️ Evento sin mensajes (status, delivery, etc)");
      return res.sendStatus(200);
    }

    const message = value.messages[0];

    const from = message.from; // ya viene limpio (sin +)
    const type = message.type;
    const text = message.text?.body || "";

    console.log("👤 De:", from);
    console.log("📦 Tipo:", type);
    console.log("💬 Texto:", text);

    if (type !== "text") {
      await sendMessage(from, "Solo puedo responder texto por ahora 🙏");
      return res.sendStatus(200);
    }

    // 👉 RESPUESTA AUTOMÁTICA
    const reply = `Hola 👋 Recibí: "${text}"`;

    await sendMessage(from, reply);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error.message);
    res.sendStatus(200);
  }
});

// --------------------------------
// ENVIAR MENSAJE
// --------------------------------
async function sendMessage(to, message) {
  try {
    // limpiar número (por si acaso)
    const cleanTo = String(to).replace(/\D/g, "");

    console.log("📤 Enviando a:", cleanTo);

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "text",
      text: {
        body: message,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log("📡 Status:", response.status);
    console.log("📡 Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    return data;
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error.message);
  }
}

// --------------------------------
// START SERVER
// --------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
