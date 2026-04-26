const http = require("http");
const { createServerHandler } = require("./services/httpServer");

const port = Number(process.env.PORT) || 10000;

const server = http.createServer(createServerHandler());

server.listen(port, "0.0.0.0", () => {
  console.log(`WhatsApp chatbot escuchando en puerto ${port}`);
});