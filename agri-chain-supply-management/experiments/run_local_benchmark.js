const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = 5099;
const serverPath = path.join(__dirname, "../backend/server.js");
const benchmarkPath = path.join(__dirname, "load_test_native.js");

console.log(`Starting transient backend server on port ${PORT}...`);
const serverProcess = spawn("node", [serverPath], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "development",
    JWT_SECRET: "development-transient-benchmark-secret-key-32chars"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

serverProcess.stdout.on("data", (d) => process.stdout.write(`[SERVER] ${d}`));
serverProcess.stderr.on("data", (d) => process.stderr.write(`[SERVER ERR] ${d}`));

function waitForServer(retries = 30) {
  if (retries <= 0) {
    console.error("Server failed to start in time.");
    serverProcess.kill();
    process.exit(1);
  }

  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      console.log("Server is ready! Running benchmark...");
      runBench();
    } else {
      setTimeout(() => waitForServer(retries - 1), 200);
    }
  });

  req.on("error", () => {
    setTimeout(() => waitForServer(retries - 1), 200);
  });
}

function runBench() {
  const bench = spawn("node", [
    benchmarkPath,
    "--url", `http://localhost:${PORT}`,
    "--endpoint", "/api/products",
    "--users", "10",
    "--requests", "100"
  ], { stdio: "inherit" });

  bench.on("exit", (code) => {
    console.log(`Benchmark exited with code ${code}. Stopping server...`);
    serverProcess.kill();
    process.exit(code);
  });
}

waitForServer();
