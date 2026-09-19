// background.js — Service Worker (Manifest V3)
// Orquestra: abre a aba do serviço, aguarda o content script sinalizar
// que está pronto, dispara o fluxo de cancelamento e repassa o status
// de volta para o popup. Nenhuma credencial passa por aqui — a aba usa
// a sessão já autenticada do próprio navegador do usuário.

const SERVICE_CONFIG = {
  netflix: {
    url: "https://www.netflix.com/youraccount",
    label: "Netflix"
  },
  spotify: {
    url: "https://www.spotify.com/account/subscription/cancel/",
    label: "Spotify"
  }
};

// Estado em memória do job atual (um job por vez neste MVP).
let currentJob = null; // { service, tabId, status, log[] }

function log(message) {
  if (!currentJob) return;
  const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
  currentJob.log.push(entry);
  broadcastStatus();
}

function broadcastStatus() {
  if (!currentJob) return;
  chrome.runtime.sendMessage({
    type: "STATUS_UPDATE",
    payload: {
      service: currentJob.service,
      status: currentJob.status,
      log: currentJob.log
    }
  }).catch(() => {
    // Popup pode estar fechado — sem problema, o estado fica salvo em storage.
  });
  chrome.storage.local.set({ lastJob: currentJob });
}

async function startCancellation(serviceKey) {
  const config = SERVICE_CONFIG[serviceKey];
  if (!config) throw new Error(`Serviço desconhecido: ${serviceKey}`);

  currentJob = {
    service: serviceKey,
    tabId: null,
    status: "opening_tab",
    log: []
  };
  log(`Iniciando cancelamento — ${config.label}`);

  // active: false → aba abre em segundo plano, sem tirar o foco do usuário.
  const tab = await chrome.tabs.create({ url: config.url, active: false });
  currentJob.tabId = tab.id;
  currentJob.status = "waiting_page_load";
  log("Aba aberta em segundo plano, aguardando carregamento…");

  return new Promise((resolve) => {
    const onUpdated = (tabId, info) => {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Pequeno delay para SPA renderizar o DOM dinâmico (React/Next).
        setTimeout(() => triggerContentScript(serviceKey, resolve), 1500);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function triggerContentScript(serviceKey, resolve) {
  if (!currentJob || !currentJob.tabId) return;
  currentJob.status = "running_automation";
  log("Executando script de automação na página…");

  chrome.tabs.sendMessage(
    currentJob.tabId,
    { type: "START_CANCEL_FLOW", service: serviceKey },
    (response) => {
      if (chrome.runtime.lastError) {
        currentJob.status = "error";
        log(`Erro de comunicação com a página: ${chrome.runtime.lastError.message}`);
        resolve(currentJob);
        return;
      }
      resolve(currentJob);
    }
  );
}

// Recebe atualizações de progresso vindas do content script (engine.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CONTENT_LOG" && currentJob) {
    log(message.text);
  }

  if (message.type === "CANCEL_RESULT" && currentJob) {
    currentJob.status = message.success ? "success" : "failed";
    log(message.success ? "✅ Cancelamento concluído com sucesso." : `❌ Falha: ${message.reason}`);

    // Fecha a aba em segundo plano após concluir (sucesso ou falha final).
    if (currentJob.tabId) {
      chrome.tabs.remove(currentJob.tabId).catch(() => {});
    }
  }

  if (message.type === "GET_LAST_JOB") {
    sendResponse(currentJob);
    return true;
  }

  if (message.type === "START_CANCELLATION") {
    startCancellation(message.service).then(() => broadcastStatus());
    sendResponse({ started: true });
    return true;
  }
});
