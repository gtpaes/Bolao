/* Contrato da integração com o Mercado Pago.

   Dois pontos já quebraram em produção e ficam travados aqui:
   1. o valor líquido (net_received_amount) chega em BRL decimal e precisa virar
      centavos inteiros — a Receita soma netAmountCents de todos os pagamentos;
   2. cancelGatewayPayment PRECISA existir e ser exportada: o paymentService a
      consome no cancelamento da compra, e sem o export o erro caía no catch e a
      cobrança era marcada como cancelada só no banco, nunca no gateway. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const config = require("../src/config/env");
const logger = require("../src/config/logger");
logger.level = "silent"; // os testes provocam falhas de propósito

const { toCents, createPixCharge, fetchGatewayPayment, cancelGatewayPayment } = require("../src/integrations/payment/mercadopago");

// A integração faz require("mercadopago") de forma preguiçosa dentro de cada função,
// então trocar o Module._load basta para substituir o SDK — sem rede e sem token real.
const realLoad = Module._load;
let fakeSdk = null;
function stubSdk(sdk) {
  fakeSdk = sdk;
  Module._load = function (request) {
    if (request === "mercadopago") return fakeSdk;
    return realLoad.apply(this, arguments);
  };
}

const baseToken = config.mp.accessToken;
const comToken = () => { config.mp.accessToken = "test-token"; };
function restoreSdk() {
  Module._load = realLoad;
  fakeSdk = null;
  config.mp.accessToken = baseToken;
}

// SDK falso: registra as chamadas para afirmarmos se o gateway foi — ou não — tocado.
function sdkFake({ get, create, cancel } = {}) {
  const calls = [];
  return {
    calls,
    MercadoPagoConfig: class { constructor(opts) { this.opts = opts; } },
    Payment: class {
      constructor(client) { this.client = client; }
      async get(args) { calls.push(["get", args]); return get ? get(args) : {}; }
      async create(args) { calls.push(["create", args]); return create ? create(args) : {}; }
      async cancel(args) { calls.push(["cancel", args]); return cancel ? cancel(args) : {}; }
    },
  };
}

test("o módulo exporta tudo que o paymentService consome", () => {
  const fns = { createPixCharge, fetchGatewayPayment, cancelGatewayPayment, toCents };
  for (const [nome, fn] of Object.entries(fns)) {
    assert.equal(typeof fn, "function", `${nome} deve ser exportada`);
  }
});

test("converte BRL decimal para centavos inteiros", () => {
  assert.equal(toCents(10), 1000);
  assert.equal(toCents(38.75), 3875);
  assert.equal(toCents(40), 4000);
  assert.equal(toCents(1.25), 125);
  assert.equal(toCents(0.01), 1);
});

test("arredonda com Math.round (não truncate)", () => {
  assert.equal(toCents(0.005), 1); // truncate daria 0
  assert.equal(toCents(1.004), 100);
  assert.equal(toCents(38.759), 3876);
});

test("zero é um valor válido", () => {
  assert.equal(toCents(0), 0);
  assert.notEqual(toCents(0), null);
});

test("valores negativos são convertidos (defensivo)", () => {
  assert.equal(toCents(-1.5), -150);
});

test("null vira null", () => {
  assert.equal(toCents(null), null);
});

test("undefined vira null", () => {
  assert.equal(toCents(undefined), null);
});

test("NaN vira null", () => {
  assert.equal(toCents(NaN), null);
});

test("Infinity vira null", () => {
  assert.equal(toCents(Infinity), null);
  assert.equal(toCents(-Infinity), null);
});

test("strings vira null (não coage)", () => {
  assert.equal(toCents("38.75"), null);
  assert.equal(toCents(""), null);
});

test("booleanos vira null", () => {
  assert.equal(toCents(true), null);
  assert.equal(toCents(false), null);
});

test("objetos vira null", () => {
  assert.equal(toCents({}), null);
  assert.equal(toCents([]), null);
});

test("converte um transaction_details realista do MP", async () => {
  const sdk = sdkFake({
    get: () => ({ status: "approved", transaction_details: { net_received_amount: 38.75, total_paid_amount: 40, fee: 1.25 } }),
  });
  try {
    comToken();
    stubSdk(sdk);
    const res = await fetchGatewayPayment("123456789");
    assert.equal(res.status, "approved");
    assert.equal(res.raw, "approved");
    assert.equal(res.netAmountCents, 3875);
    assert.equal(res.grossAmountCents, 4000);
    assert.equal(res.feeCents, 125);
    // O líquido somado à fee fecha exatamente com a bruta paga pelo comprador.
    assert.equal(res.netAmountCents + res.feeCents, res.grossAmountCents);
    assert.deepEqual(sdk.calls, [["get", { id: "123456789" }]]);
  } finally { restoreSdk(); }
});

test("transaction_details ausente vira null em todos os campos", async () => {
  const sdk = sdkFake({ get: () => ({ status: "pending" }) });
  try {
    comToken();
    stubSdk(sdk);
    const res = await fetchGatewayPayment("1");
    assert.equal(res.status, "pending");
    assert.equal(res.netAmountCents, null);
    assert.equal(res.grossAmountCents, null);
    assert.equal(res.feeCents, null);
  } finally { restoreSdk(); }
});

test("cancelar sem accessToken devolve null sem chamar o gateway", async () => {
  const sdk = sdkFake({ cancel: () => ({ status: "cancelled" }) });
  try {
    config.mp.accessToken = "";
    stubSdk(sdk);
    assert.equal(await cancelGatewayPayment("42"), null);
    assert.equal(sdk.calls.length, 0);
  } finally { restoreSdk(); }
});

test("cancelar sem id do gateway devolve null sem chamar o gateway", async () => {
  const sdk = sdkFake({ cancel: () => ({ status: "cancelled" }) });
  try {
    comToken();
    stubSdk(sdk);
    assert.equal(await cancelGatewayPayment(""), null);
    assert.equal(await cancelGatewayPayment(null), null);
    assert.equal(await cancelGatewayPayment(undefined), null);
    assert.equal(sdk.calls.length, 0);
  } finally { restoreSdk(); }
});

test("cancelamento bem-sucedido devolve o status do gateway", async () => {
  const sdk = sdkFake({ cancel: () => ({ status: "cancelled" }) });
  try {
    comToken();
    stubSdk(sdk);
    assert.equal(await cancelGatewayPayment(987654), "cancelled");
    assert.deepEqual(sdk.calls, [["cancel", { id: "987654" }]]);
  } finally { restoreSdk(); }
});

test("falha do gateway no cancelamento devolve null sem explodir", async () => {
  const sdk = sdkFake({ cancel: () => { throw new Error("gateway fora do ar"); } });
  try {
    comToken();
    stubSdk(sdk);
    assert.equal(await cancelGatewayPayment("7"), null);
  } finally { restoreSdk(); }
});