# 25 Comidas — site para GitHub e Vercel

Página de vendas em espanhol mexicano. Preço: **100 MXN**, pagamento único.
Design pop com as fontes Anton e Lilita One, fotos ilustrativas, prévias reais dos PDFs e simulador de ganhos brutos.

## Publicar

1. Extraia o ZIP e envie **o conteúdo desta pasta** para seu repositório GitHub.
2. Importe o repositório na Vercel.
3. Escolha Framework Preset **Other**. Root Directory é a pasta com `index.html` (a raiz, se você enviou o conteúdo).
4. Não precisa de instalação nem comando de build. Output Directory: `.`.
5. Publique. O checkout e o Pixel já estão configurados nesta versão.

## Inserir o checkout

Em `site-config.js`, coloque o endereço HTTPS completo em `checkoutUrl`:

```js
window.SITE_CONFIG = Object.freeze({
  price: 100,
  currency: 'MXN',
  checkoutUrl: 'https://xpag.global/pay/RqU3tfrO',
  pixelId: '1756938315538597',
});
```

Todos os botões usam esse mesmo link. Os parâmetros de campanha UTM e `fbclid` são preservados. Se o endereço for removido, a página exibe um aviso de compra indisponível.

## Pixel do Facebook

Pixel Meta **1756938315538597**:

- `PageView`: uma visita quando a página é carregada.
- Os botões de compra redirecionam imediatamente para o checkout, sem enviar eventos ao Pixel.
- O redirecionamento funciona mesmo se o rastreamento for bloqueado.

A página de vendas envia apenas `PageView`, sem eventos de início de checkout ou compra. A compra confirmada precisa ser registrada pelo checkout após aprovação do pagamento. A configuração da Xpag não foi alterada.

Para verificar após publicar, abra a URL da página em Testar Eventos no Gerenciador de Eventos da Meta. Confira `PageView`; clicar em comprar apenas redireciona para a Xpag. Bloqueadores de anúncio podem impedir o envio.

Ao trocar o ID no futuro, atualize também a imagem de fallback `<noscript>` em `index.html`.

Configure também preço, entrega dos arquivos, suporte e condições de compra na sua plataforma de checkout.

## Conteúdo e cálculos

- Recetario: 56 páginas e 25 receitas.
- Bônus: Tu Primera Ruta de Pedidos, 14 páginas.
- Duas páginas reais do recetario podem ser ampliadas.
- Simulador: picadillo a $65 por porção, custo estimativo $42.50, ganho bruto $22.50. O lote original custa $255 para 6 porções: $215 ingredientes + $40 embalagem e energia.
- Opções: 6, 12 ou 24 porções e 1, 3 ou 5 entregas por semana.
- Os gráficos mostram vendas, custo e ganho bruto, assumindo venda de todas as porções e custos proporcionais. Trabalho, entrega, impostos e comissões não estão descontados. Não é promessa de lucro.

Os PDFs completos ficam fora desta pasta pública. Entregue-os pela sua plataforma de venda.

## Arquivos principais

- `index.html`: conteúdo em espanhol.
- `styles.css`: visual e adaptação ao celular.
- `app.js`: simulador, checkout, prévias e botão flutuante.
- `pixel.js`: carregamento do Pixel e evento de visita.
- `site-config.js`: preço e link do checkout.
- `vercel.json`: configurações de hospedagem.
- `assets/`: imagens WebP e fontes locais (licenças OFL incluídas).

Para mudar o preço, atualize a configuração e os textos de $100 no HTML. O preço de $65 no simulador é o da porção de comida, não o do PDF.

Para visualizar localmente com Python: `python -m http.server 4173`. Abra `http://localhost:4173`.
