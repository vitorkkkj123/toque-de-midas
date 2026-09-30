# ⏱️ Roteiro de Apresentação (Pitch Técnico de 5 Minutos)
## EQUIPE 2: Projeto "Toque de Midas" (Impressão Digital)
**Público-alvo:** Professor(a), Avaliadores e Colegas de Turma

---

### Visão Geral do Cronômetro

```
[0:00 - 1:00] 🎯 Minuto 1: A Dor do Mercado (Por que senhas falham em R$ 1 milhão?)
[1:00 - 2:00] 💡 Minuto 2: A Solução Toque de Midas & Padrão WebAuthn (FIDO2)
[2:00 - 3:15] 🚀 Minuto 3: Demonstração Prática ao Vivo (Live Demo na Tela)
[3:15 - 4:15] 🛡️ Minuto 4: Segurança contra Vazamentos & Conformidade LGPD
[4:15 - 5:00] 🏆 Minuto 5: Conclusão, Resultados e Fechamento
```

---

### Minuto a Minuto Detalhado

#### 🎯 [0:00 - 1:00] Minuto 1: O Problema Real
> **Quem fala:** Integrante 1  
> **Slide/Tela:** Tela inicial do Midas Bank (com a lista de transferências milionárias)

- *"Boa noite professor, boa noite a todos. Somos a Equipe 2 e desenvolvemos o projeto **Toque de Midas**.*
- *Imagine o cenário: você é diretor de uma Fintech que movimenta dezenas de milhões de reais por dia. Um único clique autoriza transferências de R$ 1,5 milhão, R$ 2,4 milhões ou R$ 5 milhões.*
- *Como a maioria dos sistemas protege isso hoje? Com senhas estáticas ou códigos SMS/OTP.*
- *O problema é que senhas sofrem ataques de Phishing, o SMS pode ser clonado por SIM Swap, e malwares conseguem roubar cookies de sessão logada à distância.*
- *Se o diretor for infectado por um cavalo de troia remoto, o invasor transfere o dinheiro sem que ninguém perceba.*
- *Como impedir isso? Exigindo **presença física inegável** através da biometria do hardware."*

---

#### 💡 [1:00 - 2:00] Minuto 2: A Solução "Toque de Midas" & FIDO2
> **Quem fala:** Integrante 2  
> **Slide/Tela:** Aba de Vinculação Biométrica e Diagrama Criptográfico

- *"Para resolver esse problema, nós implementamos a tecnologia mais avançada do mercado financeiro global: o protocolo **FIDO2 / WebAuthn**, o mesmo padrão adotado por Apple, Google e pelos maiores bancos mundiais.*
- *Em vez de inventarmos um sistema caseiro, utilizamos a API nativa dos navegadores com a biblioteca `@simplewebauthn` no Node.js.*
- *Isso permite que a nossa aplicação web se comunique diretamente com o leitor de impressão digital do computador ou celular do Diretor — seja o **Windows Hello**, o **Apple Touch ID** ou o leitor biométrico do Android.*
- *Sem a necessidade de instalar nenhum driver, plugin ou programa externo."*

---

#### 🚀 [2:00 - 3:15] Minuto 3: Demonstração Prática ao Vivo (Live Demo)
> **Quem fala:** Integrante 3 (ou quem estiver pilotando o computador)  
> **Ação na Tela:** Executar o fluxo ao vivo diante da turma

- **Ação 1 (Vinculação):**
  - *"Vou mostrar o sistema funcionando ao vivo. Primeiro, o Diretor acessa a aba 'Vincular Biometria'. Ele digita seu nome e clica em 'Vincular com Impressão Digital'."*
  - *(O navegador exibe o prompt nativo do Windows Hello / Touch ID pedindo a digital).*
  - *"Vejam que a tela do próprio Windows / Mac é acionada. Eu encosto meu dedo no sensor... pronto! O dispositivo gerou um par de chaves e registrou a chave pública no banco."*
- **Ação 2 (Aprovação de R$ 2.450.000,00):**
  - *"Agora vamos para a Mesa de Operações. Temos aqui uma transferência de **R$ 2.450.000,00** para aquisição de uma aeronave corporativa. O status está PENDENTE.*
  - *Eu clico no botão **'Aprovar com Toque de Midas'**.*
  - *(Novo prompt biométrico abre).*
  - *O servidor gerou um desafio criptográfico de uso único. Eu coloco minha digital no sensor... e a transação é liquidada instantaneamente!*
  - *O sistema exibe o comprovante oficial com o hash criptográfico inviolável gerado pelo chip de segurança."*

---

#### 🛡️ [3:15 - 4:15] Minuto 4: Reflexão de Segurança & LGPD
> **Quem fala:** Integrante 4 (ou 1)  
> **Slide/Tela:** Aba de Auditoria & Simulador de Vazamento de Banco

- *"Agora, a pergunta crucial que o desafio nos propôs:*
  - **1. A impressão digital do diretor viajou pela internet até o servidor da Fintech?**
    *Resposta: **NUNCA!** O sensor biométrico fica isolado no chip TPM da placa-mãe. Nem o Google Chrome tem acesso ao desenho do dedo. O que viaja pela rede é apenas uma assinatura matemática.*
  - **2. E se o banco de dados da nossa Fintech for invadido e vazar 100%, como na Aula 1?**
    *(Clica no botão 'Executar Ataque Hacker' na tela).*
    *Vejam na tela o resultado do dump: o invasor obtém apenas a **Chave Pública**. Na criptografia assimétrica, a chave pública não permite forjar assinaturas. O hacker precisaria ter fisicamente o notebook do diretor e o dedo dele. Logo, o vazamento de banco não gera fraude.*
  - **3. E quanto à LGPD?**
    *Nosso parágrafo obrigatório explica isso: como não coletamos nem armazenamos biometria, aplicamos o conceito de Privacy by Design, cumprindo rigorosamente a Lei 13.709/2018."*

---

#### 🏆 [4:15 - 5:00] Minuto 5: Conclusão e Fechamento
> **Quem fala:** Integrante 2 (ou líder da equipe)  
> **Slide/Tela:** Tela final de agradecimento e visão do portal

- *"Em resumo, o projeto **Toque de Midas** entrega:*
  - *1. Código 100% funcional com WebAuthn e interface moderna em Bootstrap;*
  - *2. Risco zero de fraudes por vazamento de senha ou phishing remoto;*
  - *3. Conformidade total com normas do Banco Central e LGPD.*
- *Agradecemos a atenção do professor e da turma e estamos abertos para perguntas!"*

---

### 💡 Possíveis Perguntas da Banca e Como Responder

1. **"O que acontece se o diretor perder o notebook?"**
   - *Resposta:* *"O banco possui uma política de revogação de credencial administrativa no cofre de segurança, permitindo cadastrar um novo dispositivo seguro com autorização presencial do conselho de administração."*
2. **"Funciona em celular também?"**
   - *Resposta:* *"Sim! Como a WebAuthn API é um padrão W3C, o mesmo código funciona nativamente no Safari do iPhone com Face ID/Touch ID ou no Chrome do Android com leitor biométrico sob a tela."*
3. **"Por que usar WebAuthn em vez de pedir uma foto da digital?"**
   - *Resposta:* *"Tirar foto da digital seria uma falha gravíssima de segurança e violaria a LGPD, além de permitir ataques de replay. O WebAuthn é descentralizado e baseado em hardware."*
