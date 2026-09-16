/* utils/format.js — Formatação de valores, datas e textos */

/** Formata BRL: 1500 -> "R$ 1.500,00" */
export function brl(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Número com separador pt-BR */
export function num(v) {
  return (Number(v) || 0).toLocaleString("pt-BR");
}

/** Data ISO/Date -> data curta pt-BR */
export function dateShort(v) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Data ISO/Date -> data + hora curta */
export function dateTime(v) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Hora curta (HH:MM) */
export function time(v) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Iniciais do nome para avatar */
export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Valida e-mail */
export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

/** Percentual seguro 0..100 */
export function pct(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(part) / Number(total)) * 100)));
}

/** Pluraliza simples */
export function plural(n, singular, pluralWord) {
  return n === 1 ? singular : (pluralWord || singular + "s");
}

/** Tempo restante em objeto {d,h,m,s} até uma data */
export function timeLeft(target) {
  const t = new Date(target).getTime() - Date.now();
  if (isNaN(t) || t <= 0) return { expired: true, d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(t / 1000);
  return {
    expired: false,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Numero de ticket formatado: 1234 -> TICKET #0001234 */
export function ticketCode(n) {
  return "#" + String(n || 0).padStart(6, "0");
}

let _ticketSeq = 1;
/** Gera um código de ticket sequencial por sessão (apenas visual). */
export function nextTicketCode() {
  return "TICKET #" + String(_ticketSeq++).padStart(5, "0");
}