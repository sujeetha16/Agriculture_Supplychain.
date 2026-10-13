/**
 * Safely parses and resolves a product/batch ID from various QR payload formats:
 * 1. JSON payload: {"productId": 101} or {"id": 101}
 * 2. URL payload: https://host/trace/101 or /trace/101
 * 3. Text payload: "101" or "#101" or "BATCH-101"
 *
 * @param {string} payload - Raw text decoded from QR optical scanner or file
 * @returns {{ success: boolean, productId?: number, error?: string }}
 */
function parseQRPayload(payload) {
  if (!payload || typeof payload !== "string") {
    return { success: false, error: "Payload must be a non-empty string" };
  }

  const trimmed = payload.trim();
  if (!trimmed) {
    return { success: false, error: "Empty QR code payload" };
  }

  // 1. Try parsing JSON format (any string starting with {)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawId = parsed.productId !== undefined ? parsed.productId : parsed.id;
      if (rawId !== undefined && rawId !== null && rawId !== "") {
        const num = Number(rawId);
        if (Number.isInteger(num) && num > 0) {
          return { success: true, productId: num };
        }
      }
      return { success: false, error: "JSON QR payload does not contain a valid positive integer productId" };
    } catch {
      return { success: false, error: "Malformed JSON payload in QR code" };
    }
  }

  // 2. Try URL format: /trace/123 or https://domain/trace/123
  const urlMatch = trimmed.match(/\/trace\/(\d+)(?:[/?#]|$)/i);
  if (urlMatch && urlMatch[1]) {
    const num = Number(urlMatch[1]);
    if (Number.isInteger(num) && num > 0) {
      return { success: true, productId: num };
    }
  }

  // 3. Try raw number or #123 or BATCH-123
  const batchMatch = trimmed.match(/^(?:#|BATCH-)?(\d+)$/i);
  if (batchMatch && batchMatch[1]) {
    const num = Number(batchMatch[1]);
    if (Number.isInteger(num) && num > 0) {
      return { success: true, productId: num };
    }
  }

  return { success: false, error: `Unrecognized QR format: "${trimmed.slice(0, 40)}"` };
}

module.exports = { parseQRPayload };
