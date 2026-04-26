const url = require("url");

function createServerHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === "GET" && parsedUrl.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Servidor funcionando 🚀");
  }

  if (req.method === "GET" && parsedUrl.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  // Aquí puedes conectar tu lógica de WhatsApp después

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Ruta no encontrada");
}

module.exports = {
  createServerHandler,
};