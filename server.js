/**
 * ============================================================================
 * MIDAS BANK - CORE TREASURY ENGINE (C-LEVEL HIGH-VALUE TRANSFERS)
 * Padrão: Clean Architecture / 12-Factor Stateless Serverless Ready
 * Hardened: Protegido contra Race Conditions, Host Poisoning & Cold Starts
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

// ============================================================================
// CONFIGURAÇÕES DE AMBIENTE & CRIPTOGRAFIA DEFENSIVA
// ============================================================================
const PORT = process.env.PORT || 3000;
const RP_NAME = 'Midas Bank - High Value Treasury';
const CHALLENGE_TTL_MS = 120000; // 2 minutos de validade estrita

// Correção 2: Segredo estático em dev e estritamente obrigatório em produção
const HMAC_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('CRITICAL FATAL: Variável SESSION_SECRET obrigatória em ambiente produtivo!');
      })()
    : 'midas_dev_insecure_static_secret_key_change_me_12345');

// Correção 3: Allowlist de domínios confiáveis contra Host Header Poisoning
const ALLOWED_RP_HOSTS = new Set(
  ['localhost', '127.0.0.1', 'toque-de-midas.vercel.app', process.env.APP_DOMAIN].filter(Boolean)
);

// ============================================================================
// DOMAIN ERRORS & TRATAMENTO DEFENSIVO
// ============================================================================
class DomainError extends Error {
  constructor(message, statusCode = 400, errorCode = 'DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class EntityNotFoundError extends DomainError {
  constructor(entityName, id) {
    super(`${entityName} com identificador '${id}' não foi encontrado.`, 404, 'ENTITY_NOT_FOUND');
  }
}

class TransactionConflictError extends DomainError {
  constructor(message) {
    super(message, 409, 'TRANSACTION_CONFLICT');
  }
}

class WebAuthnSecurityError extends DomainError {
  constructor(message) {
    super(message, 401, 'WEBAUTHN_VERIFICATION_FAILED');
  }
}

// ============================================================================
// SERVIÇO CRIPTOGRÁFICO DE DESAFIOS STATELESS (HMAC-SHA256)
// ============================================================================
class StatelessChallengeTokenService {
  static createToken(payload) {
    const data = {
      ...payload,
      exp: Date.now() + CHALLENGE_TTL_MS,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    const serialized = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(serialized)
      .digest('base64url');

    return `${serialized}.${signature}`;
  }

  static verifyAndExtract(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      throw new WebAuthnSecurityError('Token de desafio ausente ou formato inválido.');
    }

    const [serialized, signature] = token.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(serialized)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new WebAuthnSecurityError('Assinatura do desafio corrompida ou adulterada por atacante.');
    }

    const payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf-8'));

    if (Date.now() > payload.exp) {
      throw new WebAuthnSecurityError('O tempo limite para autenticação biométrica expirou (TTL excedido).');
    }

    return payload;
  }
}

// ============================================================================
// REPOSITÓRIO EM MEMÓRIA COM BLOQUEIO DE ESTADO
// ============================================================================
const database = {
  director: {
    id: 'usr_midas_cfo_001',
    username: 'roberto.vianna@midasbank.com',
    displayName: 'Roberto Vianna (CFO / Diretor Tesouraria)',
    credentials: [],
  },
  transfers: [
    {
      id: 'TRX-9481',
      beneficiary: 'AeroTech Logística Internacional S/A',
      cnpj: '18.942.103/0001-55',
      bank: '341 - Itaú Unibanco',
      account: 'Ag. 0932 / CC 44820-1',
      amount: 2450000.0,
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
      amount: 1800000.0,
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
      amount: 5200000.0,
      purpose: 'Aporte de Participação Societária (Operação M&A)',
      urgency: 'Crítica',
      createdAt: '2026-09-30 16:10:00',
      status: 'PENDENTE',
      approvedBy: null,
      approvedAt: null,
      credentialIdUsed: null,
      cryptoProof: null,
    },
  ],
  auditLogs: [
    {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      event: 'ENGINE_INITIALIZED',
      details: 'Motor WebAuthn FIDO2 carregado em modo zero-trust e stateless.',
      level: 'INFO',
    },
  ],
};

function addStructuredAudit(event, details, level = 'INFO') {
  database.auditLogs.unshift({
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    event,
    details,
    level,
  });
  if (database.auditLogs.length > 100) database.auditLogs.pop();
}

// ============================================================================
// RESOLUÇÃO DE ORIGEM & RP ID COM ALLOWLIST E VALIDAÇÃO ESTREITA
// ============================================================================
function extractRelyingPartyContext(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = forwardedHost || req.headers.host || `localhost:${PORT}`;
  const hostname = hostHeader.split(':')[0].toLowerCase();

  // Correção 3: Validação contra allowlist em ambiente produtivo
  if (!ALLOWED_RP_HOSTS.has(hostname) && process.env.NODE_ENV === 'production') {
    throw new WebAuthnSecurityError(`RP ID inválido ou não autorizado: [${hostname}].`);
  }

  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const origin = `${proto}://${hostHeader}`;

  return { rpID: hostname, origin };
}

// ============================================================================
// APLICAÇÃO EXPRESS & MIDDLEWARES
// ============================================================================
const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Fallback estático do bundle WebAuthn Browser
app.get('/vendor/simplewebauthn-browser.js', (req, res) => {
  const bundlePath = path.join(
    __dirname,
    'node_modules',
    '@simplewebauthn',
    'browser',
    'dist',
    'bundle',
    'index.umd.min.js'
  );
  res.sendFile(bundlePath);
});

// Helper de Cookies assinado
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// ============================================================================
// ROTAS DE STATUS & AUDITORIA
// ============================================================================
app.get('/api/status', (req, res) => {
  const { director, transfers, auditLogs } = database;
  res.status(200).json({
    director: {
      id: director.id,
      username: director.username,
      displayName: director.displayName,
      hasPasskey: director.credentials.length > 0,
      credentialCount: director.credentials.length,
      credentials: director.credentials.map((cred) => ({
        id: cred.id,
        deviceType: cred.deviceType,
        createdAt: cred.createdAt,
        counter: cred.counter,
        publicKeyPreview: Buffer.from(cred.publicKey).toString('hex').slice(0, 32) + '...',
      })),
    },
    transfers,
    auditLogs: auditLogs.slice(0, 15),
  });
});

// ============================================================================
// 1. PIPELINE DE REGISTRO BIOMÉTRICO (WEBAUTHN REGISTRATION)
// ============================================================================
app.post('/api/register/generate-options', async (req, res, next) => {
  try {
    const { username, displayName } = req.body;

    // Correção 4: Sanitização estrita e proteção contra sobrescrita indevida do Diretor
    if (username && typeof username === 'string' && username.includes('@')) {
      if (username.endsWith('@midasbank.com')) {
        database.director.username = username.trim().toLowerCase();
      }
    }
    if (displayName && typeof displayName === 'string' && displayName.trim().length >= 3) {
      database.director.displayName = displayName.trim();
    }

    const { rpID } = extractRelyingPartyContext(req);
    const userIdBuffer = Buffer.from(database.director.id, 'utf-8');

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new Uint8Array(userIdBuffer),
      userName: database.director.username,
      userDisplayName: database.director.displayName,
      attestationType: 'none',
      excludeCredentials: database.director.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Restringe a hardware seguro nativo
        residentKey: 'preferred',
        userVerification: 'required', // Impede bypass sem biometria/PIN
      },
    });

    // Criação do token stateless assinado via Cookie HttpOnly
    const sessionToken = StatelessChallengeTokenService.createToken({
      purpose: 'REGISTRATION',
      challenge: options.challenge,
      userId: database.director.id,
    });

    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    res.setHeader(
      'Set-Cookie',
      `midas_challenge=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=120${isSecure ? '; Secure' : ''}`
    );

    addStructuredAudit(
      'REGISTRATION_CHALLENGE_ISSUED',
      `Desafio criptográfico gerado para [${database.director.username}] no RP [${rpID}].`,
      'INFO'
    );

    res.status(200).json(options);
  } catch (error) {
    next(error);
  }
});

app.post('/api/register/verify', async (req, res, next) => {
  try {
    const responsePayload = req.body;
    const cookies = parseCookies(req);
    const sessionToken = cookies['midas_challenge'];

    const sessionData = StatelessChallengeTokenService.verifyAndExtract(sessionToken);

    if (sessionData.purpose !== 'REGISTRATION') {
      throw new WebAuthnSecurityError('Finalidade do token de desafio incompatível com registro.');
    }

    const { rpID, origin } = extractRelyingPartyContext(req);

    const verification = await verifyRegistrationResponse({
      response: responsePayload,
      expectedChallenge: sessionData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new WebAuthnSecurityError('Validação criptográfica da credencial de plataforma falhou.');
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    const newCredentialRecord = {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports || ['internal'],
      deviceType: credentialDeviceType || 'platform',
      createdAt: new Date().toLocaleString('pt-BR'),
    };

    database.director.credentials = [newCredentialRecord];

    // Limpa o cookie de desafio pós-consumo (Anti-Replay)
    res.setHeader('Set-Cookie', 'midas_challenge=; Path=/; HttpOnly; Max-Age=0');

    addStructuredAudit(
      'DEVICE_PROVISIONED_SUCCESS',
      `Credencial biométrica FIDO2 atrelada ao diretor [${database.director.displayName}].`,
      'SUCCESS'
    );

    res.status(200).json({
      verified: true,
      message: 'Dispositivo biométrico registrado com integridade criptográfica verificada.',
      credentialId: credential.id,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. PIPELINE DE AUTORIZAÇÃO BIOMÉTRICA (TRANSFERÊNCIA > R$ 1 MILHÃO)
// ============================================================================
app.post('/api/transfers/:id/generate-options', async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = database.transfers.find((t) => t.id === id);

    if (!transfer) {
      throw new EntityNotFoundError('Transferência Bancária', id);
    }

    if (transfer.status === 'APROVADA') {
      throw new TransactionConflictError(`A transferência [${id}] já foi liquidada e não permite nova assinatura.`);
    }

    if (transfer.status === 'PROCESSANDO') {
      throw new TransactionConflictError(`A transferência [${id}] já está em processamento de liquidação concorrente.`);
    }

    if (database.director.credentials.length === 0) {
      throw new DomainError(
        'Nenhum dispositivo biométrico registrado. Vincule seu sensor de plataforma previamente.',
        400,
        'NO_BIOMETRICS_PROVISIONED'
      );
    }

    const { rpID } = extractRelyingPartyContext(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: database.director.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports,
      })),
      userVerification: 'required',
    });

    const sessionToken = StatelessChallengeTokenService.createToken({
      purpose: 'AUTHORIZATION',
      challenge: options.challenge,
      transferId: id,
    });

    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
    res.setHeader(
      'Set-Cookie',
      `midas_challenge=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=120${isSecure ? '; Secure' : ''}`
    );

    addStructuredAudit(
      'TRANSFER_APPROVAL_INTENT',
      `Desafio emitido para autorização de R$ ${transfer.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na transferência [${id}].`,
      'INFO'
    );

    res.status(200).json(options);
  } catch (error) {
    next(error);
  }
});

app.post('/api/transfers/:id/verify', async (req, res, next) => {
  const { id } = req.params;
  const transfer = database.transfers.find((t) => t.id === id);

  try {
    if (!transfer) {
      throw new EntityNotFoundError('Transferência Bancária', id);
    }

    // Correção 1: Checagem de Idempotência e Lock de Concorrência
    if (transfer.status === 'APROVADA') {
      throw new TransactionConflictError(`A transferência [${id}] já se encontra liquidada.`);
    }

    if (transfer.status === 'PROCESSANDO') {
      throw new TransactionConflictError(`A transferência [${id}] já está em processamento de liquidação concorrente.`);
    }

    // Trava atômica imediata antes de qualquer operação assíncrona
    transfer.status = 'PROCESSANDO';

    const cookies = parseCookies(req);
    const sessionToken = cookies['midas_challenge'];
    const sessionData = StatelessChallengeTokenService.verifyAndExtract(sessionToken);

    if (sessionData.purpose !== 'AUTHORIZATION' || sessionData.transferId !== id) {
      throw new WebAuthnSecurityError('Violação de contexto: o desafio submetido não pertence a esta transferência.');
    }

    const responsePayload = req.body;
    const userCredential = database.director.credentials.find((c) => c.id === responsePayload.id);

    if (!userCredential) {
      throw new WebAuthnSecurityError('A credencial biométrica utilizada não pertence a este executivo.');
    }

    const { rpID, origin } = extractRelyingPartyContext(req);

    const verification = await verifyAuthenticationResponse({
      response: responsePayload,
      expectedChallenge: sessionData.challenge,
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

    if (!verification.verified || !verification.authenticationInfo) {
      throw new WebAuthnSecurityError('Assinatura biométrica ilegítima ou rejeitada pelo hardware de segurança.');
    }

    // Atualização de contador contra ataques de clonagem/replay
    userCredential.counter = verification.authenticationInfo.newCounter;

    // Mutação de estado atômica com geração de recibo criptográfico
    const proofHash = crypto
      .createHash('sha256')
      .update(`${transfer.id}|${transfer.amount}|${userCredential.id}|${Date.now()}`)
      .digest('hex');

    transfer.status = 'APROVADA';
    transfer.approvedBy = database.director.displayName;
    transfer.approvedAt = new Date().toLocaleString('pt-BR');
    transfer.credentialIdUsed = userCredential.id;
    transfer.cryptoProof = `0x${proofHash}`;

    // Descarte do desafio
    res.setHeader('Set-Cookie', 'midas_challenge=; Path=/; HttpOnly; Max-Age=0');

    addStructuredAudit(
      'TRANSFER_SETTLED_FIDO2',
      `Transação [${transfer.id}] de R$ ${transfer.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} liquidada com assinatura biométrica. Hash: ${transfer.cryptoProof.slice(0, 18)}...`,
      'SUCCESS'
    );

    res.status(200).json({
      verified: true,
      message: 'Ordem de transferência executada e liquidada com validação biométrica em hardware.',
      transfer,
    });
  } catch (error) {
    // Correção 1: Rollback garantido do lock caso a verificação falhe
    if (transfer && transfer.status === 'PROCESSANDO') {
      transfer.status = 'PENDENTE';
    }
    next(error);
  }
});

// ============================================================================
// UTILITÁRIOS DE DEMONSTRAÇÃO
// ============================================================================
app.post('/api/reset', (req, res) => {
  database.transfers.forEach((t) => {
    t.status = 'PENDENTE';
    t.approvedBy = null;
    t.approvedAt = null;
    t.credentialIdUsed = null;
    t.cryptoProof = null;
  });
  addStructuredAudit('SIMULATION_RESET', 'Transferências resetadas para validação de testes.', 'WARNING');
  res.status(200).json({ success: true, message: 'Transferências retornadas ao status pendente.' });
});

app.post('/api/director/clear-biometrics', (req, res) => {
  database.director.credentials = [];
  addStructuredAudit('CREDENTIAL_PURGE', 'Credenciais biométricas do diretor foram revogadas.', 'WARNING');
  res.status(200).json({ success: true, message: 'Dispositivo biométrico desvinculado com sucesso.' });
});

// ============================================================================
// GLOBAL ERROR HANDLING MIDDLEWARE (DEFENSIVE & OBSERVABLE)
// Preserva status HTTP de erros da borda (ex: 413 Payload Too Large)
// ============================================================================
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (err instanceof DomainError ? err.statusCode : 500);
  const errorCode =
    err.type === 'entity.too.large'
      ? 'PAYLOAD_TOO_LARGE'
      : err instanceof DomainError
      ? err.errorCode
      : 'INTERNAL_SERVER_ERROR';

  console.error(`[CRITICAL_ERROR] [${errorCode}] ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  addStructuredAudit(`EXCEPTION_${errorCode}`, err.message, 'ERROR');

  res.status(statusCode).json({
    error: err.message || 'Ocorreu um erro interno de processamento.',
    code: errorCode,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// INICIALIZAÇÃO CONDICIONAL (COMPATIBILIDADE VERCEL SERVERLESS / LOCAL STANDALONE)
// ============================================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🏛️  MIDAS BANK - PORTAL DE APROVAÇÃO BIOMÉTRICA (C-LEVEL)`);
    console.log(`🔗  Servidor rodando em: http://localhost:${PORT}`);
    console.log(`🛡️  WebAuthn / FIDO2 pronto para Windows Hello / Touch ID`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
