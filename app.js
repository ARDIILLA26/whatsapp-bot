const express = require("express");
const app = express();

app.use(express.json());

// 🔥 VERIFICACIÓN WEBHOOK
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "caceres123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("VERIFY:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFICADO ✅");
    return res.status(200).send(challenge); // 🔥 ESTA LÍNEA ES LA CLAVE
  } else {
    console.log("ERROR DE VERIFICACIÓN ❌");
    return res.sendStatus(403);
  }
});

// 🔥 RECIBIR MENSAJES
app.post("/webhook", (req, res) => {
  console.log("MENSAJE RECIBIDO:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// 🔥 PUERTO
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
