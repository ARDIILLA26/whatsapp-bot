app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "caceres123") {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});
