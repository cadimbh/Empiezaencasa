# Funil /recibe — Primer Negocio

## O que o visitante recebe

1. Conversa guiada em espanhol mexicano, com respostas por botões. Não é uma IA nem uma atendente humana.
2. Acesso imediato e livre ao recetário fotográfico (56 páginas) e ao bônus de vendas (14 páginas), sem formulário obrigatório.
3. Opção de contribuição única e voluntária de **100, 200 ou 300 MXN**. Nenhum valor personalizado ou cobrança recorrente.
4. SPEI com CLABE, banco e beneficiário retornados pela XPag; OXXO com referência e, se fornecido, código de barras.
5. Consulta do pagamento pelo servidor à API autenticada da XPag. Nunca é confirmado por um clique ou por um comprovante enviado pelo visitante.

Quem não contribuir mantém acesso ao mesmo material. Os arquivos nesta rota são públicos, por decisão do modelo de entrega antes do pagamento. A página de vendas `/` permanece com seu checkout e somente PageView.

## Ativação na Vercel

O código está pronto para receber credenciais, mas **nenhum pagamento real foi criado ou testado nesta implementação**. É necessário configurar as variáveis e validar os dois meios com a conta do vendedor antes de enviar tráfego.

Em Settings → Environment Variables, adicione para o ambiente de produção:

| Variável | Conteúdo |
|---|---|
| `XPAG_CLIENT_ID` | Client ID da API da XPag |
| `XPAG_CLIENT_SECRET` | Client Secret da mesma integração |
| `FUNNEL_SECRET` | Segredo aleatório de pelo menos 32 caracteres |
| `PUBLIC_SITE_URL` | `https://venderencasa.vercel.app` (a origem exata usada pelo visitante) |

Use credenciais com permissões **cashin** (gerar cobrança) e **balance** (consultar transação). Não é necessário cashout. Insira os segredos apenas no painel privado da Vercel; nunca no GitHub, no HTML ou no site-config.js. Depois, faça um novo deployment.

O endpoint `/api/funnel-config` informa apenas se os pagamentos estão disponíveis; não revela credenciais. Sem configuração, o material funciona e o pagamento é desativado. O link de checkout antigo não é usado para simular múltiplos valores.

Configuração Vercel: Framework Other, raiz deste projeto, sem comando de build e saída `.`. A pasta `api/` contém as funções Node e `lib/xpag.cjs` a integração compartilhada.

## Pagamentos e limites do MVP

- SPEI: `POST /cashin`, moeda MXN e valor exato escolhido. O exemplo oficial de CLABE dinâmica também apresenta `name` e `document`; a documentação consultada não declara se são obrigatórios. Esta implementação não inventa identidade ou CURP. Se a conta exigir identificação, o fluxo deverá pedir os campos exigidos antes da ativação.
- OXXO: o mesmo endpoint, `method: OXXO`, `generateCheckout: false`. `payerData` é opcional segundo a documentação; não se fabrica um e-mail para o visitante.
- Os valores vêm de uma lista permitida no servidor. O visitante não pode alterar o total para outro valor enviando uma requisição personalizada.
- Consulta autenticada: `GET /consult-transaction?request_number=...`. O token criptografado vincula referência, valor e sessão. Somente `type: cashin`, `status: confirmed`, referência e valor correspondentes podem confirmar uma contribuição.
- As instruções e o avanço ficam no navegador. Ao voltar, a pessoa pode consultar sua referência pendente. Se apagar os dados do navegador ou usar outro dispositivo, não recupera automaticamente esse histórico.
- A consulta automática ocorre enquanto a página está visível, a cada 20 segundos, por até 4 minutos por sessão de exibição. Depois, há consulta manual. OXXO pode levar mais tempo. Não foi implementado um banco de dados ou um webhook próprio; os registros financeiros permanecem na XPag.
- Sem envio automático de mensagens, e-mails ou lembretes depois de fechar a página. Remarketing é uma campanha separada a configurar na Meta.
- Falha ou timeout ao gerar instruções exige verificar a XPag antes de repetir: a API consultada não documenta garantia de idempotência para CLABE dinâmica e OXXO. Não há repetição automática de geração. A página reutiliza a referência guardada e evita cliques simultâneos.
- O limite de geração por sessão é de quatro tentativas por minuto, em memória de cada instância. Não é um limite distribuído. Configure limite de requisições no Vercel Firewall para `/api/contribution` antes de escalar tráfego; acompanhe os limites da API da XPag.
- A vigência apresentada usa os prazos informados na documentação: 24 horas para CLABE dinâmica e 12 dias para OXXO. Reconfirme as condições atuais da conta. A eventual comissão da loja OXXO é informada ao visitante.

## Meta e remarketing

Pixel: **1756938315538597**.

| Evento | Quando ocorre | Uso |
|---|---|---|
| `PageView` | Carregamento da página pública | Visita |
| `MaterialAccess` (personalizado) | Primeiro clique para abrir cada arquivo, neste navegador | Público de acesso ao material |
| `ContributionConfirmed` (personalizado) | Servidor confirma pagamento na XPag e página recebe a confirmação | Excluir contribuintes do público |

`MaterialAccess` mede o clique de acesso, não consegue provar que o visitante salvou ou leu o arquivo. Só clicar para liberar o material não dispara esse evento. Bloqueadores podem impedir o rastreio; a entrega continua funcionando.

Não há `InitiateCheckout` nem `Purchase` adicionado pelo novo site. A integração existente da XPag é responsável pelo `Purchase`; valide se ela registra também cobranças criadas pela API, e não apenas o checkout hospedado. Não foi duplicado Purchase no navegador sem conhecer o event_id usado pela XPag.

Na Meta, crie um público de visitantes que geraram `MaterialAccess` na rota `/recibe`, por exemplo nos últimos 7 dias, excluindo `ContributionConfirmed` e `Purchase` do mesmo período. Comece com um lembrete curto e respeitoso: “¿Ya exploraste tus 25 recetas? Si te ayudaron, puedes apoyar el proyecto. Tu aportación es opcional.” Esta estrutura não cria nem publica anúncios automaticamente. A exclusão depende dos eventos efetivamente recebidos; alguém que pagou com a página fechada pode depender do Purchase enviado pela XPag.

## Verificação antes do tráfego

1. Abra `/recibe` no celular. Libere e abra os dois arquivos sem pagar; confira os conteúdos.
2. Confirme que `/api/funnel-config` retorna `ready: true` após configurar os segredos.
3. Gere uma referência de cada meio com a conta real, confira importe, moeda, beneficiário e vigência. Não gere vários pagamentos iguais para testes sem acompanhar as referências.
4. O próprio vendedor deve realizar o pagamento de teste se desejar validar a confirmação de ponta a ponta. Antes do pagamento, o estado precisa ser “Pendiente”. Depois de aprovação real, deve aparecer o agradecimento.
5. Verifique a entrada na XPag, a taxa aplicada e os eventos da Meta. Não considere uma imagem de comprovante ou a geração da referência como pagamento recebido.
6. Confira o público de remarketing e a exclusão de quem já contribuiu, antes de ativar a campanha.

Testes locais com respostas simuladas validaram as seis combinações de valor/meio, rejeição de valores indevidos, origem/CSRF, token falsificado/vencido e pagamentos com referência, moeda ou valor incorretos. Esses testes não substituem a homologação na conta real.

A tentativa de homologação com as credenciais públicas indicadas em `/docs/sandbox` foi recusada pela API com `invalid_account`. Nenhuma cobrança real foi criada. A versão de produção também bloqueia as credenciais públicas de sandbox e respostas marcadas `sandbox: true`, para não confundir teste com contribuição recebida.

Documentação consultada: https://xpag.global/docs/autenticacao, https://xpag.global/docs/cobrancas e https://xpag.global/docs/status.
