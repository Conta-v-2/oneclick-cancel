// engine.js — Motor de automação DOM genérico e resiliente.
// Compartilhado por todos os "playbooks" de site (netflix.js, spotify.js).
// Não contém nenhuma lógica específica de serviço — só primitivas.

const Engine = {
  /**
   * Aguarda um elemento aparecer no DOM (útil para SPAs que renderizam
   * de forma assíncrona). Usa MutationObserver em vez de polling fixo.
   */
  waitForElement(selector, { timeout = 10000, root = document } = {}) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(root, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout aguardando elemento: ${selector}`));
      }, timeout);
    });
  },

  /**
   * Tenta várias estratégias de seletor em ordem (fallback), já que
   * sites de grande escala trocam classes/IDs com frequência (A/B tests).
   * Cada estratégia é uma função (root) => Element | null.
   */
  async findWithFallback(strategies, { timeout = 8000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const strategy of strategies) {
        try {
          const el = strategy(document);
          if (el) return el;
        } catch (_) { /* estratégia inválida nesta página, ignora */ }
      }
      await Engine.sleep(300);
    }
    return null;
  },

  /** Clique resiliente: rola até o elemento e dispara eventos reais. */
  async click(element) {
    element.scrollIntoView({ block: "center", behavior: "instant" });
    await Engine.sleep(200);
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    });
  },

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  /** Busca por texto visível (útil quando não há seletor estável). */
  findByText(tag, textFragment, root = document) {
    const nodes = Array.from(root.querySelectorAll(tag));
    return nodes.find((n) =>
      n.textContent?.trim().toLowerCase().includes(textFragment.toLowerCase())
    ) || null;
  },

  log(text) {
    console.log(`[OneClickCancel] ${text}`);
    chrome.runtime.sendMessage({ type: "CONTENT_LOG", text });
  },

  reportResult(success, reason = "") {
    chrome.runtime.sendMessage({ type: "CANCEL_RESULT", success, reason });
  }
};
