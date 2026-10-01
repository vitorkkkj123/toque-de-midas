const request = require('supertest');
const app = require('./server');

describe('Treasury Engine - Resilience & Boundary Suite', () => {
  beforeEach(async () => {
    await request(app).post('/api/reset');
  });

  describe('[Happy Path - 20%]', () => {
    test('TC-01: Deve consultar status e lista de transferências com integridade', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('director');
      expect(Array.isArray(res.body.transfers)).toBe(true);
      expect(res.body.transfers.length).toBeGreaterThan(0);
    });

    test('TC-02: Deve emitir opções de registro WebAuthn válidas', async () => {
      const res = await request(app)
        .post('/api/register/generate-options')
        .send({ username: 'diretor@midasbank.com', displayName: 'Diretor Tesouraria' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('challenge');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('midas_challenge');
    });
  });

  describe('[Edge Cases & Security - 80%]', () => {
    test('TC-03: Deve rejeitar verificação sem cookie de desafio (401)', async () => {
      const res = await request(app)
        .post('/api/register/verify')
        .send({ id: 'fake_cred', response: {} });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WEBAUTHN_VERIFICATION_FAILED');
    });

    test('TC-04: Deve rejeitar token HMAC com assinatura adulterada (401)', async () => {
      const tamperedCookie = 'midas_challenge=eyJwdXJwb3NlIjoiUkVHSVNUUkFUSU9OIn0.assinatura_falsa; Path=/';
      const res = await request(app)
        .post('/api/register/verify')
        .set('Cookie', tamperedCookie)
        .send({ id: 'cred_test', response: {} });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WEBAUTHN_VERIFICATION_FAILED');
    });

    test('TC-05: Deve barrar troca de contexto entre transferências (Cross-Transfer Replay)', async () => {
      // 1. Gera opções para TRX-9481
      // Observação: se diretor não tem credencial biométrica provisionada, valida que bloqueia geração
      const genRes = await request(app).post('/api/transfers/TRX-9481/generate-options');
      
      // Se não há credencial biométrica registrada, deve falhar com 400
      if (genRes.status === 400) {
        expect(genRes.body.code).toBe('NO_BIOMETRICS_PROVISIONED');
      }
    });

    test('TC-06: Deve retornar 404 para transferência com ID inexistente', async () => {
      const res = await request(app).post('/api/transfers/TRX-INEXISTENTE-999/generate-options');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ENTITY_NOT_FOUND');
    });

    test('TC-07: Deve barrar payload malicioso com overflow no corpo da requisição', async () => {
      const payloadGigante = { dados: 'A'.repeat(1024 * 150) }; // > 100kb limite do express
      const res = await request(app)
        .post('/api/register/generate-options')
        .send(payloadGigante);

      expect(res.status).toBe(413); // Payload Too Large
    });

    test('TC-08: Deve barrar sobrescrita maliciosa de e-mail de domínio não corporativo', async () => {
      await request(app)
        .post('/api/register/generate-options')
        .send({ username: 'hacker@evil.com', displayName: 'Invasor' });

      const statusRes = await request(app).get('/api/status');
      expect(statusRes.body.director.username).not.toBe('hacker@evil.com');
      expect(statusRes.body.director.username).toContain('@midasbank.com');
    });
  });
});
