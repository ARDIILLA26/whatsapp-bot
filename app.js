const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "caceres123";

// 🔐 Verificación del webhook (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("=== VERIFICACIÓN WEBHOOK ===");
  console.log("mode:", mode);
  console.log("token:", token);
  console.log("challenge:", challenge);

  // ⚠️ IMPORTANTE: solo "subscribe" (NO traducido)
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.set("Content-Type", "text/plain");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 📩 Recepción de mensajes de WhatsApp
app.post("/webhook", (req, res) => {
  console.log("Mensaje recibido:");
  console.log(JSON.stringify(req.body, null, 2));

  return res.sendStatus(200);
});

// 🚀 Servidor
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
