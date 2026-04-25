const http = require("http");
const { createServerHandler } = require("./src/services/httpServer");
const { ensureDataFiles } = require("./src/services/storageService");
const { loadEnvFile } = require("./src/utils/env");

loadEnvFile();
ensureDataFiles();

const port = Number(process.env.PORT || 3000);
const server = http.createServer(createServerHandler());

server.listen(port, () => {
  console.log(`WhatsApp chatbot escuchando en puerto ${port}`);
});
