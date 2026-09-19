// content-scripts/spotify.js
//
// Script de injecao (content script) para automatizar o cancelamento
// do plano Spotify Premium na web (open.spotify.com / www.spotify.com).
//
// Arquitetura:
//   - E autocontido: nao depende de nenhum outro arquivo alem deste.
//   - Usa async/await do inicio ao fim para deixar a sequencia de
//     passos legivel como uma receita, em vez de callbacks aninhados.
//   - Usa MutationObserver (nao setInterval "as cegas") para esperar
//     elementos aparecerem no DOM, o que e essencial porque o Spotify
//     e uma SPA (React) e renderiza conteudo de forma assincrona.
//   - Seletores SAO baseados em texto visivel sempre que possivel
//     (ex: procurar um <button> que contenha "cancelar"), porque
//     classes CSS e atributos data-* mudam com muito mais frequencia
//     do que os textos da interface (que sao os mesmos ao usuario).
//
// Fluxo disparado pelo popup.js -> background.js -> aqui:
//   Passo 1: confirma que estamos numa pagina do Spotify relacionada a
//            plano/assinatura.
//   Passo 2: localiza o botao/link de "mudar de plano" ou "cancelar
//            plano" por texto.
//   Passo 3: clica e aguarda a tela de retencao ("dark pattern"),
//            recusando a oferta se ela aparecer.
//   Passo 4: localiza e clica no botao final de confirmacao.

// ------------------------------------------------------------------
// Utilitarios de espera resiliente
// ------------------------------------------------------------------

/**
 * Remove acentos e normaliza para minusculas, para comparar texto de
 * forma tolerante a pequenas variacoes ("Cancelar" vs "cancelar" vs
 * "Cancelar assinatura").
 */
function normalizeText(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Procura, dentro de um conjunto de tags candidatas (ex: button, a,
 * span), o primeiro elemento clicavel cujo texto contenha algum dos
 * fragmentos informados. Retorna o elemento CLICAVEL (sobe ate o
 * <button>/<a> mais proximo, caso o texto esteja num <span> filho).
 */
function findClickableByText(fragments, tags = ["button", "a", "span", "div"]) {
  const normalizedFragments = fragments.map(normalizeText);
  const nodes = document.querySelectorAll(tags.join(","));

  for (const node of nodes) {
    if (!isVisible(node)) continue;

    const text = normalizeText(node.textContent);
    const matches = normalizedFragments.some((frag) => text.includes(frag));
    if (!matches) continue;

    const clickable = node.closest("button, a, [role='button']") || node;
    return clickable;
  }
  return null;
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Espera ate `timeout` ms por um elemento clicavel cujo texto contenha
 * algum dos fragmentos passados. Usa MutationObserver para reagir
 * assim que o React renderizar o elemento, em vez de ficar checando
 * em intervalos fixos e arbitrarios.
 */
function waitForTextElement(fragments, { timeout = 10000, tags } = {}) {
  return new Promise((resolve, reject) => {
    const existing = findClickableByText(fragments, tags);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = findClickableByText(fragments, tags);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Elemento com texto [${fragments.join(", ")}] nao encontrado em ${timeout}ms`));
    }, timeout);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clique resiliente: centraliza o elemento na tela e dispara eventos reais de mouse. */
async function robustClick(element) {
  element.scrollIntoView({ block: "center", behavior: "instant" });
  await sleep(250);
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

// ------------------------------------------------------------------
// Comunicacao de progresso com o popup (via background)
// ------------------------------------------------------------------

function sendStatus(text) {
  console.log(`[OneClickCancel/Spotify] ${text}`);
  chrome.runtime.sendMessage({ type: "CONTENT_LOG", text });
}

function sendResult(success, reason = "") {
  chrome.runtime.sendMessage({ type: "CANCEL_RESULT", success, reason });
}

// ------------------------------------------------------------------
// Fluxo principal de cancelamento (os 4 passos)
// ------------------------------------------------------------------

async function runSpotifyCancelFlow() {
  try {
    // ---- Passo 1: confirma que estamos numa pagina relevante -------
    sendStatus("Acessando página...");
    const onPlansPage = /spotify\.com/i.test(window.location.hostname);
    if (!onPlansPage) {
      throw new Error("Esta aba não está em um domínio do Spotify.");
    }
    await sleep(800);

    // ---- Passo 2: localiza o botao de mudar/cancelar plano ---------
    sendStatus("Localizando opção de cancelamento do plano...");
    const cancelEntryBtn = await waitForTextElement(
      ["cancelar plano", "cancelar premium", "cancelar assinatura", "mudar de plano", "gerenciar plano"],
      { timeout: 10000 }
    );
    await robustClick(cancelEntryBtn);
    sendStatus("Opção de cancelamento acionada, avançando...");

    // ---- Passo 3: tela de retencao ("dark pattern") -----------------
    sendStatus("Evitando barreiras de retenção...");
    await sleep(1000);
    const declineOfferBtn = await waitForTextElement(
      ["não, obrigado", "continuar cancelamento", "continuar com o cancelamento", "recusar oferta", "não quero"],
      { timeout: 6000 }
    ).catch(() => null);

    if (declineOfferBtn) {
      await robustClick(declineOfferBtn);
      sendStatus("Oferta de retenção recusada.");
      await sleep(1000);
    }

    // ---- Passo 4: confirmacao final do cancelamento -----------------
    sendStatus("Confirmando cancelamento...");
    const finalConfirmBtn = await waitForTextElement(
      ["confirmar cancelamento", "cancelar assinatura", "sim, cancelar", "confirmar"],
      { timeout: 8000 }
    );
    await robustClick(finalConfirmBtn);

    // ---- Validacao de sucesso ----------------------------------------
    await sleep(1500);
    const successEl = await waitForTextElement(
      ["assinatura cancelada", "plano cancelado", "seu plano foi cancelado"],
      { timeout: 6000 }
    ).catch(() => null);

    if (successEl) {
      sendStatus("Plano Cancelado com Sucesso!");
      sendResult(true);
    } else {
      sendStatus("Cancelamento enviado, mas não foi possível confirmar a mensagem de sucesso na tela.");
      sendResult(false, "Mensagem de sucesso não encontrada — verifique manualmente.");
    }
  } catch (err) {
    sendStatus(`Erro: ${err.message}`);
    sendResult(false, err.message);
  }
}

// ------------------------------------------------------------------
// Ponto de entrada: aguarda o comando do popup/background
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_CANCEL_FLOW" && message.service === "spotify") {
    runSpotifyCancelFlow();
    sendResponse({ ack: true });
  }
});
