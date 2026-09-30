# 🏛️ Relatório Técnico de Segurança & Conformidade LGPD
## Projeto: "Toque de Midas" — Autenticação Biométrica FIDO2 / WebAuthn para Transações C-Level
**Equipe 2** | Fintech Midas Bank Private Treasury

---

## 1. Contexto e Motivação da Engenharia de Segurança

Em instituições financeiras e fintechs modernas, transferências de valores vultosos (acima de R$ 1 milhão) representam o alvo prioritário de ameaças cibernéticas sofisticadas (APTs - *Advanced Persistent Threats*), destacando-se:
- **Ataques de Phishing e Engenharia Social:** Onde executivos são induzidos a inserir credenciais estáticas ou códigos SMS/OTP em domínios clonados.
- **Sequestro de Sessão (Session Hijacking):** Extração remota de cookies de autenticação via malwares do tipo *Infostealer*.
- **Vazamentos de Base de Dados (Dumps SQL/NoSQL):** Onde invasores extraem credenciais, hashes de senhas ou sementes (*seeds*) de tokens.

Para neutralizar integralmente esses três vetores de risco, o projeto **"Toque de Midas"** substitui a confiança em senhas pelo protocolo aberto **FIDO2 / WebAuthn** (*World Wide Web Consortium - W3C Recommendation*), atrelando a autorização de cada transação à presença física do Diretor e ao chip de segurança inviolável do seu dispositivo pessoal.

---

## 2. Reflexão de Segurança: Respostas Fundamentadas

### ❓ Pergunta 1: A impressão digital do usuário viaja pela internet ou fica salva apenas no hardware do celular/computador?

> **Resposta Categórica:** **A biometria NUNCA viaja pela internet nem sai do hardware do usuário.**

#### Detalhamento Técnico e Arquitetural:
1. **Isolamento em Hardware Seguro:**  
   Quando o usuário cadastra sua biometria (seja via Windows Hello, Apple Touch ID/Face ID ou Biometria Android), o sensor óptico ou capacitivo envia os dados brutos exclusivamente para uma área de segurança isolada da placa-mãe ou processador:
   - **No Windows:** *TPM 2.0 (Trusted Platform Module)* e *VBS (Virtualization-Based Security)*.
   - **Na Apple:** *Secure Enclave Processor (SEP)*.
   - **No Android:** *TEE (Trusted Execution Environment)* ou chips Titan M.

2. **O que a biometria realmente faz?**  
   A impressão digital não é um "segredo compartilhado". Ela atua única e exclusivamente como um **fator de autorização local** para que o chip seguro desbloqueie o uso de uma **Chave Privada Criptográfica Assimétrica**. Nem mesmo o sistema operacional ou o navegador Google Chrome têm permissão de ler o mapa de cristas ou a imagem do dedo.

3. **O que é transmitido pela rede (HTTP)?**  
   Durante a aprovação de uma transferência de R$ 1 milhão:
   - O servidor do banco envia um número pseudoaleatório criptográfico de uso único denominado **Desafio (*Challenge*)**.
   - O usuário toca no sensor. O chip local valida a digital e assina digitalmente esse desafio com a **Chave Privada**.
   - O navegador envia ao servidor apenas o pacote de asserção contendo:
     - O ID da credencial;
     - Os dados do cliente autenticado (*clientDataJSON*);
     - A **Assinatura Criptográfica** gerada pelo hardware.
   
O banco de dados da Fintech recebe e valida uma assinatura matemática, tendo garantia matemática absoluta de presença física sem jamais ter tido contato com a biometria do cliente.

---

### ❓ Pergunta 2: Como esse modelo protege contra vazamento de banco de dados (como o ocorrido em ataques de Dump/SQL Injection)?

> **Resposta Categórica:** **No modelo FIDO2/WebAuthn, o banco de dados armazena apenas CHAVES PÚBLICAS. O vazamento de 100% da base não compromete a capacidade de autorização das transações.**

#### Comparativo de Resiliência a Vazamento:

| Critério de Comparação | Autenticação Clássica (Senhas / SMS / TOTP) | Modelo WebAuthn / Toque de Midas (FIDO2) |
| :--- | :--- | :--- |
| **O que fica salvo no banco do banco?** | Hash de senha (bcrypt/argon2) ou chave-mestra TOTP. | **Apenas a Chave Pública (SPKI)** e o ID da credencial. |
| **Impacto do vazamento da base:** | Invasor quebra hashes via GPU (Hashcat/Rainbow Tables) ou gera tokens TOTP sem limites. | **Risco Zero de Fraude:** A Chave Pública é projetada para ser pública. Não permite derivar a Chave Privada. |
| **Capacidade de forjar transferência:** | **SIM:** Invasor forja requisições autenticadas remotamente. | **NÃO:** O invasor precisaria ter a posse física do notebook/celular do Diretor e a digital do dedo dele. |
| **Resistência a Ataques de Replay:** | Baixa (tokens de sessão podem ser reutilizados se interceptados). | **Total:** Cada desafio (*challenge*) expira em segundos e os contadores de hardware (*signCount*) impedem clones. |

*Fundamentação Matemática:*  
O algoritmo padrão (ex: `ES256` - ECDSA sobre curva P-256) baseia-se no problema do logaritmo discreto sobre curvas elípticas. É computacionalmente inviável para qualquer computador no planeta derivar a chave privada a partir da chave pública exposta em um vazamento de banco de dados.

---

### 3. Proteção Adicional: Imunidade a Ataques de Phishing

A especificação WebAuthn amarra criptograficamente o par de chaves ao identificador da origem da aplicação (**RP ID - Relying Party ID**, ex: `midasbank.com`).  
Mesmo que um invasor crie uma réplica visualmente idêntica da página em um domínio falso (ex: `midasbank-seguro.com`), a API nativa do navegador se recusa a invocar a credencial criada para o domínio legítimo. **O phishing remoto torna-se tecnicamente inoperante.**

---

## 4. Conformidade e Adequação com a LGPD (Lei nº 13.709/2018)

A LGPD classifica a impressão digital como **Dado Pessoal Sensível** (Art. 5º, inciso II), impondo requisitos rigorosos de tratamento, auditoria e sanções severas em caso de vazamento.

O projeto "Toque de Midas" aplica o conceito de **Privacy by Design** (Privacidade desde a Concepção):
1. **Princípio da Necessidade e Não-Coleta:** Como a biometria nunca transita para fora do chip do diretor, a Fintech **não armazena nem custodia dados biométricos**. Não há risco de violação de dados sensíveis na nuvem.
2. **Termos de Uso Transparentes:** A tela de cadastro inclui texto explicativo claro informando a mecânica de assinatura pública, cumprindo com o dever de transparência do Art. 6º, VI da LGPD.

---

## 5. Conclusão

A arquitetura WebAuthn implementada no projeto **"Toque de Midas"** eleva o padrão de segurança da tesouraria do Midas Bank ao estado da arte mundial, alinhando-se às diretrizes do Banco Central do Brasil (BACEN) e da FIDO Alliance para operações financeiras críticas de alto valor.
