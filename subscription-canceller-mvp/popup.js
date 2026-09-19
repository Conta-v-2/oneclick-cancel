// popup.js — UI do MVP. Apenas orquestra a chamada ao background e
// exibe o progresso; nenhuma lógica de automação vive aqui.

const cancelBtn = document.getElementById("cancel-btn");
const statusBox = document.getElementById("status-box");
const statusLabel = document.getElementById("status-label");
const logEl = document.getElementById("log");

const STATUS_LABELS = {
  opening_tab: "Abrindo aba em segundo plano…",
  waiting_page_load: "Carregando página da conta…",
  running_automation: "Executando automação…",
  success: "✅ Cancelado com sucesso",
  failed: "❌ Falha no cancelamento",
  error: "❌ Erro de execução"
};

function renderJob(job) {
  if (!job) return;
  statusBox.classList.remove("hidden");
  statusLabel.textContent = STATUS_LABELS[job.status] || job.status;
  logEl.textContent = (job.log || []).join("\n");
  logEl.scrollTop = logEl.scrollHeight;

  const finished = job.status === "success" || job.status === "failed" || job.status === "error";
  cancelBtn.disabled = !finished && job.status !== undefined;
}

// Restaura o último job ao reabrir o popup
chrome.runtime.sendMessage({ type: "GET_LAST_JOB" }, (job) => {
  if (job) renderJob(job);
});

// Escuta atualizações em tempo real enquanto o popup estiver aberto
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATUS_UPDATE") {
    renderJob(message.payload);
  }
});

cancelBtn.addEventListener("click", () => {
  const service = document.querySelector('input[name="service"]:checked').value;
  cancelBtn.disabled = true;
  statusBox.classList.remove("hidden");
  statusLabel.textContent = "Iniciando…";
  logEl.textContent = "";

  chrome.runtime.sendMessage({ type: "START_CANCELLATION", service });
});
