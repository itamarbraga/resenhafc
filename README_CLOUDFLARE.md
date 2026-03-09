# Brazuca FC Groningen — Cloudflare native

Projeto final para Cloudflare Pages + Pages Functions + D1.

## Estrutura
- `index.html`, `styles.css`, `app.js`: front-end
- `functions/api/*`: API serverless na Cloudflare
- `schema.sql`: schema do banco
- `wrangler.toml`: configuração local/opcional

## O que já faz
- Página final com descrição em português
- Link do grupo do WhatsApp
- Contagem regressiva
- Patrocinadores abaixo do countdown
- Lista confirmada pública
- Envio de nome para aprovação
- Admin com login `itamar` / `futsal2026`
- Edição de data, horários, link de pagamento e máximo de vagas
- Aprovação/remoção de nomes
- Geração de 3 times
- Persistência em Cloudflare D1

## Publicar com GitHub + Cloudflare Pages
1. Suba a pasta inteira para um repositório GitHub.
2. No Cloudflare Dashboard, vá em **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Escolha o repositório.
4. Configure:
   - Framework preset: `None`
   - Build command: vazio
   - Build output directory: `.`
5. Crie um banco D1 chamado `brazuca-fc-db`.
6. No Pages project, vá em **Settings** > **Bindings** > **Add binding** > **D1 database**.
7. Use:
   - Variable name: `DB`
   - Database: seu banco D1 criado
8. Em **Settings** > **Environment variables**, crie:
   - `ADMIN_USER` = `itamar`
   - `ADMIN_PASSWORD` = `futsal2026`
9. Faça um novo deploy.

## Dados editáveis no admin
- Data do jogo
- Horário de chegada
- Início
- Término
- Link de pagamento
- Máximo de vagas

## Observações
- O app cria as tabelas automaticamente quando a API roda pela primeira vez.
- O `wrangler.toml` tem um placeholder para `database_id` e serve mais para desenvolvimento local.
- Em produção no Pages, o binding do D1 é configurado no dashboard.
