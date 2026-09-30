const express = require('express');
const path = require('path');
const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de RP (Relying Party)
// Em produção, rpID e expectedOrigin são baseados no domínio da aplicação
const RP_NAME = 'Midas Bank - High Value Treasury';

// Função para obter rpID e expectedOrigin dinâmicos da requisição (compatível com localhost ou nuvem)
function getRPDetails(req) {
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const hostname = hostHeader.split(':')[0]; // sem a porta para o rpID
  const origin = `${proto}://${hostHeader}`;
  return { rpID: hostname, origin };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Servir o bundle do SimpleWebAuthn Browser localmente para garantir funcionamento offline
app.get('/vendor/simplewebauthn-browser.js', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'node_modules', '@simplewebauthn', 'browser', 'dist', 'bundle', 'index.umd.min.js')
  );
});

// ==========================================
// BANCO DE DADOS EM MEMÓRIA (DEMONSTRAÇÃO)
// ==========================================
let currentDirector = {
  id: 'usr_midas_cfo_001',
  username: 'roberto.vianna@midasbank.com',
  displayName: 'Roberto Vianna (CFO / Diretor Tesouraria)',
  credentials: [],
  currentChallenge: null,
};

let transfers = [
  {
    id: 'TRX-9481',
    beneficiary: 'AeroTech Logística Internacional S/A',
    cnpj: '18.942.103/0001-55',
    bank: '341 - Itaú Unibanco',
    account: 'Ag. 0932 / CC 44820-1',
    amount: 2450000.00,
    purpose: 'Aquisição de Aeronave Corporativa (Contrato #884/2026)',
    urgency: 'Alta',
    createdAt: '2026-09-30 14:20:00',
    status: 'PENDENTE',
    approvedBy: null,
    approvedAt: null,
    credentialIdUsed: null,
    cryptoProof: null,
  },
  {
    id: 'TRX-9482',
    beneficiary: 'Vortex Cloud Infrastructure Inc.',
    cnpj: '45.120.984/0001-90',
    bank: '033 - Santander',
    account: 'Ag. 1500 / CC 99312-8',
    amount: 1800000.00,
    purpose: 'Expansão de Data Center Tier 4 (Capacidade IA)',
    urgency: 'Média',
    createdAt: '2026-09-30 15:45:00',
    status: 'PENDENTE',
    approvedBy: null,
    approvedAt: null,
    credentialIdUsed: null,
    cryptoProof: null,
  },
  {
    id: 'TRX-9483',
    beneficiary: 'Quantum Partners Gestão de Recursos',
    cnpj: '09.331.782/0001-12',
    bank: '237 - Bradesco Prime',
    account: 'Ag. 3400 / CC 12093-4',
    amount: 5200000.00,
    purpose: 'Aporte de Participação Societária (Operação M&A)',
    urgency: 'Crítica',
    createdAt: '2026-09-30 16:10:00',
    status: 'PENDENTE',
    approvedBy: null,
    approvedAt: null,
    credentialIdUsed: null,
    cryptoProof: null,
  },
];

// Log de auditoria em memória
let auditLogs = [
  {
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    event: 'SISTEMA INICIALIZADO',
    details: 'Módulo WebAuthn FIDO2 carregado com suporte a biometria nativa.',
    level: 'INFO',
  }
];

function addAuditLog(event, details, level = 'INFO') {
  auditLogs.unshift({
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    event,
    details,
    level,
  });
  if (auditLogs.length > 50) auditLogs.pop();
}

// ==========================================
// ROTAS DE STATUS E CONSULTA
// ==========================================

app.get('/api/status', (req, res) => {
  res.json({
    director: {
      id: currentDirector.id,
      username: currentDirector.username,
      displayName: currentDirector.displayName,
      hasPasskey: currentDirector.credentials.length > 0,
      credentialCount: currentDirector.credentials.length,
      credentials: currentDirector.credentials.map((c) => ({
        id: c.id,
        deviceType: c.deviceType || 'Plataforma (Biometria)',
        createdAt: c.createdAt,
        counter: c.counter,
        publicKeyPreview: Buffer.from(c.publicKey).toString('hex').slice(0, 32) + '...',
      })),
    },
    transfers,
    auditLogs: auditLogs.slice(0, 10),
  });
});

// ==========================================
// 1. REGISTRO WEBAUTHN (VINCULAÇÃO BIOMÉTRICA)
// ==========================================

// Gera as opções de registro com desafio criptográfico
app.post('/api/register/generate-options', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (username) currentDirector.username = username;
    if (displayName) currentDirector.displayName = displayName;

    const { rpID } = getRPDetails(req);

    // Converte ID do usuário em Uint8Array estável
    const userIdBuffer = Buffer.from(currentDirector.id, 'utf-8');

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new Uint8Array(userIdBuffer),
      userName: currentDirector.username,
      userDisplayName: currentDirector.displayName,
      attestationType: 'none',
      excludeCredentials: currentDirector.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports,
      })),
      authenticatorSelection: {
        // 'platform' força o uso de autenticadores integrados (Windows Hello, Touch ID, leitor biométrico)
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required', // Exige biometria/PIN
      },
    });

    // Guarda o desafio temporário para validação posterior
    currentDirector.currentChallenge = options.challenge;

    addAuditLog(
      'CHALLENGE DE REGISTRO GERADO',
      `Desafio gerado para ${currentDirector.username}. Solicitando validação de hardware local.`
    );

    res.json(options);
  } catch (error) {
    console.error('Erro em generate-registration-options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verifica a resposta de registro enviada pelo navegador após a leitura biométrica
app.post('/api/register/verify', async (req, res) => {
  try {
    const body = req.body;
    const { rpID, origin } = getRPDetails(req);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: currentDirector.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType } = registrationInfo;

      // Armazena a credencial (Chave Pública + ID). A chave privada NUNCA sai do hardware.
      const newCred = {
        id: credential.id,
        publicKey: credential.publicKey, // Uint8Array
        counter: credential.counter,
        transports: credential.transports || ['internal'],
        deviceType: credentialDeviceType || 'platform',
        createdAt: new Date().toLocaleString('pt-BR'),
      };

      // Substitui ou adiciona credencial
      currentDirector.credentials = [newCred];
      currentDirector.currentChallenge = null;

      addAuditLog(
        'BIOMETRIA VINCULADA COM SUCESSO',
        `Dispositivo registrado para ${currentDirector.displayName}. Chave pública registrada no cofre do banco.`,
        'SUCCESS'
      );

      res.json({
        verified: true,
        message: 'Dispositivo biométrico vinculado com sucesso à conta da diretoria!',
        credentialId: credential.id,
      });
    } else {
      res.status(400).json({ verified: false, error: 'Falha na validação criptográfica do registro.' });
    }
  } catch (error) {
    console.error('Erro em verify-registration:', error);
    addAuditLog('FALHA NO REGISTRO BIOMÉTRICO', error.message, 'ERROR');
    res.status(400).json({ verified: false, error: error.message });
  }
});

// ==========================================
// 2. AUTORIZAÇÃO WEBAUTHN (APROVAÇÃO DE TRANSFERÊNCIA)
// ==========================================

// Gera desafio de autenticação vinculado a uma transferência específica
app.post('/api/transfers/:id/generate-options', async (req, res) => {
  try {
    const transferId = req.params.id;
    const transfer = transfers.find((t) => t.id === transferId);

    if (!transfer) {
      return res.status(404).json({ error: 'Transferência não encontrada.' });
    }

    if (transfer.status === 'APROVADA') {
      return res.status(400).json({ error: 'Esta transferência já foi aprovada e liquidada.' });
    }

    if (currentDirector.credentials.length === 0) {
      return res.status(400).json({
        error: 'Nenhum dispositivo biométrico cadastrado. Faça a vinculação do Windows Hello / Touch ID primeiro.',
      });
    }

    const { rpID } = getRPDetails(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: currentDirector.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports,
      })),
      userVerification: 'required', // Força validação biométrica nativa
    });

    currentDirector.currentChallenge = options.challenge;
    currentDirector.pendingTransferId = transferId;

    addAuditLog(
      'ORDEM DE APROVAÇÃO INICIADA',
      `Solicitada biometria para autorizar R$ ${transfer.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${transfer.id})`
    );

    res.json(options);
  } catch (error) {
    console.error('Erro em generate-authentication-options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Valida a assinatura digital gerada pelo hardware local após o toque biométrico
app.post('/api/transfers/:id/verify', async (req, res) => {
  try {
    const transferId = req.params.id;
    const transfer = transfers.find((t) => t.id === transferId);

    if (!transfer) {
      return res.status(404).json({ error: 'Transferência não encontrada.' });
    }

    const body = req.body;
    const { rpID, origin } = getRPDetails(req);

    // Encontra a credencial correspondente
    const userCredential = currentDirector.credentials.find((c) => c.id === body.id);

    if (!userCredential) {
      return res.status(400).json({ error: 'Credencial biométrica não reconhecida para este diretor.' });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: currentDirector.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: userCredential.id,
        publicKey: userCredential.publicKey,
        counter: userCredential.counter,
        transports: userCredential.transports,
      },
      requireUserVerification: true,
    });

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Atualiza o contador de uso para mitigar ataques de replay
      userCredential.counter = authenticationInfo.newCounter;
      currentDirector.currentChallenge = null;
      currentDirector.pendingTransferId = null;

      // Atualiza a transferência para APROVADA
      const cryptoProof = crypto
        .createHash('sha256')
        .update(`${transfer.id}-${transfer.amount}-${userCredential.id}-${Date.now()}`)
        .digest('hex');

      transfer.status = 'APROVADA';
      transfer.approvedBy = currentDirector.displayName;
      transfer.approvedAt = new Date().toLocaleString('pt-BR');
      transfer.credentialIdUsed = userCredential.id;
      transfer.cryptoProof = cryptoProof;

      addAuditLog(
        'TRANSFERÊNCIA LIQUIDADA COM TOQUE DE MIDAS',
        `Aprovados R$ ${transfer.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por ${currentDirector.displayName} via Biometria Nativa. Prova: ${cryptoProof.slice(0, 16)}...`,
        'SUCCESS'
      );

      res.json({
        verified: true,
        message: 'Transferência aprovada com sucesso via biometria física!',
        transfer,
      });
    } else {
      res.status(400).json({ verified: false, error: 'Assinatura biométrica inválida.' });
    }
  } catch (error) {
    console.error('Erro em verify-authentication:', error);
    addAuditLog('FALHA NA ASSINATURA BIOMÉTRICA', error.message, 'ERROR');
    res.status(400).json({ verified: false, error: error.message });
  }
});

// Rota auxiliar para resetar a simulação
app.post('/api/reset', (req, res) => {
  transfers.forEach((t) => {
    t.status = 'PENDENTE';
    t.approvedBy = null;
    t.approvedAt = null;
    t.credentialIdUsed = null;
    t.cryptoProof = null;
  });
  addAuditLog('RESET DE SIMULAÇÃO', 'Todas as transferências voltaram ao estado pendente.', 'WARNING');
  res.json({ success: true, message: 'Transferências resetadas para o estado pendente.' });
});

// Desvincular credencial
app.post('/api/director/clear-biometrics', (req, res) => {
  currentDirector.credentials = [];
  addAuditLog('BIOMETRIA DESVINCULADA', 'Credenciais biométricas do diretor foram removidas.', 'WARNING');
  res.json({ success: true, message: 'Biometria desvinculada com sucesso.' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏛️  MIDAS BANK - PORTAL DE APROVAÇÃO BIOMÉTRICA (C-LEVEL)`);
  console.log(`🔗  Servidor rodando em: http://localhost:${PORT}`);
  console.log(`🛡️  WebAuthn / FIDO2 pronto para Windows Hello / Touch ID`);
  console.log(`=======================================================`);
});
