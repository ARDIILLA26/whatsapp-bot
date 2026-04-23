const express = require("express");
const app = express();

app.use(express.json());

// 🔑 Token (DEBE ser igual en Meta)
const VERIFY_TOKEN = "caceres123";

// =============================
// 🔵 VERIFICACIÓN DEL WEBHOOK
// =============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("=== VERIFICACIÓN WEBHOOK ===");
  console.log("MODE:", mode);
  console.log("TOKEN RECIBIDO:", token);
  console.log("TOKEN CORRECTO:", VERIFY_TOKEN);

  // 🔥 IMPORTANTE: acepta ambos por si el navegador traduce
  if ((mode === "subscribe" || mode === "suscribirse") && token === VERIFY_TOKEN) {
    return res.status(200).type("text/plain").send(String(challenge));
  } else {
    return res.sendStatus(403);
  }
});

// =============================
// 🟢 RECEPCIÓN DE MENSAJES
// =============================
app.post("/webhook", (req, res) => {
  console.log("Mensaje recibido:");
  console.log(JSON.stringify(req.body, null, 2));
  return res.sendStatus(200);
});

// =============================
// 🚀 INICIAR SERVIDOR
// =============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
