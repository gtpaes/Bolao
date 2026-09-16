/* utils/storage.js — Wrapper seguro de acesso ao localStorage.
   Nunca armazena senhas nem dados financeiros sensíveis. */

const PREFIX = "bolao.";

/** Lê e faz parse de um valor JSON. Retorna fallback em falha. */
export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

/** Grava valor JSON. Retorna booleano de sucesso. */
export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/** Remove uma chave. */
export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) { /* noop */ }
}

/** Testa se armazenamento está disponível (modo anônimo). */
export function available() {
  try {
    const k = "__t__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}