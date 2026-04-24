const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const GRAPH_API_VERSION = "v25.0";
const TEST_NUMBER = "525645572771";

const processed = new Map();

app.get("/", (req, res) => {
  res.status(200).send("WhatsApp Bot funcionando");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  // Responder rápido a Meta para evitar reintentos
  res.sendStatus(200);

  processWebhook(req.body).catch((error) => {
    console.error("ERROR PROCESANDO WEBHOOK:", error.message);
  });
});

async function processWebhook(body) {
  console.log("WEBHOOK:", JSON.stringify(body, null, 2));

  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) {
    console.log("Evento sin mensaje. Ignorado.");
    return;
  }

  const from = message.from || "";
  const type = message.type;
  const text = message.text?.body || "";
  const timestamp = message.timestamp || "";

  const dedupeKey = `${from}-${type}-${text}-${timestamp}`;

  if (processed.has(dedupeKey)) {
    console.log("DUPLICADO IGNORADO:", dedupeKey);
    return;
  }

  processed.set(dedupeKey, Date.now());

  // limpiar memoria
  setTimeout(() => {
    processed.delete(dedupeKey);
  }, 15 * 60 * 1000);

  console.log("MENSAJE NUEVO");
  console.log("FROM:", from);
  console.log("TYPE:", type);
  console.log("TEXT:", text);
  console.log("TIMESTAMP:", timestamp);

  if (type !== "text") {
    await sendMessage(TEST_NUMBER, "Solo puedo responder mensajes de texto.");
    return;
  }

  await sendMessage(TEST_NUMBER, `Hola 👋 Recibí tu mensaje: "${text}"`);
}

async function sendMessage(to, body) {
  const cleanTo = String(to).replace(/\D/g, "");

  console.log("ENVIANDO A:", cleanTo);
  console.log("MENSAJE:", body);

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "text",
    text: {
      preview_url: false,
      body,
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

  console.log("META STATUS:", response.status);
  console.log("META RESPONSE:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
