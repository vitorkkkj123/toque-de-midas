# 📋 MEMORANDO DE CORREÇÕES TÉCNICAS (QA ARCHITECT ➔ DEV SÊNIOR)

**Para:** Vitor (Dev Sênior)  
**De:** Lead QA & Test Automation Architect (Chaos & Resilience)  
**Data:** 01/10/2026  
**Assunto:** Vulnerabilidades Críticas de Resiliência, Concorrência e Segurança no Core da Tesouraria (`server.js`)  
**Severidade Geral:** 🔴 ALTA / CRÍTICA

---

## 🎯 OBJETIVO
A auditoria de confiabilidade e caos identificou **4 vulnerabilidades estruturais** no processamento de transferências de alto valor (> R$ 1 Milhão) e na arquitetura WebAuthn stateless. Este documento detalha a causa raiz de cada falha e o código de correção pronto para aplicação.

---

## 1. 🔴 [CRÍTICA] Race Condition na Liquidação de Transferências (Double-Settlement)

### Localização
`server.js` (linhas ~444 a 495) no endpoint `POST /api/transfers/:id/verify`.

### Onde quebra (Cenário de Ataque / Falha)
A verificação de status (`if (transfer.status === 'APROVADA')`) é síncrona, mas a validação da assinatura biométrica (`await verifyAuthenticationResponse(...)`) é assíncrona.
Se o executivo clicar duas vezes rapidamente ou se um replay automatizado enviar 2 requisições no mesmo milissegundo:
1. Ambas as requisições passam pela checagem `transfer.status === 'APROVADA'` (pois a transferência ainda está `PENDENTE`).
2. Ambas executam `await verifyAuthenticationResponse(...)`.
3. Ambas geram recibo criptográfico e liquidam a transferência em duplicidade, causando inconsistência no ledger bancário.

### Correção Recomendada
Implementar lock atômico de estado (ex: `PROCESSANDO` / `lock`) antes do `await`, com rollback garantido no bloco `catch` / `finally`:

```javascript
// ==========================================
// CORREÇÃO: Lock Atômico de Processamento
// ==========================================

// 1. Checagem de Concorrência e Idempotência
if (transfer.status === 'APROVADA') {
  throw new TransactionConflictError(`A transferência [${id}] já se encontra liquidada.`);
}

if (transfer.status === 'PROCESSANDO') {
  throw new TransactionConflictError(`A transferência [${id}] já está em processamento de liquidação concorrente.`);
}

// 2. Trava atômica imediata antes de qualquer operação assíncrona
transfer.status = 'PROCESSANDO';

try {
  // Executa a verificação WebAuthn assíncrona
  const verification = await verifyAuthenticationResponse({ ... });

  if (!verification.verified || !verification.authenticationInfo) {
    throw new WebAuthnSecurityError('Assinatura biométrica ilegítima.');
  }

  // Efetiva a aprovação
  transfer.status = 'APROVADA';
  transfer.approvedBy = database.director.displayName;
  transfer.approvedAt = new Date().toLocaleString('pt-BR');
  transfer.credentialIdUsed = userCredential.id;
  transfer.cryptoProof = `0x${proofHash}`;
} catch (error) {
  // Rollback do lock caso a verificação falhe
  if (transfer.status === 'PROCESSANDO') {
    transfer.status = 'PENDENTE';
  }
  throw error;
}
```

---

## 2. 🟠 [ALTA] Segredo HMAC Volátil em Arquitetura Serverless (Vercel)

### Localização
`server.js` (linha ~24):
```javascript
const HMAC_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
```

### Onde quebra
Em ambiente Serverless / Lambdas (Vercel) ou instâncias auto-escaladas, se `SESSION_SECRET` não for configurado nas variáveis de ambiente, cada réplica ou cold start gera um `HMAC_SECRET` randômico diferente na memória.
- **Efeito:** O cliente recebe o desafio emitido pela Instância A. Ao submeter a biometria, a requisição cai na Instância B. A Instância B valida a assinatura com outro segredo e lança `Assinatura do desafio corrompida ou adulterada por atacante (401)`.

### Correção Recomendada
Falhar explicitamente no startup se `SESSION_SECRET` não estiver presente em ambiente de produção/cloud:

```javascript
const HMAC_SECRET = process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('CRITICAL FATAL: SESSION_SECRET obrigatória em ambiente produtivo!'); })()
    : 'midas_dev_insecure_static_secret_key_change_me_12345'
);
```

---

## 3. 🟠 [ALTA] Host Header Poisoning & Spoofing de RP ID

### Localização
`server.js` (linhas ~191 a 199) na função `extractRelyingPartyContext(req)`:
```javascript
function extractRelyingPartyContext(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = forwardedHost || req.headers.host || `localhost:${PORT}`;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const hostname = hostHeader.split(':')[0];
  const origin = `${proto}://${hostHeader}`;
  return { rpID: hostname, origin };
}
```

### Onde quebra
O WebAuthn valida criptograficamente o `rpID` e a `origin`. Se a aplicação confia cegamente em `x-forwarded-host` sem uma allowlist, um atacante pode injetar hosts arbitrários através de proxies reversos não controlados.

### Correção Recomendada
Validar contra uma allowlist explícita de domínios permitidos:

```javascript
const ALLOWED_RP_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'toque-de-midas.vercel.app',
  process.env.APP_DOMAIN // se houver domínio customizado configurado
].filter(Boolean));

function extractRelyingPartyContext(req) {
  const rawHost = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const hostname = rawHost.split(':')[0].toLowerCase();

  if (!ALLOWED_RP_HOSTS.has(hostname) && process.env.NODE_ENV === 'production') {
    throw new WebAuthnSecurityError(`RP ID inválido ou não autorizado: [${hostname}].`);
  }

  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const origin = `${proto}://${rawHost}`;

  return { rpID: hostname, origin };
}
```

---

## 4. 🟡 [MÉDIA] Sobrescrita Indevida do Usuário Diretor em Rota Pública

### Localização
`server.js` (linhas ~266 a 268) em `POST /api/register/generate-options`:
```javascript
const { username, displayName } = req.body;
if (username) database.director.username = String(username).trim();
if (displayName) database.director.displayName = String(displayName).trim();
```

### Onde quebra
Qualquer usuário anônimo pode enviar um payload POST com `{ "username": "hacker@evil.com", "displayName": "Invasor" }` e alterar o cadastro do diretor da tesouraria em memória sem nenhuma autenticação prévia.

### Correção Recomendada
Sanitizar e restringir a edição do diretor, aceitando apenas via rota autenticada ou travando o perfil fixo de demonstração:

```javascript
// No contexto da demonstração C-Level, não permitir mutação descontrolada:
if (username && typeof username === 'string' && username.includes('@')) {
  // Apenas formata se for e-mail corporativo válido @midasbank.com
  if (username.endsWith('@midasbank.com')) {
    database.director.username = username.trim().toLowerCase();
  }
}
```

---

## 5. 🧪 SUÍTE DE TESTES AUTOMATIZADOS DE VALIDAÇÃO
Para garantir que as correções surtiram efeito sem regressão, criamos o arquivo de testes:
- [`treasury.test.js`](file:///c:/Users/Aluno%20Tech/Documents/AntiGravity/treasury.test.js)

Para rodar os testes após a aplicação das correções:
```bash
npm install -D supertest jest
npx jest treasury.test.js
```

---
**Assinado:**  
*Lead QA & Test Automation Architect (Chaos & Resilience)*
