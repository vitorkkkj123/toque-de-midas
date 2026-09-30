/**
 * ============================================================================
 * MIDAS BANK - PORTAL DE APROVAÇÃO BIOMÉTRICA (C-LEVEL)
 * Integração WebAuthn / FIDO2 com @simplewebauthn/browser
 * ============================================================================
 */

// Estado da aplicação
let appState = {
  director: null,
  transfers: [],
  auditLogs: [],
};

// Elementos DOM principais
const transfersListContainer = document.getElementById('transfersListContainer');
const directorNameNav = document.getElementById('directorNameNav');
const biometricsStatusBadge = document.getElementById('biometricsStatusBadge');
const unregisteredWarningBanner = document.getElementById('unregisteredWarningBanner');
const totalPendingAmount = document.getElementById('totalPendingAmount');
const credentialStatusContainer = document.getElementById('credentialStatusContainer');
const auditLogList = document.getElementById('auditLogList');
const registrationForm = document.getElementById('registrationForm');
const btnStartRegistration = document.getElementById('btnStartRegistration');
const btnResetSimulation = document.getElementById('btnResetSimulation');
const btnSimulateLeak = document.getElementById('btnSimulateLeak');
const leakConsoleOutput = document.getElementById('leakConsoleOutput');
const leakCodePre = document.getElementById('leakCodePre');

// Modal do Recibo
let receiptModal = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
  setupEventListeners();
  await loadStatus();
  checkWebAuthnSupport();
});

// Verifica suporte do navegador
function checkWebAuthnSupport() {
  if (
    typeof window.PublicKeyCredential === 'undefined' ||
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
  ) {
    showGlobalAlert(
      'Aviso de Compatibilidade',
      'Este navegador não possui suporte completo à WebAuthn API. Use o Google Chrome, Edge ou Safari atualizados em ambiente seguro (localhost ou HTTPS).',
      'warning'
    );
    return;
  }

  window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then((available) => {
    if (!available) {
      console.warn('Autenticador de plataforma (Windows Hello / Touch ID) não detectado neste dispositivo.');
    }
  });
}

// Configuração de Listeners
function setupEventListeners() {
  // Envio do formulário de registro biométrico
  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRegistration();
  });

  // Reset da simulação
  btnResetSimulation.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      showGlobalAlert('Simulação Resetada', data.message, 'info');
      await loadStatus();
    } catch (err) {
      showGlobalAlert('Erro', err.message, 'danger');
    }
  });

  // Simulador de vazamento de banco de dados
  btnSimulateLeak.addEventListener('click', () => {
    handleSimulateDatabaseLeak();
  });
}

// ============================================================================
// CARREGAMENTO DO STATUS DO SISTEMA
// ============================================================================
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Falha ao comunicar com o servidor.');
    const data = await res.json();
    appState = data;

    renderNavbar();
    renderTransfers();
    renderCredentialStatus();
    renderAuditLogs();
  } catch (err) {
    console.error('Erro ao carregar status:', err);
    showGlobalAlert('Erro de Conexão', 'Não foi possível carregar os dados da tesouraria.', 'danger');
  }
}

// Renderiza barra superior
function renderNavbar() {
  const { director } = appState;
  if (!director) return;

  directorNameNav.innerText = director.displayName;
  if (director.hasPasskey) {
    biometricsStatusBadge.className = 'badge badge-emerald';
    biometricsStatusBadge.innerHTML = '<i class="bi bi-shield-check"></i> Biometria Ativa';
    unregisteredWarningBanner.classList.add('d-none');
  } else {
    biometricsStatusBadge.className = 'badge badge-rose';
    biometricsStatusBadge.innerHTML = '<i class="bi bi-shield-x"></i> Sem Biometria';
    unregisteredWarningBanner.classList.remove('d-none');
  }
}

// Renderiza lista de transferências
function renderTransfers() {
  const { transfers, director } = appState;
  transfersListContainer.innerHTML = '';

  let pendingSum = 0;

  transfers.forEach((trx) => {
    if (trx.status === 'PENDENTE') {
      pendingSum += trx.amount;
    }

    const isPending = trx.status === 'PENDENTE';
    const hasBiometrics = director && director.hasPasskey;

    const formattedAmount = trx.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const cardCol = document.createElement('div');
    cardCol.className = 'col-lg-4 col-md-6';
    cardCol.innerHTML = `
      <div class="card card-midas h-100 ${isPending ? 'card-midas-featured' : 'border-success'}">
        <div class="card-body p-4 d-flex flex-column justify-content-between">
          <div>
            <!-- Header do Card -->
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge ${isPending ? 'badge-gold' : 'badge-emerald'} text-uppercase">
                ${trx.id} &bull; ${trx.status}
              </span>
              <span class="badge ${trx.urgency === 'Crítica' ? 'bg-danger' : trx.urgency === 'Alta' ? 'bg-warning text-dark' : 'bg-secondary'}">
                Urgência ${trx.urgency}
              </span>
            </div>

            <!-- Valor Monetário -->
            <div class="mb-3">
              <div class="text-secondary small text-uppercase">Valor da Operação</div>
              <div class="fs-3 fw-bold text-light">${formattedAmount}</div>
            </div>

            <!-- Dados do Beneficiário -->
            <div class="p-3 rounded-3 bg-dark border border-secondary mb-3 small">
              <div class="text-light fw-bold mb-1">${trx.beneficiary}</div>
              <div class="text-secondary mb-1">CNPJ: ${trx.cnpj}</div>
              <div class="text-secondary mb-1">Destino: ${trx.bank} (${trx.account})</div>
              <div class="text-warning text-break mt-2" style="font-size: 0.8rem;">
                <i class="bi bi-tag-fill me-1"></i> ${trx.purpose}
              </div>
            </div>
          </div>

          <!-- Ação ou Comprovante -->
          <div class="mt-3">
            ${
              isPending
                ? `
                <button 
                  class="btn btn-midas-gold w-100 py-3 fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2"
                  onclick="handleApproveTransfer('${trx.id}')"
                  ${!hasBiometrics ? 'title="Cadastre a biometria primeiro"' : ''}
                >
                  <i class="bi bi-fingerprint fs-4"></i>
                  <span>${hasBiometrics ? 'Aprovar com Toque de Midas' : 'Vincular Biometria para Aprovar'}</span>
                </button>
              `
                : `
                <div class="p-2 rounded bg-success-subtle border border-success text-center mb-2">
                  <div class="text-success fw-bold small">
                    <i class="bi bi-check-circle-fill me-1"></i> Aprovada via Biometria Física
                  </div>
                  <div class="text-secondary" style="font-size: 0.72rem;">
                    Por: ${trx.approvedBy || 'Diretor'} às ${trx.approvedAt || '--'}
                  </div>
                </div>
                <button 
                  class="btn btn-outline-info btn-sm w-100"
                  onclick="showReceiptModal('${trx.id}')"
                >
                  <i class="bi bi-receipt me-1"></i> Ver Comprovante Criptográfico
                </button>
              `
            }
          </div>
        </div>
      </div>
    `;

    transfersListContainer.appendChild(cardCol);
  });

  totalPendingAmount.innerText = pendingSum.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Renderiza painel de credencial biométrica ativa
function renderCredentialStatus() {
  const { director } = appState;
  if (!director) return;

  if (!director.hasPasskey) {
    credentialStatusContainer.innerHTML = `
      <div class="p-3 rounded-3 bg-dark border border-secondary text-center">
        <i class="bi bi-shield-x fs-1 text-danger mb-2"></i>
        <h5 class="h6 fw-bold text-light">Nenhuma biometria vinculada</h5>
        <p class="text-secondary small mb-0">
          Utilize o formulário ao lado para registrar o sensor biométrico deste computador ou celular.
        </p>
      </div>
    `;
    return;
  }

  const cred = director.credentials[0];
  credentialStatusContainer.innerHTML = `
    <div class="p-3 rounded-3 bg-dark border border-success mb-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <span class="badge badge-emerald">Dispositivo Ativo</span>
        <span class="text-secondary small">${cred.createdAt}</span>
      </div>
      <div class="small text-light mb-1">
        <strong>Tipo:</strong> Sensor de Plataforma (Windows Hello / Touch ID)
      </div>
      <div class="small text-light mb-1">
        <strong>Assinaturas Efetuadas:</strong> ${cred.counter} transações
      </div>
      <div class="small text-secondary text-break mb-3">
        <strong>Chave Pública no Servidor:</strong>
        <code class="text-info">${cred.publicKeyPreview}</code>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline-danger btn-sm w-100" onclick="handleUnlinkBiometrics()">
          <i class="bi bi-trash3 me-1"></i> Desvincular Este Dispositivo
        </button>
      </div>
    </div>
  `;
}

// Renderiza trilha de auditoria
function renderAuditLogs() {
  const { auditLogs } = appState;
  auditLogList.innerHTML = '';

  if (!auditLogs || auditLogs.length === 0) {
    auditLogList.innerHTML = '<div class="text-muted small">Nenhum evento registrado.</div>';
    return;
  }

  auditLogs.forEach((log) => {
    const logItem = document.createElement('div');
    const badgeClass =
      log.level === 'SUCCESS' ? 'badge-emerald' : log.level === 'ERROR' ? 'badge-rose' : 'badge-gold';

    logItem.className = 'p-2 rounded bg-dark border border-secondary small';
    logItem.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="badge ${badgeClass}">${log.event}</span>
        <span class="text-secondary" style="font-size: 0.72rem;">${log.timestamp}</span>
      </div>
      <div class="text-light" style="font-size: 0.8rem;">${log.details}</div>
    `;
    auditLogList.appendChild(logItem);
  });
}

// ============================================================================
// 1. REGISTRO WEBAUTHN (VINCULAÇÃO BIOMÉTRICA)
// ============================================================================
async function handleRegistration() {
  const displayName = document.getElementById('regDisplayName').value.trim();
  const username = document.getElementById('regUsername').value.trim();

  if (!displayName || !username) {
    showGlobalAlert('Atenção', 'Preencha o nome e e-mail do diretor.', 'warning');
    return;
  }

  btnStartRegistration.disabled = true;
  btnStartRegistration.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2"></span>
    Aguardando Sensor Biométrico (Toque seu leitor / olhe para a câmera)...
  `;

  try {
    // 1. Solicita opções de registro com desafio (challenge) do backend
    const respOptions = await fetch('/api/register/generate-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, username }),
    });

    if (!respOptions.ok) {
      const errData = await respOptions.json();
      throw new Error(errData.error || 'Erro ao gerar opções de registro.');
    }

    const optionsJSON = await respOptions.json();

    // 2. Chama a API do navegador para abrir o prompt nativo (Windows Hello / Touch ID)
    let attResp;
    try {
      attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('A leitura biométrica foi cancelada pelo usuário ou expirou o tempo limite.');
      }
      throw err;
    }

    // 3. Envia a resposta criptográfica para verificação no backend
    const respVerification = await fetch('/api/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
    });

    const verificationJSON = await respVerification.json();

    if (verificationJSON && verificationJSON.verified) {
      showGlobalAlert(
        'Biometria Vinculada com Sucesso!',
        'Seu dispositivo seguro agora é a chave mestre para aprovação de transferências milionárias.',
        'success'
      );
      await loadStatus();

      // Muda para a aba de transferências após 1.2 segundos
      setTimeout(() => {
        document.getElementById('tab-transfers-btn').click();
      }, 1200);
    } else {
      throw new Error(verificationJSON.error || 'Falha ao verificar credencial biométrica.');
    }
  } catch (err) {
    console.error('Erro no registro WebAuthn:', err);
    showGlobalAlert('Falha no Registro Biométrico', err.message, 'danger');
  } finally {
    btnStartRegistration.disabled = false;
    btnStartRegistration.innerHTML = `
      <i class="bi bi-shield-lock-fill me-2"></i> Vincular com Impressão Digital (FIDO2)
    `;
  }
}

// ============================================================================
// 2. AUTORIZAÇÃO WEBAUTHN (APROVAÇÃO DE TRANSFERÊNCIA DE ALTO VALOR)
// ============================================================================
async function handleApproveTransfer(transferId) {
  const { director } = appState;

  if (!director || !director.hasPasskey) {
    showGlobalAlert(
      'Biometria Necessária',
      'Você precisa vincular seu dispositivo biométrico antes de aprovar transferências.',
      'warning'
    );
    document.getElementById('tab-register-btn').click();
    return;
  }

  const transfer = appState.transfers.find((t) => t.id === transferId);
  if (!transfer) return;

  showGlobalAlert(
    'Aguardando Toque de Midas...',
    `Coloque sua impressão digital no sensor biométrico para autorizar R$ ${transfer.amount.toLocaleString('pt-BR')}.`,
    'info'
  );

  try {
    // 1. Solicita opções de autenticação (challenge vinculado à transferência)
    const respOptions = await fetch(`/api/transfers/${transferId}/generate-options`, {
      method: 'POST',
    });

    if (!respOptions.ok) {
      const errData = await respOptions.json();
      throw new Error(errData.error || 'Erro ao gerar desafio de autorização.');
    }

    const optionsJSON = await respOptions.json();

    // 2. Dispara o prompt nativo do SO para leitura biométrica
    let asseResp;
    try {
      asseResp = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('A autorização biométrica foi cancelada pelo Diretor.');
      }
      throw err;
    }

    // 3. Envia a assinatura digital para o servidor verificar com a chave pública
    const respVerification = await fetch(`/api/transfers/${transferId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asseResp),
    });

    const verificationJSON = await respVerification.json();

    if (verificationJSON && verificationJSON.verified) {
      await loadStatus();
      showReceiptModal(transferId);
    } else {
      throw new Error(verificationJSON.error || 'Assinatura biométrica rejeitada.');
    }
  } catch (err) {
    console.error('Erro na aprovação WebAuthn:', err);
    showGlobalAlert('Aprovação Cancelada ou Falhou', err.message, 'danger');
  }
}

// Exibe recibo criptográfico no modal
function showReceiptModal(transferId) {
  const transfer = appState.transfers.find((t) => t.id === transferId);
  if (!transfer) return;

  document.getElementById('receiptAmount').innerText = transfer.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  document.getElementById('receiptBeneficiary').innerText = `${transfer.beneficiary} &bull; ${transfer.purpose}`;
  document.getElementById('receiptTrxId').innerText = transfer.id;
  document.getElementById('receiptDirector').innerText = transfer.approvedBy || appState.director.displayName;
  document.getElementById('receiptTimestamp').innerText = transfer.approvedAt || new Date().toLocaleString('pt-BR');
  document.getElementById('receiptCryptoProof').innerText = transfer.cryptoProof || '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');

  receiptModal.show();
}

// Desvincula credencial para permitir novo teste
async function handleUnlinkBiometrics() {
  if (!confirm('Deseja realmente desvincular a biometria deste dispositivo?')) return;

  try {
    const res = await fetch('/api/director/clear-biometrics', { method: 'POST' });
    const data = await res.json();
    showGlobalAlert('Dispositivo Removido', data.message, 'warning');
    await loadStatus();
  } catch (err) {
    showGlobalAlert('Erro', err.message, 'danger');
  }
}

// Simulador interativo do vazamento de banco de dados
function handleSimulateDatabaseLeak() {
  const { director } = appState;
  leakConsoleOutput.classList.remove('d-none');

  const leakedData = {
    _dump_time: new Date().toISOString(),
    _attack_type: 'SQL Injection / Full DB Exfiltration',
    compromised_table: 'TB_MIDAS_USERS_AND_PASSKEYS',
    records_extracted: [
      {
        user_id: director.id,
        director_name: director.displayName,
        email: director.username,
        // DADO PÚBLICO
        public_key_spki: director.credentials[0]
          ? director.credentials[0].publicKeyPreview + ' [ASSIMÉTRICA PÚBLICA]'
          : 'Nenhuma credencial cadastrada',
        credential_id: director.credentials[0] ? director.credentials[0].id : null,
        counter: director.credentials[0] ? director.credentials[0].counter : 0,
        // DADOS NUNCA EXISTENTES NO BANCO
        user_fingerprint_raw: '[ERRO 404: INEXISTENTE! Biometria nunca sai do leitor físico]',
        private_key: '[ERRO 403: INACESSÍVEL! Selada fisicamente dentro do chip TPM/Secure Enclave]',
        can_attacker_forge_signatures: false,
      },
    ],
  };

  leakCodePre.innerText = JSON.stringify(leakedData, null, 2);
}

// Exibe alertas flutuantes no topo
function showGlobalAlert(title, message, type = 'info') {
  const container = document.getElementById('globalAlertContainer');
  const alertDiv = document.createElement('div');
  const alertIcon =
    type === 'success'
      ? 'bi-check-circle-fill'
      : type === 'danger'
      ? 'bi-shield-x'
      : type === 'warning'
      ? 'bi-exclamation-triangle-fill'
      : 'bi-info-circle-fill';

  alertDiv.className = `alert alert-${type} alert-dismissible fade show border-${type} shadow`;
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <i class="bi ${alertIcon} fs-4"></i>
      <div>
        <strong>${title}:</strong> ${message}
      </div>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  container.innerHTML = '';
  container.appendChild(alertDiv);

  // Auto remove após 8 segundos
  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 250);
  }, 8000);
}
