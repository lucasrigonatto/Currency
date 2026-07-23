# Auditoria Financeira Nubank

Dashboard React com auditoria completa de 3 faturas Nubank (CSV): classificação de gastos, rankings, assinaturas, parcelamentos, gráficos, score e plano de economia.

## Como rodar

```bash
yarn install
yarn analyze   # regenera src/data/analysis.json a partir dos CSVs em public/data/raw
yarn start
```

## Testes

```bash
CI=true yarn test
```

## Dados

CSVs em `public/data/raw/`. A análise consolidada fica em `src/data/analysis.json`.
