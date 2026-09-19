// netflix.js — Playbook de cancelamento para a Netflix.
// IMPORTANTE: seletores abaixo são ILUSTRATIVOS. A Netflix muda o DOM
// com frequência — antes de rodar em produção, inspecione a página real
// (DevTools) e ajuste `strategies` e os textos de `findByText`.

async function runNetflixCancelFlow() {
  try {
    Engine.log("Netflix: procurando link 'Cancelar assinatura'…");

    // 1) Passo: encontrar o botão/link inicial de cancelamento na página de conta
    const cancelLink = await Engine.findWithFallback([
      (root) => root.querySelector('[data-uia="action-cancel-plan"]'),
      (root) => root.querySelector('a[href*="cancelplan"]'),
      (root) => Engine.findByText("a", "cancelar assinatura", root),
      (root) => Engine.findByText("button", "cancelar assinatura", root)
    ]);

    if (!cancelLink) throw new Error("Botão inicial de cancelamento não encontrado.");
    await Engine.click(cancelLink);
    Engine.log("Netflix: clique no link de cancelamento realizado.");

    // 2) Passo: tela de retenção ("dark pattern") — Netflix costuma oferecer
    // pausa/desconto antes de deixar cancelar de fato. Procuramos o botão
    // que segue o fluxo de cancelamento em vez do de retenção.
    await Engine.sleep(1000);
    const proceedBtn = await Engine.findWithFallback([
      (root) => root.querySelector('[data-uia="action-finish-cancellation"]'),
      (root) => Engine.findByText("button", "concluir cancelamento", root),
      (root) => Engine.findByText("button", "continuar cancelando", root),
      (root) => Engine.findByText("button", "sim, cancelar", root)
    ], { timeout: 6000 });

    if (proceedBtn) {
      await Engine.click(proceedBtn);
      Engine.log("Netflix: tela de retenção contornada.");
      await Engine.sleep(1000);
    }

    // 3) Passo: confirmação final
    const confirmBtn = await Engine.findWithFallback([
      (root) => root.querySelector('[data-uia="action-confirm-cancel"]'),
      (root) => Engine.findByText("button", "confirmar cancelamento", root),
      (root) => Engine.findByText("button", "concluído", root)
    ], { timeout: 6000 });

    if (confirmBtn) {
      await Engine.click(confirmBtn);
      Engine.log("Netflix: confirmação final enviada.");
    }

    // 4) Passo: validação de sucesso (procura mensagem de confirmação na página)
    await Engine.sleep(1500);
    const successEl = await Engine.findWithFallback([
      (root) => Engine.findByText("h1", "cancelad", root),
      (root) => Engine.findByText("div", "sua assinatura foi cancelada", root)
    ], { timeout: 5000 });

    if (successEl) {
      Engine.reportResult(true);
    } else {
      Engine.reportResult(false, "Não foi possível confirmar a mensagem de sucesso na tela.");
    }
  } catch (err) {
    Engine.log(`Netflix: erro — ${err.message}`);
    Engine.reportResult(false, err.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_CANCEL_FLOW" && message.service === "netflix") {
    runNetflixCancelFlow();
    sendResponse({ ack: true });
  }
});
