# Brazuca FC Groningen — V5

## Login inicial do admin
- Usuário: `itamar`
- Senha: `futsal2026`

## Deploy no GitHub + Netlify
1. Suba todos os arquivos desta pasta para um repositório no GitHub.
2. Na Netlify, escolha **Add new site** > **Import an existing project**.
3. Conecte o repositório.
4. O arquivo `netlify.toml` já está pronto para publicar a raiz do projeto.
5. Faça o deploy.

## Persistência dos dados
- Sem Firebase configurado, o site salva no navegador com `localStorage`.
- Com Firebase configurado em `app-config.js`, os dados da lista, pendências, times e configurações ficam persistidos no Firestore.

## Para ativar o Firebase
1. Crie um projeto no Firebase.
2. Ative Firestore.
3. Ative Authentication com Email/Password se quiser também login por email.
4. Copie as chaves do app web para `app-config.js`.
5. Faça novo commit/push no GitHub.

## Campos editáveis no admin
- Data do jogo
- Horário de chegada
- Horário de início
- Horário de término
- Link de pagamento
- Número máximo de vagas

## Dados fixos do site
- Valor: €4
- Local: ACLO Groningen
- Endereço: Blauwborgje 16, 9747 AC Groningen
