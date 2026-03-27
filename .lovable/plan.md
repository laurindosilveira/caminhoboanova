
## Liberar Acesso do E-mail laurindosilveira@gmail.com

### Diagnóstico

O log do backend confirma:
- O cadastro foi feito com sucesso (status 200 no /signup)
- O link de confirmação enviado por e-mail **expirou ou não foi clicado** (erro "One-time token not found")
- Ao tentar fazer login, o sistema rejeita com `"400: Email not confirmed"`

### Solução

Executar uma migração SQL que confirma manualmente o e-mail do usuário direto no banco de dados, desbloqueando o acesso imediatamente.

### Alteração Técnica

**Migration SQL:**
```sql
UPDATE auth.users
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'laurindosilveira@gmail.com'
  AND email_confirmed_at IS NULL;
```

Isso marca o e-mail como confirmado sem precisar reenviar o link, permitindo o login imediatamente.

### Considerações

- Esta ação afeta **apenas** o usuário `laurindosilveira@gmail.com`
- O perfil já foi criado no banco (via trigger), então após a confirmação o login funcionará normalmente
- Nenhuma alteração de código é necessária, apenas a execução da query no banco
