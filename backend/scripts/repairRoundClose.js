/* scripts/repairRoundClose.js — realinha o fechamento das rodadas com a regra única.

   Conserta a inconsistência que motivou o refactor: rodada fechada (ou já vencida
   pela regra "1º jogo − 2h") com tickets ainda marcados como "released" — o que
   deixava o usuário tentar palpitar depois do encerramento.

   Uso (a partir da pasta backend/):
     node scripts/repairRoundClose.js --dry        # só mostra o que faria
     node scripts/repairRoundClose.js              # rodadas open/closed
     node scripts/repairRoundClose.js --round 28
     node scripts/repairRoundClose.js --all        # inclui as finished

   Requer MONGODB_URI no backend/.env.
   ATENÇÃO: grava no MESMO banco Atlas usado pelo ambiente publicado. */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const config = require("../src/config/env");
const Round = require("../src/models/Round");
const Ticket = require("../src/models/Ticket");
const { closesAt, isRoundOpenForPicks, autoCloseIfDue } = require("../src/services/roundLifecycle");

function parseArgs(argv) {
  const args = { round: null, dry: false, all: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry" || arg === "--dry-run") args.dry = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--round") { args.round = Number(argv[i + 1]); i += 1; }
    else if (arg.startsWith("--round=")) args.round = Number(arg.split("=")[1]);
  }
  return args;
}

const fmt = (v) => (v ? new Date(v).toISOString() : "—");

async function main() {
  const args = parseArgs(process.argv);
  if (!config.mongodbUri) throw new Error("MONGODB_URI não configurada no backend/.env.");

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 15000 });

  const filter = args.round
    ? { number: args.round }
    : (args.all ? {} : { status: { $in: ["open", "closed"] } });
  const rounds = await Round.find(filter).sort({ number: 1 });
  if (!rounds.length) throw new Error("Nenhuma rodada encontrada com esse filtro.");

  console.log("=".repeat(78));
  console.log(args.dry ? "MODO DRY-RUN — nada será gravado" : "GRAVANDO em " + String(config.mongodbUri).replace(/\/\/[^@]+@/, "//***@"));
  console.log("=".repeat(78));

  let roundsClosed = 0;
  let ticketsFixed = 0;

  for (const round of rounds) {
    const limit = closesAt(round);
    const openForPicks = isRoundOpenForPicks(round);
    const released = await Ticket.countDocuments({ roundId: round._id, status: "released" });

    console.log(`\nRodada ${round.number} (${round._id}) | status=${round.status}${round.manualOverride ? " [controle manual]" : ""}`);
    console.log(`  fecha em: ${fmt(limit)} (${limit == null ? "sem data divulgada" : Date.now() >= limit ? "vencido" : "no futuro"}) | aceita palpites: ${openForPicks ? "sim" : "NÃO"} | tickets released: ${released}`);

    if (openForPicks) { console.log("  nada a fazer: rodada aberta e aceitando palpites."); continue; }

    if (round.status === "open") {
      // Venceu no relógio e o timer/cron ainda não persistiu: fecha pelo caminho oficial.
      if (args.dry) { console.log(`  [dry] autoCloseIfDue -> fecharia a rodada e marcaria ${released} ticket(s)`); continue; }
      const res = await autoCloseIfDue(round);
      if (res.closed) {
        roundsClosed += 1;
        ticketsFixed += res.ticketsUpdated;
        console.log(`  OK fechada pelo relógio; ${res.ticketsUpdated} ticket(s) -> closed`);
      } else {
        console.log(`  ! autoCloseIfDue não fechou (${res.reason})`);
      }
      continue;
    }

    if (!released) { console.log("  nada a fazer: estado coerente."); continue; }
    if (args.dry) { console.log(`  [dry] marcaria ${released} ticket(s) released -> closed`); continue; }

    const up = await Ticket.updateMany(
      { roundId: round._id, status: "released" },
      { $set: { status: "closed" } }
    );
    ticketsFixed += up.modifiedCount || 0;
    console.log(`  OK ${up.modifiedCount || 0} ticket(s) released -> closed`);
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(`RESUMO${args.dry ? " (simulado)" : ""}: rodadas fechadas agora=${roundsClosed} | tickets alinhados=${ticketsFixed}`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("\nERRO: " + (e && e.message ? e.message : e));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
