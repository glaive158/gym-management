import { describe, it, expect, vi, afterEach } from "vitest";
import { createInvoice, confirmInvoice, paydunyaConfigFromEnv, type PaydunyaConfig } from "@/lib/paydunya";

const cfg: PaydunyaConfig = {
  mode: "test",
  masterKey: "MK",
  privateKey: "PK",
  token: "TK",
  storeName: "Kaytech Gym",
};

afterEach(() => { vi.restoreAllMocks(); });

describe("createInvoice", () => {
  it("hits sandbox URL with auth headers and returns token + redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ response_code: "00", token: "abc123", checkout_url: "https://paydunya.com/checkout/invoice/abc123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await createInvoice(cfg, {
      amount: 25000, description: "Abo Mensuel", customData: { intentId: "i1" },
      callbackUrl: "https://x/cb", returnUrl: "https://x/ok", cancelUrl: "https://x/no",
    });

    expect(r.success).toBe(true);
    expect(r.token).toBe("abc123");
    expect(r.redirectUrl).toContain("abc123");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create");
    expect(opts.headers["PAYDUNYA-MASTER-KEY"]).toBe("MK");
    expect(JSON.parse(opts.body).invoice.total_amount).toBe(25000);
  });

  it("uses response_text URL when checkout_url absent (sandbox)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ response_code: "00", token: "test_abc", response_text: "https://paydunya.com/sandbox-checkout/invoice/test_abc" }),
    }));
    const r = await createInvoice(cfg, {
      amount: 1000, description: "x", customData: {}, callbackUrl: "a", returnUrl: "b", cancelUrl: "c",
    });
    expect(r.success).toBe(true);
    expect(r.redirectUrl).toBe("https://paydunya.com/sandbox-checkout/invoice/test_abc");
  });

  it("returns error when response_code not 00", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200, json: async () => ({ response_code: "1001", response_text: "Bad keys" }),
    }));
    const r = await createInvoice(cfg, {
      amount: 1000, description: "x", customData: {}, callbackUrl: "a", returnUrl: "b", cancelUrl: "c",
    });
    expect(r.success).toBe(false);
    expect(r.error).toBe("Bad keys");
  });

  it("uses live URL in live mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ response_code: "00", token: "t", checkout_url: "u" }) });
    vi.stubGlobal("fetch", fetchMock);
    await createInvoice({ ...cfg, mode: "live" }, {
      amount: 1, description: "x", customData: {}, callbackUrl: "a", returnUrl: "b", cancelUrl: "c",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.paydunya.com/api/v1/checkout-invoice/create");
  });
});

describe("confirmInvoice", () => {
  it("returns status + customData on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ response_code: "00", status: "completed", custom_data: { intentId: "i1" } }),
    }));
    const r = await confirmInvoice(cfg, "abc123");
    expect(r.success).toBe(true);
    expect(r.status).toBe("completed");
    expect(r.customData?.intentId).toBe("i1");
  });
});

describe("paydunyaConfigFromEnv", () => {
  it("returns null when keys missing", () => {
    const old = { ...process.env };
    delete process.env.PAYDUNYA_MASTER_KEY;
    delete process.env.PAYDUNYA_PRIVATE_KEY;
    delete process.env.PAYDUNYA_TOKEN;
    expect(paydunyaConfigFromEnv()).toBeNull();
    process.env = old;
  });
});
