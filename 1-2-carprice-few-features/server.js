const path = require("path");
const express = require("express");

const app = express();
const publicDir = path.join(__dirname, "public");
const basePort = Number(process.env.PORT) || 3858;
const maxPortAttempts = 25;

app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

function tryListen(port, attemptsLeft) {
  if (attemptsLeft <= 0) {
    console.error("Не удалось найти свободный порт.");
    process.exit(1);
  }

  const server = app.listen(port);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Порт ${port} занят, пробуем ${port + 1}…`);
      tryListen(port + 1, attemptsLeft - 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.on("listening", () => {
    const addr = server.address();
    const p = typeof addr === "object" && addr ? addr.port : port;
    console.log(`Car price (mileage + engine) demo: http://localhost:${p}`);
  });
}

tryListen(basePort, maxPortAttempts);
