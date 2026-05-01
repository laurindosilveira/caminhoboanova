# Supabase Secrets Setup

Este projeto depende de segredos nas Edge Functions para push, Stripe, WhatsApp
e operacoes administrativas. Nao coloque esses valores no `.env` do frontend nem
em commits.

## Segredos obrigatorios

```env
SUPABASE_URL=https://hmmbspebnqkueqwcqinr.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

STRIPE_SECRET_KEY=

WHATSAPP_PROVIDER=webhook
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_INSTANCE_ID=

APP_URL=https://app.caminhoboanova.com
```

## Onde sao usados

`VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`:

- `get-vapid-key`
- `send-push-notifications`
- `admin-push`
- `event-reminders`
- `notify-chat-reply`
- `notify-prayer-confirm`
- `prayer-pairs`
- `test-notifications`

`STRIPE_SECRET_KEY`:

- `create-checkout`
- `check-subscription`
- `customer-portal`

`SUPABASE_SERVICE_ROLE_KEY`:

- Funcoes administrativas, cron jobs, notificacoes, Stripe e rotinas de suporte.

## Como gerar VAPID

```powershell
npx web-push generate-vapid-keys
```

Use a chave publica em `VAPID_PUBLIC_KEY` e a privada em `VAPID_PRIVATE_KEY`.
Nao coloque aspas, virgulas ou quebras de linha nos valores salvos.

## Como configurar no Supabase

Crie um arquivo local que nao sera commitado:

```powershell
Copy-Item supabase\secrets.example.env supabase\secrets.env
```

Preencha `supabase\secrets.env` com os valores reais e envie para o projeto:

```powershell
supabase secrets set --env-file supabase\secrets.env
```

Depois redeploye as Edge Functions alteradas ou todas as funcoes do projeto.

## Testes de verificacao

1. VAPID publico:

```powershell
supabase functions invoke get-vapid-key
```

O retorno deve conter `publicKey` nao vazio.

2. Push real:

No app, entre em Configuracoes de notificacao, ative push e use o teste de push.
Se retornar erro de VAPID, confira `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

3. Stripe checkout:

Abra o fluxo de assinatura e crie uma sessao de checkout. Erro
`STRIPE_SECRET_KEY is not set` significa que o segredo ainda nao chegou na Edge
Function ou a funcao precisa ser redeployada.

4. Stripe portal e assinatura:

Com um usuario que tenha cliente Stripe, teste `customer-portal` e
`check-subscription`. Ambos dependem de `STRIPE_SECRET_KEY` e
`SUPABASE_SERVICE_ROLE_KEY`.

## Rotacao

Ao trocar VAPID, usuarios podem precisar reativar a inscricao push, porque a
subscription do navegador fica vinculada a chave publica anterior.

Ao trocar Stripe, use uma chave do mesmo modo do ambiente: `sk_test_...` para
teste e `sk_live_...` para producao. Os `price_id` atuais estao em
`src/lib/stripePlans.ts`.
