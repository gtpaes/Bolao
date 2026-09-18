const { createApp } = require("./src/app");

// Smoke test: sobe o app e testa rotas públicas sem banco.
async function smoke() {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const results = [];
  async function check(path, expectStatus) {
    const res = await fetch(`${base}${path}`);
    const body = await res.json().catch(() => ({}));
    const ok = res.status === expectStatus;
    results.push(`${ok ? "OK " : "FALHA"} ${path} -> ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
    return ok;
  }
  const ok =
    (await check("/", 404)) &
    (await check("/api/health", 200)) &
    (await check("/api/rounds/current", 401)) &
    (await check("/rota-inexistente", 404)) &
    (await (async () => {
      // registro com body inválido -> 400 padronizado
      const res = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "x", password: "1" }),
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.status === 400 && body.error === "VALIDATION_ERROR";
      results.push(`${ok ? "OK " : "FALHA"} POST /api/auth/register (inválido) -> ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
      return ok;
    })());
  server.close();
  console.log(results.join("\n"));
  console.log(ok ? "SMOKE-OK" : "SMOKE-FAIL");
  // Pequena espera para o libuv encerrar os handles sem ruído no Windows.
  setTimeout(() => process.exit(ok ? 0 : 1), 200).unref();
  setTimeout(() => process.exit(ok ? 0 : 1), 500);
}
smoke().catch((e) => { console.error(e); process.exit(1); });
