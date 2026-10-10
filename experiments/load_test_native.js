// Path: experiments/load_test_native.js
// High-concurrency zero-dependency benchmark harness for Agriculture Supply Chain API

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    url: "http://localhost:5000",
    endpoint: "/api/products",
    users: 25,
    requests: 250,
    output: path.join(__dirname, "latest_benchmark_results.json")
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) config.url = args[++i];
    if (args[i] === "--endpoint" && args[i + 1]) config.endpoint = args[++i];
    if (args[i] === "--users" && args[i + 1]) config.users = parseInt(args[++i], 10);
    if (args[i] === "--requests" && args[i + 1]) config.requests = parseInt(args[++i], 10);
    if (args[i] === "--output" && args[i + 1]) config.output = args[++i];
  }
  return config;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const index = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, Math.min(index, arr.length - 1))];
}

async function runBenchmark() {
  const config = parseArgs();
  const targetUrl = `${config.url.replace(/\/$/, "")}${config.endpoint}`;

  console.log("=================================================================");
  console.log("  AGRICULTURE SUPPLY CHAIN API PERFORMANCE EXPERIMENT HARNESS");
  console.log("=================================================================");
  console.log(`Target URL:            ${targetUrl}`);
  console.log(`Concurrent VUs:        ${config.users}`);
  console.log(`Total Requests:        ${config.requests}`);
  console.log(`Timestamp:             ${new Date().toISOString()}`);
  console.log("-----------------------------------------------------------------");
  console.log("Warming up connections...");

  // Quick connectivity check
  try {
    const probe = await fetch(targetUrl);
    if (!probe.ok && probe.status !== 401 && probe.status !== 403) {
      console.warn(`[Warning] Health probe returned HTTP ${probe.status}`);
    }
  } catch (err) {
    console.error(`[Error] Target endpoint unreachable: ${err.message}`);
    process.exit(1);
  }

  const latencies = [];
  let successCount = 0;
  let failureCount = 0;
  let requestCounter = 0;

  const startTime = Date.now();

  async function worker() {
    while (true) {
      const currentReqIndex = ++requestCounter;
      if (currentReqIndex > config.requests) break;

      const reqStart = performance.now();
      try {
        const res = await fetch(targetUrl, {
          headers: { "x-benchmark-run": "native-harness" }
        });
        const reqEnd = performance.now();
        const duration = reqEnd - reqStart;

        latencies.push(duration);
        if (res.ok) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (err) {
        const reqEnd = performance.now();
        latencies.push(reqEnd - reqStart);
        failureCount++;
      }
    }
  }

  console.log("Executing workload...");
  const workers = Array.from({ length: config.users }, () => worker());
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startTime;
  const throughputRps = (config.requests / (totalDurationMs / 1000)).toFixed(2);

  latencies.sort((a, b) => a - b);

  const summary = {
    testParameters: {
      targetUrl,
      concurrencyVUs: config.users,
      totalRequests: config.requests,
      timestamp: new Date().toISOString()
    },
    performanceMetrics: {
      totalDurationMs,
      throughputRps: Number(throughputRps),
      successCount,
      failureCount,
      errorRatePercent: Number(((failureCount / config.requests) * 100).toFixed(2)),
      latencyMs: {
        min: Number(latencies[0].toFixed(2)),
        p50: Number(percentile(latencies, 50).toFixed(2)),
        p90: Number(percentile(latencies, 90).toFixed(2)),
        p95: Number(percentile(latencies, 95).toFixed(2)),
        p99: Number(percentile(latencies, 99).toFixed(2)),
        max: Number(latencies[latencies.length - 1].toFixed(2))
      }
    }
  };

  console.log("-----------------------------------------------------------------");
  console.log("  EXPERIMENTAL RUN COMPLETED");
  console.log("-----------------------------------------------------------------");
  console.log(`Total Duration:        ${(totalDurationMs / 1000).toFixed(2)} seconds`);
  console.log(`Throughput:            ${summary.performanceMetrics.throughputRps} req/sec`);
  console.log(`Success Rate:          ${((successCount / config.requests) * 100).toFixed(1)}% (${successCount}/${config.requests})`);
  console.log(`Error Rate:            ${summary.performanceMetrics.errorRatePercent}%`);
  console.log(`Latency p50 (Median):  ${summary.performanceMetrics.latencyMs.p50} ms`);
  console.log(`Latency p90:           ${summary.performanceMetrics.latencyMs.p90} ms`);
  console.log(`Latency p95:           ${summary.performanceMetrics.latencyMs.p95} ms`);
  console.log(`Latency p99:           ${summary.performanceMetrics.latencyMs.p99} ms`);
  console.log(`Latency Max:           ${summary.performanceMetrics.latencyMs.max} ms`);
  console.log("-----------------------------------------------------------------");

  fs.writeFileSync(config.output, JSON.stringify(summary, null, 2));
  console.log(`Structured metrics recorded to: ${config.output}`);
  console.log("=================================================================");
}

runBenchmark();
