# OneClick Cancel — MVP

Extensão Chrome (Manifest V3) que automatiza o cancelamento de assinaturas Netflix e Spotify usando a sessão já autenticada do navegador do usuário.

## 1. Estrutura do projeto

```
subscription-canceller-mvp/
├── manifest.json              # Configuração MV3 (permissões, content scripts)
├── background.js              # Service worker — orquestra abas e mensagens
├── popup.html / .css / .js    # UI da extensão (seleção de serviço + status)
├── content-scripts/
│   ├── engine.js               # Motor genérico de automação DOM (reutilizável)
│   ├── netflix.js               # Playbook de cancelamento — Netflix
│   └── spotify.js               # Playbook de cancelamento — Spotify
├── icons/                      # Ícones da extensão (16/48/128px)
├── iniciar_mvp.bat             # Abre o Chrome já com a extensão carregada
└── README.md
```

**Por que essa arquitetura?**
- `engine.js` é agnóstico de site: só sabe "esperar elemento", "clicar com resiliência", "buscar por texto". Isso separa a lógica de automação (reaproveitável) da lógica de negócio (o passo a passo de cada site), o que facilita adicionar um 3º, 4º, 5º serviço sem tocar no core — um argumento de venda forte para um comprador.
- `background.js` nunca toca no DOM da página — só orquestra (abre aba, dispara o content script, recebe o resultado). Isso respeita o isolamento de contexto do MV3 e facilita testes.
- Cada playbook (`netflix.js`, `spotify.js`) é um arquivo curto e substituível — o ponto de manutenção mais provável quando os sites mudam o layout.

## 2. Como testar

1. Extraia a pasta do projeto em qualquer lugar do seu PC (Windows).
2. Dê duplo clique em `iniciar_mvp.bat` — ele abre o Chrome direto em `chrome://extensions` e imprime o passo a passo no console.
3. Ative o **"Modo do desenvolvedor"** (canto superior direito da página).
4. Clique em **"Carregar sem compactação"** e selecione a pasta do projeto (a que contém `manifest.json`).
5. Confirme que o card **"OneClick Cancel"** aparece sem erros.
6. Clique no ícone de peça de quebra-cabeça na barra do Chrome, fixe o ícone da extensão, clique nele, faça login manualmente na Netflix ou Spotify (o MVP não coleta nem simula credenciais), selecione o serviço no popup e clique em **"Cancelar assinatura"**.
7. Acompanhe o log em tempo real dentro do próprio popup.

> **Por que o carregamento não é 100% automático via linha de comando?** Testamos a flag `--load-extension`, mas em perfis novos do Chrome o "Modo do desenvolvedor" vem desligado por padrão, e o Chrome ignora essa flag silenciosamente nesse caso — é uma proteção de segurança do próprio navegador, sem workaround confiável via `.bat`. O passo manual acima (uma vez só, ou toda vez que quiser testar de novo) é o caminho garantido em qualquer máquina.

## 3. Seletores do DOM — atenção antes de usar em produção

Os seletores em `netflix.js` e `spotify.js` são **ilustrativos**. Netflix e Spotify alteram classes, atributos `data-*` e textos com frequência (testes A/B, redesigns). Antes de qualquer demonstração ao vivo ou venda, é necessário:

1. Abrir o DevTools nas páginas reais de cancelamento de cada serviço.
2. Atualizar os arrays `strategies` em cada playbook com os seletores atuais.
3. Testar o fluxo de ponta a ponta com uma conta de teste.

A arquitetura de `findWithFallback` (várias estratégias de seleção, com fallback por texto visível) foi pensada justamente para reduzir a manutenção quando pequenas mudanças de classe acontecem — mas não substitui a validação inicial.

## 4. Segurança e privacidade (importante para due diligence de venda)

- **Nenhuma credencial é armazenada, capturada ou transmitida pela extensão.** O usuário faz login manualmente, como sempre faz; a extensão só interage com o DOM da página já autenticada, do mesmo jeito que o próprio usuário clicaria nos botões.
- **Sem backend.** Este MVP não envia nenhum dado para servidores externos — toda a automação roda localmente, dentro do navegador do usuário. Isso elimina a superfície de ataque de vazamento de dados em trânsito.
- **`host_permissions` restritos**: a extensão só tem permissão de rodar nos domínios `netflix.com` e `spotify.com`/`account.spotify.com` — não em qualquer site.
- **`chrome.storage.local`** guarda apenas o log/status do último job (texto de progresso), nunca dados de conta.
- A aba de automação abre com `active: false` (segundo plano, sem foco) — não é uma aba "oculta"/headless de verdade, pois o Manifest V3 não permite isso por política do Chrome Web Store; isso é intencional e deve ser mantido para aprovação na loja.
- Antes da venda, recomenda-se: (a) uma auditoria de código por terceiros, (b) política de privacidade explícita informando que a extensão não coleta dados, e (c) remoção da permissão `tabs` caso o comprador decida restringir ainda mais o escopo (pode ser substituída por `activeTab` se o fluxo for redesenhado para rodar na aba atual em vez de abrir uma nova).

## 5. Próximos passos sugeridos para evoluir o MVP

- Validar e travar os seletores reais de Netflix/Spotify (item 3 acima) — é o maior risco de quebra.
- Adicionar testes automatizados (Playwright) rodando os playbooks contra páginas de staging/mock, para não depender de contas reais em CI.
- Persistir histórico de cancelamentos (`chrome.storage.local`) para o usuário ver o histórico completo, não só o último job.
- Publicar na Chrome Web Store (requer revisão de permissões e política de privacidade pública).
