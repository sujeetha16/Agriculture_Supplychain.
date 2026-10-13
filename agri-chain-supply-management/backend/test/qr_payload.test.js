const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { parseQRPayload } = require("../utils/qrParser");

describe("QR Code Payload Resolution & Parser Suite", () => {
  test("1. Successfully parses standard JSON payload containing productId", () => {
    const payload = JSON.stringify({ productId: 101, name: "Organic Apples", verificationStatus: "CONFIRMED" });
    const result = parseQRPayload(payload);
    assert.equal(result.success, true);
    assert.equal(result.productId, 101);
  });

  test("2. Successfully parses JSON payload containing id property", () => {
    const payload = JSON.stringify({ id: 8801, action: "scan" });
    const result = parseQRPayload(payload);
    assert.equal(result.success, true);
    assert.equal(result.productId, 8801);
  });

  test("3. Successfully parses absolute HTTPS URL containing /trace/:id", () => {
    const url = "https://agrichain-trace.aws.com/trace/102?referrer=scanner";
    const result = parseQRPayload(url);
    assert.equal(result.success, true);
    assert.equal(result.productId, 102);
  });

  test("4. Successfully parses relative URL containing /trace/:id", () => {
    const url = "/trace/9088";
    const result = parseQRPayload(url);
    assert.equal(result.success, true);
    assert.equal(result.productId, 9088);
  });

  test("5. Successfully parses raw integer batch ID", () => {
    const result = parseQRPayload("101");
    assert.equal(result.success, true);
    assert.equal(result.productId, 101);
  });

  test("6. Successfully parses hash-prefixed batch ID (#8801)", () => {
    const result = parseQRPayload("#8801");
    assert.equal(result.success, true);
    assert.equal(result.productId, 8801);
  });

  test("7. Successfully parses BATCH-prefixed identifier (BATCH-9088)", () => {
    const result = parseQRPayload("BATCH-9088");
    assert.equal(result.success, true);
    assert.equal(result.productId, 9088);
  });

  test("8. Fails safely on malformed JSON payload", () => {
    const malformed = "{ productId: 101, name: broken ";
    const result = parseQRPayload(malformed);
    assert.equal(result.success, false);
    assert.match(result.error, /Malformed JSON/i);
  });

  test("9. Fails safely on JSON missing productId and id", () => {
    const payload = JSON.stringify({ name: "Unknown Item", location: "Warehouse" });
    const result = parseQRPayload(payload);
    assert.equal(result.success, false);
    assert.match(result.error, /valid positive integer productId/i);
  });

  test("10. Fails safely on JSON with negative or non-integer productId", () => {
    const payload = JSON.stringify({ productId: -5 });
    const result = parseQRPayload(payload);
    assert.equal(result.success, false);
    assert.match(result.error, /valid positive integer/i);
  });

  test("11. Fails safely on completely unrelated URL or text", () => {
    const result = parseQRPayload("https://google.com/search?q=apples");
    assert.equal(result.success, false);
    assert.match(result.error, /Unrecognized QR format/i);
  });

  test("12. Fails safely on empty, null, or non-string input", () => {
    assert.equal(parseQRPayload("").success, false);
    assert.equal(parseQRPayload("   ").success, false);
    assert.equal(parseQRPayload(null).success, false);
    assert.equal(parseQRPayload(undefined).success, false);
    assert.equal(parseQRPayload(123).success, false);
  });
});
