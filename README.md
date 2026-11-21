# 🐖 Granja Suína — Gestão Integrada

Aplicativo web (100% estático, sem backend próprio) para administrar uma granja de suínos:
lotes em engorda, manejo sanitário, plantel reprodutivo, custos, financeiro e estoque —
com indicadores zootécnicos calculados automaticamente.



## 🌐 Publicar na Vercel (site instalável)

1. Em vercel.com → **Add New… → Project** → importe o repositório `J4aoo/Suinocultura`.
2. Não precisa mudar nada: o `vercel.json` já diz para publicar a pasta `www/` (sem build).
3. Clique em **Deploy**. Cada envio para a branch `main` atualiza o site sozinho.

**Instalar no Android:** abra o endereço da Vercel no Chrome → ⋮ → **Instalar aplicativo** → **Instalar**.

**Onde ficam os dados:** no próprio celular, no armazenamento do navegador. Eles continuam
salvos depois de fechar o site ou reiniciar o celular. O site pede ao Chrome armazenamento
"permanente", para não ser apagado quando falta espaço. Os dados só se perdem se você
**limpar os dados do Chrome/site**, desinstalar o app ou trocar de celular. Por isso,
use **Ajustes → Exportar backup** de vez em quando.

---

## 📱 App Android (APK) — como funciona este repositório

- O app web fica em `www/` e é empacotado como app Android com **Capacitor 7**.
- Os dados ficam num **banco SQLite dentro do celular** (`@capacitor-community/sqlite`).
  Cada celular tem os próprios dados; use **Ajustes → Backup** toda semana e envie o
  arquivo para o WhatsApp, Drive ou e-mail.
- Exportar CSV/backup abre o "Compartilhar" do Android (`@capacitor/filesystem` + `@capacitor/share`).
- O APK é gerado **só quando você pedir**: GitHub → Actions → "Gerar APK Android" → Run workflow.
  Ele é assinado e publicado na aba **Releases**.
- Funciona em Android 6.0 ou mais novo.

### Configuração única: chave de assinatura
O APK é sempre assinado com a **mesma chave**, para que as atualizações instalem por cima
sem apagar os dados. A chave **não fica no repositório** (ele é público). Ela é lida dos
secrets do repositório (Settings → Secrets and variables → Actions → New repository secret):

| Nome do secret       | Valor                                              |
|----------------------|----------------------------------------------------|
| `KEYSTORE_BASE64`    | conteúdo do arquivo `assinatura/keystore-base64.txt` |
| `KEYSTORE_PASSWORD`  | conteúdo do arquivo `assinatura/senha.txt`           |

⚠️ Guarde a pasta `assinatura/` em lugar seguro. Se a chave for perdida, não será possível
atualizar o app já instalado sem desinstalar (e perder os dados do celular).

### Instalar no celular
1. No celular, abra o repositório no GitHub → **Releases** → baixe `GranjaSuina-1.0.X.apk`.
2. Toque no arquivo. Se o Android pedir, permita "instalar apps desconhecidos" para o navegador.
3. Para atualizar, basta instalar o APK mais novo por cima.

---

## 📲 Instalar como aplicativo no celular (PWA)

O site é um **PWA (Progressive Web App)**: pode ser instalado na tela inicial do celular
e abre em tela cheia, sem barra de endereço — igual a um app de loja, mas sem precisar
baixar nada de terceiros.

### iPhone / iPad
1. Abra o endereço do site no **Safari** (no iPhone, só o Safari instala).
2. Toque em **Compartilhar** (quadrado com flecha para cima).
3. Toque em **Adicionar à Tela de Início**.
4. Confirme em **Adicionar**.

### Android
1. Abra o site no **Chrome**.
2. Toque nos **três pontinhos** (canto superior direito).
3. Toque em **Instalar aplicativo** / **Adicionar à tela inicial**.
4. Confirme em **Instalar**.

### Pelo próprio app
Há um botão **📲 Instalar** na barra superior. Ao tocar, o app mostra as instruções
do seu aparelho (ou abre o convite nativo do Android). Para quem entra pelo celular,
esse guia aparece automaticamente uma vez.

### O que muda depois de instalar
- Ícone do porquinho na tela inicial, abrindo direto o app.
- Tela cheia, sem barra de endereço — mais espaço para as tabelas.
- Atalhos rápidos no ícone (segurar o dedo): **Novo manejo**, **Lotes**, **Financeiro**.
- A "casca" do app fica salva no aparelho (`sw.js`), então ele abre rápido e mesmo com
  internet fraca. **Os dados continuam vindo do servidor** — para gravar registros é
  preciso conexão.
- As chamadas da Table API (`tables/…`) **nunca** são cacheadas: os dados são sempre atuais.

### Arquivos do modo app
```
manifest.json        # nome, ícones, cor do tema, atalhos, modo standalone
sw.js                # service worker: casca offline, dados sempre da rede
js/pwa.js            # convite de instalação nativo + guia para iPhone/Android
icons/app-icon-192.png / app-icon-512.png / icon.svg
```

> ⚠️ **A instalação exige um endereço público em HTTPS.** O preview do editor serve para
> testar, mas para usar no celular de verdade é preciso publicar o site (Hosted Deploy).
> Depois de publicado, o link do site é o que você abre no celular para instalar o app.

---

## 🎯 Objetivo

Substituir cadernos e planilhas soltas por um único painel operacional que responda às
perguntas do dia a dia do produtor:

- Quantos animais tenho e onde eles estão?
- Qual o ganho de peso, conversão alimentar e mortalidade de cada lote?
- Quanto está custando produzir um quilo de suíno vivo?
- Quais matrizes vão parir e quando?
- Qual o resultado financeiro do mês?
- O que está faltando ou vencendo no estoque?

---

## 🚀 Como usar

1. Abra o `index.html` (preview do projeto ou site publicado).
2. Comece pela aba **Ajustes** e digite o nome da granja e as metas (conversão alimentar, mortalidade).
3. Cadastre o primeiro **lote** e as **matrizes**.
4. Registre os **manejos** (pesagens, vacinas, mortes) — os totais do lote são atualizados automaticamente.
5. Lance receitas e despesas em **Financeiro** e os insumos em **Estoque**.
6. Acompanhe tudo no **Painel** e **Relatórios**.

Atalhos: teclas **1–9** trocam de tela; **Esc** fecha modais.

---

## 🧩 Telas e funcionalidades

### 📊 Painel
- 4 KPIs: animais alojados, peso vivo estimado, saldo dos últimos 30 dias, mortalidade acumulada.
- Gráfico de receitas × despesas (6 meses).
- Lista de **alertas** priorizada: estoque baixo, produtos vencidos/a vencer, partos
  atrasados ou iminentes, mortalidade acima da meta, lotes sem manejo recente.
- Últimos manejos e partos previstos.

### 🏠 Lotes
- Cartões por lote com fase, galpão, dias de alojamento, animais, peso médio, **GPD**
  (ganho diário), **conversão alimentar**, mortalidade e custo (acumulado e por cabeça).
- Filtro por situação (Ativo / Encerrado / Vendido) e busca livre.
- Exportação CSV.
- Botão `+ Manejo` direto no cartão do lote.

### 📝 Manejo
- Registro de pesagem, vacinação, medicação, desmame, transferência, morte, venda,
  limpeza/desinfecção, castração e identificação.
- **Atualização automática do lote** (opcional, marcada por padrão): mortes e vendas
  reduzem o plantel, pesagens atualizam o peso médio, ração e custo são somados.
- KPIs do filtro atual: registros, ração fornecida, mortes e custo.
- Filtros por tipo, lote e texto; exportação CSV.

### 🐷 Matrizes
- Cadastro de fêmeas (brinco, linhagem, ordem de parto, fase reprodutiva).
- **Previsão de parto automática** (cobertura + 115 dias).
- Destaque dos partos dos próximos 15 dias e dos atrasados, com ação rápida `Registrar parto`.
- KPIs: matrizes ativas, gestantes, leitões/parto e **desmamados/matriz/ano**.

### 🍼 Partos
- Nascidos totais, vivos, natimortos, mumificados, peso ao nascer, desmame, peso ao desmame.
- Ao registrar um parto, a matriz é atualizada (ordem de parto, último parto, leitões,
  fase e nova previsão após o desmame).
- KPIs: partos, nascidos vivos/parto, desmamados/parto e **taxa de desmame**.

### 💰 Financeiro
- Lançamentos de receita e despesa com categoria, descrição, valor, animais, peso e vínculo com lote.
- KPIs por período (30/90/365 dias ou tudo): receitas, despesas, saldo e margem.
- Gráfico de fluxo mensal e rosca de despesas por categoria.
- Tabela de **resultado por lote** (receitas − despesas vinculadas).
- Exportação CSV.

### 📦 Estoque
- Cadastro de ração, medicamentos, vacinas, higiene e equipamentos.
- Barra de nível com alerta de **estoque mínimo**, controle de **validade** e valor total.
- Movimentação rápida de entrada/saída; a entrada pode gerar **despesa automática** no financeiro.
- Filtro “só alertas” para reposição.

### 📈 Relatórios
- Consolidado do plantel (animais, peso vivo, GPD médio, conversão média, mortalidade, custo).
- Consolidado reprodutivo (matrizes, partos, leitões, desmame).
- Gráficos de animais por fase e resultado mensal (12 meses).
- Resultado financeiro de 12 meses + custo médio estimado por animal.
- Estoque consolidado com situação de cada item.
- Exportação de indicadores em CSV e **impressão / salvar em PDF**.

### ⚙️ Ajustes
- Nome da granja exibido no app.
- Metas: conversão alimentar, limite de mortalidade, dias sem manejo para alertar,
  antecedência do alerta de validade.
- Contagem de registros por tabela.
- **Backup completo em JSON** e **importação** (adiciona registros, não apaga existentes).

---

## 🧮 Indicadores calculados

| Indicador | Fórmula |
|---|---|
| Dias de alojamento | hoje − data de entrada |
| Ganho de peso diário (GPD) | (peso atual − peso entrada) ÷ dias |
| Ganho total do lote | (peso atual − peso entrada) × animais atuais |
| Conversão alimentar (CA) | ração consumida ÷ ganho total de peso |
| Mortalidade | mortes ÷ animais na entrada |
| Consumo por cabeça/dia | ração ÷ (dias × animais) |
| Custo por cabeça | custo acumulado ÷ animais atuais |
| Custo por kg ganho | custo acumulado ÷ ganho total |
| Leitões/parto | nascidos (e vivos) ÷ número de partos |
| Taxa de desmame | desmamados ÷ nascidos vivos |
| Desmamados/matriz/ano | (desmamados ÷ meses cobertos) × 12 ÷ matrizes ativas |
| Margem financeira | saldo ÷ receita |

---

## 🗂️ Estrutura do projeto

```
index.html            # página única (SPA por hash)
css/style.css         # design system, layout responsivo, modais, tabelas
js/api.js             # camada de acesso às tabelas (Table API) + cache em memória
js/ui.js              # formatação pt-BR, toasts, modais, formulários, CSV
js/analytics.js       # configurações locais + cálculo de todos os indicadores/alertas
js/views.js           # núcleo das views + Painel, Lotes e Manejo
js/views-repro.js     # Matrizes e Partos
js/views-mgmt.js      # Financeiro, Estoque, Relatórios e Ajustes
js/app.js             # roteador por hash, navegação, inicialização
```

### Rotas (hash)

`#/painel` · `#/lotes` · `#/manejo` · `#/matrizes` · `#/partos` ·
`#/financeiro` · `#/estoque` · `#/relatorios` · `#/ajustes`

---

## 💾 Armazenamento de dados

**Tabelas do projeto** (via Table API relativa `tables/<nome>`):

| Tabela | Conteúdo |
|---|---|
| `lotes` | lotes de animais, peso, ração, custo, status |
| `manejos` | pesagens, sanidade, mortes, vendas, movimentações |
| `matrizes` | plantel reprodutivo e ciclo de cada fêmea |
| `partos` | histórico de partos e desmames |
| `financeiro` | receitas e despesas (com vínculo opcional a lote) |
| `estoque` | insumos, quantidades, mínimo, validade |

**Armazenamento local do navegador** (`localStorage`, chave `granja.settings.v1`):
apenas preferências — nome da granja, metas e limites de alerta.

Não há binários, imagens ou Base64 gravados nas tabelas: os dados são apenas texto e números.

> ⚠️ **Preview × site publicado:** o ambiente de edição e o site publicado (Hosted) usam
> bancos separados. Os registros criados no preview não aparecem automaticamente no site
> publicado, e vice-versa. Escolha um ambiente como oficial para o dia a dia para evitar
> registros divergentes.

---

## ✅ Implementado

- [x] Painel com KPIs, gráficos e central de alertas
- [x] CRUD completo de lotes, manejos, matrizes, partos, financeiro e estoque
- [x] Atualização automática dos totais do lote ao registrar manejo
- [x] Previsão de parto automática (115 dias) e atualização da matriz no parto
- [x] Indicadores zootécnicos (GPD, CA, mortalidade, custo/kg, desmame)
- [x] Movimentação de estoque com geração de despesa
- [x] Exportação CSV em todas as listas + backup/restauração JSON
- [x] Layout responsivo (desktop, tablet e celular) e navegação off-canvas
- [x] Impressão / PDF dos relatórios

## 🔜 Próximos passos sugeridos

- **Multi-usuário com acesso restrito** (Hosted Access Rules) — hoje o app é aberto.
- **Curva de crescimento** por linhagem, comparando peso real × esperado.
- **Projeção de fluxo de caixa** com base nos lotes a vencer.
- **Rateio automático de ração por lote** a partir dos lançamentos de estoque.
- **Ficha individual da matriz** (histórico de partos por fêmea em uma só tela).
- **Alerta de venda** quando o lote atingir o peso-alvo.
- **Custo por fase** e ponto de equilíbrio (R$/kg vivo).
- Publicar no Hosted Deploy para uso em campo, com os dados no banco D1 ao vivo.

---

## 🎨 Notas de design

- Paleta verde (campo) + âmbar (atenção) + vermelho (risco); cartões suaves e sombras leves.
- Tipografia Inter, números tabulares nos valores financeiros.
- Alvos de toque ≥ 40 px, tabelas com rolagem horizontal contida, modais em folha
  inferior no celular.
- Nenhum código sensível ou autenticação improvisada no cliente.
