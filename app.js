const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "caceres123";

// Verificación de Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibir mensajes
app.post("/webhook", (req, res) => {
  console.log("Mensaje recibido:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// Ruta base
app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
