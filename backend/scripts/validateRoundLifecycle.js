/* scripts/validateRoundLifecycle.js — valida a regra ÚNICA de fechamento contra o banco.

   Cria uma rodada TEMPORÁRIA (number -1: nunca vira a "rodada atual", porque a
   escolha é por number desc), exercita fechar / reabrir / voltar-ao-automático com
   tickets reais e apaga tudo no fim — inclusive se um passo falhar.

   Uso (a partir da pasta backend/):
     node scripts/validateRoundLifecycle.js
     node scripts/validateRoundLifecycle.js --dry   # só mostra o roteiro

   Requer MONGODB_URI no backend/.env. Grava no MESMO banco do ambiente publicado,
   mas apenas na rodada temporária, e limpa ao final. */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const config = require("../src/config/env");
const Round = require("../src/models/Round");
const Ticket = require("../src/models/Ticket");
const TicketCounter = require("../src/models/TicketCounter");
const User = require("../src/models/User");
const {
  closesAt, isRoundOpenForPicks, closeRound, reopenRound, setAutomatic, autoCloseIfDue,
} = require("../src/services/roundLifecycle");

const TEMP_ROUND_NUMBER = -1;
const HOUR = 60 * 60 * 1000;

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "  OK  " : "  FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (esperado ${JSON.stringify(expected)})`}`);
}

async function cleanup() {
  const found = await Round.findOne({ number: TEMP_ROUND_NUMBER }).select("_id").lean();
  if (!found) return;
  await Ticket.deleteMany({ roundId: found._id });
  await TicketCounter.deleteMany({ roundId: found._id });
  await Round.deleteOne({ _id: found._id });
}

async function main() {
  const dry = process.argv.includes("--dry") || process.argv.includes("--dry-run");
  if (!config.mongodbUri) throw new Error("MONGODB_URI não configurada no backend/.env.");

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 15000 });

  if (dry) {
    console.log("ROTEIRO (dry): rodada temporária number=-1, com 1 jogo em +4h e 1 ticket released.");
    console.log("1. aceita palpites  2. não fecha antes da hora  3. jogo movido p/ +1h -> janela vencida");
    console.log("4. autoCloseIfDue fecha e marca o ticket  5. reopen manual devolve o ticket");
    console.log("6. com controle manual a regra automática NÃO age  7. voltar ao automático refecha");
    console.log("8. fechar de novo é idempotente  -> limpeza");
    await mongoose.disconnect();
    return;
  }

  const user = await User.findOne({}).select("_id username").lean();
  if (!user) throw new Error("Nenhuma conta no banco para vincular o ticket temporário.");

  console.log("=".repeat(78));
  console.log("VALIDANDO a regra única de fechamento em " + String(config.mongodbUri).replace(/\/\/[^@]+@/, "//***@"));
  console.log(`conta do ticket temporário: ${user.username}`);
  console.log("=".repeat(78));

  try {
    await cleanup(); // remove restos de execuções anteriores

    const round = await Round.create({
      number: TEMP_ROUND_NUMBER,
      name: "TEMP — validação do ciclo de vida",
      status: "open",
      manualOverride: false,
      deadline: null,
      matches: [{
        externalId: -999999,
        home: "Time A",
        away: "Time B",
        startsAt: new Date(Date.now() + 4 * HOUR),
        status: "scheduled",
        enabledForTickets: true,
        isManual: true,
      }],
    });
    const ticket = await Ticket.create({
      userId: user._id,
      roundId: round._id,
      number: 1,
      unitPriceCents: 0,
      status: "released",
      picks: [],
      points: 0,
    });
    const ticketDbStatus = async () => (await Ticket.findById(ticket._id).select("status").lean()).status;
    const roundDbStatus = async () => (await Round.findById(round._id).select("status").lean()).status;
    console.log(`\nrodada temporária ${round._id} | fechamento previsto: ${new Date(closesAt(round)).toISOString()}`);

    console.log("\n1) janela aberta");
    check("palpites liberados", isRoundOpenForPicks(round), true);
    const early = await autoCloseIfDue(round);
    check("regra automática não age antes da hora", early.reason, "too-early");

    console.log("\n2) jogo antecipado: a janela (2h antes) já venceu");
    round.matches[0].startsAt = new Date(Date.now() + 1 * HOUR);
    await round.save();
    check("palpites bloqueados pelo relógio", isRoundOpenForPicks(round), false);

    console.log("\n3) fechamento automático");
    const auto = await autoCloseIfDue(round);
    check("fechou", auto.closed, true);
    check("tickets alinhados", auto.ticketsUpdated, 1);
    check("status da rodada no banco", await roundDbStatus(), "closed");
    check("status do ticket no banco", await ticketDbStatus(), "closed");

    console.log("\n4) admin reabre na mão");
    const reopened = await reopenRound(round._id, { manual: true });
    check("tickets liberados de volta", reopened.ticketsUpdated, 1);
    check("status aberto", reopened.round.status, "open");
    check("marcada como controle manual", reopened.round.manualOverride, true);
    check("status do ticket no banco", await ticketDbStatus(), "released");

    console.log("\n5) controle manual resiste à regra automática");
    const fresh = await Round.findById(round._id);
    const blocked = await autoCloseIfDue(fresh);
    check("regra automática não age", blocked.reason, "manual-override");
    check("palpites seguem liberados", isRoundOpenForPicks(fresh), true);
    check("status do ticket no banco", await ticketDbStatus(), "released");

    console.log("\n6) admin devolve ao automático");
    const backToAuto = await setAutomatic(round._id);
    check("controle manual limpo", backToAuto.round.manualOverride, false);
    const autoAgain = await autoCloseIfDue(backToAuto.round);
    check("fechou de novo", autoAgain.closed, true);
    check("tickets alinhados", autoAgain.ticketsUpdated, 1);

    console.log("\n7) fechar de novo é idempotente");
    const again = await closeRound(round._id, { manual: false });
    check("nada a mover no segundo fechamento", again.ticketsUpdated, 0);
    check("status segue closed", again.round.status, "closed");
  } finally {
    await cleanup();
    const leftover = await Round.countDocuments({ number: TEMP_ROUND_NUMBER });
    console.log(`\nlimpeza: rodada temporária removida (restantes: ${leftover})`);
    await mongoose.disconnect();
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(failures ? `RESULTADO: ${failures} verificação(ões) FALHARAM` : "RESULTADO: todas as verificações passaram");
  if (failures) process.exit(1);
}

main().catch(async (e) => {
  console.error("\nERRO: " + (e && e.message ? e.message : e));
  await cleanup().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
