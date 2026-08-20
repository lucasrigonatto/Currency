# Finanças — controle pessoal

Aplicativo local de finanças pessoais: importe faturas (CSV, Excel ou PDF), revise lançamentos, acompanhe parcelas e projete os próximos 12 meses.

Os dados ficam no **IndexedDB deste navegador**. Nada é enviado a bancos ou serviços de IA.

## Como rodar

```bash
yarn install
yarn start
```

Abra [http://localhost:3000](http://localhost:3000).

## Uso rápido

1. Cadastre o cartão em **Cartões** (opcional — já existe um Nubank).
2. Em **Importar fatura**, envie o CSV/XLSX/PDF.
3. Revise duplicatas, parcelas e categorias.
4. Confirme. O painel atualiza na hora.

Atalhos: `n` nova transação, `/` buscar, `i` importar.

CSV do Nubank (`date,title,amount`) é reconhecido automaticamente. Parcelas no formato `Parcela 3/10` ou `03/10` viram um grupo; só a parcela do mês conta como despesa daquele mês.

## Exportar

Em **Dados e exportação**: CSV, Excel ou JSON completo.

## Testes

```bash
CI=true yarn test
```

## Arquitetura

SPA React (Create React App) + Dexie/IndexedDB. Sem backend e sem autenticação neste MVP — é um livro-caixa pessoal.

Regras de categoria são determinísticas (texto contém padrão). Correções podem virar regras novas.

PDF é extraído no próprio navegador com PDF.js (worker local). Layouts de bancos variam; linhas não reconhecidas aparecem na revisão e nunca são descartadas em silêncio.
