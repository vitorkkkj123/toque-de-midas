# 🏛️ Projeto "Toque de Midas" (Impressão Digital)
### EQUIPE 2 | Portal de Aprovações de Alto Valor via FIDO2 / WebAuthn

Aplicação web completa desenvolvida para fintechs e tesourarias executivas (C-Level), utilizando a **WebAuthn API (FIDO2)** e biometria nativa de hardware (**Windows Hello**, **Touch ID**, **Face ID** e **Android**) para autorização de transferências bancárias superiores a **R$ 1.000.000,00**.

---

## 📸 Funcionalidades do Projeto

1. **Vincular Dispositivo Biométrico (Registro WebAuthn):**
   - Criação de par de chaves assimétricas criptografadas no chip de segurança do dispositivo (TPM / Secure Enclave).
   - Armazenamento apenas da chave pública no servidor.
   - Parágrafo obrigatório de conformidade com a **LGPD (Lei 13.709/2018)**.

2. **Mesa de Operações de Alto Valor (Aprovação de Transferência):**
   - Listagem de transferências financeiras críticas (R$ 1.8M a R$ 5.2M).
   - Acionamento direto do prompt nativo do sistema operacional para leitura biométrica.
   - Validação criptográfica do desafio (*challenge*) e emissão de comprovante oficial com hash SHA-256.

3. **Central de Auditoria & Simulador de Vazamento:**
   - Visualização didática de dados da rede (Públicos) vs dados do hardware (Privados).
   - Simulador interativo: *"E se o banco vazar?"* demonstrando matematicamente a invulnerabilidade da base.

4. **Interface Moderna em Bootstrap 5:**
   - Tema luxuoso escuro (*Executive Dark / Midas Gold*), responsivo e acessível.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** v18+ instalado.
- Navegador moderno com suporte a WebAuthn (Google Chrome, Edge, Safari, Firefox).
- Computador ou celular com sensor biométrico, PIN ou chave física (Windows Hello, Touch ID, etc.).

### Passo a Passo

1. **Instalar as dependências:**
   ```bash
   npm install
   ```

2. **Iniciar o servidor:**
   ```bash
   npm start
   # ou
   node server.js
   ```

3. **Acessar no navegador:**
   Abra:
   ```
   http://localhost:3000
   ```
   *(Em `localhost`, os navegadores autorizam a WebAuthn API como contexto seguro nativo).*

---

## ☁️ Como Fazer Deploy em Nuvem (Entregável 1)

> [!IMPORTANT]
> A WebAuthn API **exige HTTPS obrigatório** quando executada fora de `localhost`. Plataformas como **Render**, **Railway** e **Vercel** fornecem certificado SSL/HTTPS gratuito automaticamente.

### Opção 1: Deploy no Render (Recomendado e Gratuito)
1. Crie uma conta em [render.com](https://render.com).
2. Suba este projeto para um repositório no seu GitHub.
3. No painel do Render, clique em **New +** -> **Web Service**.
4. Conecte seu repositório.
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Clique em **Create Web Service**. Seu link HTTPS estará pronto em minutos!

### Opção 2: Deploy no Railway
1. Acesse [railway.app](https://railway.app).
2. Clique em **Deploy from GitHub repo** e selecione o repositório.
3. O Railway detectará o Node.js e gerará o domínio com HTTPS automático.

---

## 📁 Estrutura de Arquivos

```
├── server.js                   # Backend Express + @simplewebauthn/server
├── package.json                # Dependências do projeto
├── RELATORIO_SEGURANCA.md      # Relatório técnico com as respostas de segurança e LGPD
├── ROTEIRO_PITCH_5MIN.md       # Roteiro cronometrado para a apresentação de 5 minutos
├── public/
│   ├── index.html              # Interface do portal com Bootstrap 5
│   ├── css/
│   │   └── style.css           # Tema Midas Bank Dark/Gold
│   └── js/
│       └── app.js              # Lógica de integração com @simplewebauthn/browser
```

---

## 👥 Equipe 2
- **Projeto:** Toque de Midas (Impressão Digital)
- **Tecnologias:** Node.js, Express, @simplewebauthn, WebAuthn API, Bootstrap 5.
