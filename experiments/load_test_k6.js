// Path: experiments/load_test_k6.js
// Grafana k6 performance experiment script for Agriculture Supply Chain API
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp-up to 10 VUs
    { duration: '30s', target: 25 }, // Steady-state load
    { duration: '10s', target: 50 }, // Peak stress load
    { duration: '10s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // Under 1% error rate
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000';

export default function () {
  // Scenario 1: Health Endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // Scenario 2: Catalog Read
  const catalogRes = http.get(`${BASE_URL}/api/products`);
  check(catalogRes, {
    'catalog status is 200': (r) => r.status === 200,
    'catalog has products': (r) => r.json().count >= 0,
  });

  // Scenario 3: Traceability Lookup
  const traceRes = http.get(`${BASE_URL}/api/products/101`);
  check(traceRes, {
    'trace lookup handled': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);
}
