---
name: compizzo-conferir-contratos
description: Confere contratos, medições e NFS-e do Compizzo Admin (5 contratos ativos, MO+material=total, NFS-e × contrato, retenções). Use ao receber contrato, medição, NFS-e ou ao mexer em contratos/resultado.
---
# Conferir contratos e faturamento

Fonte da verdade: `assets/data.json` (`contratos`, `notasEmitidas`, `metaMensal`). **Existem exatamente 5 contratos ativos**: Brasal, Horizon (Emplavi), Parque Nacional, Supera 613 Sul, SQS 314. Parque Esplanada e Parque Alvorada são sub-obras de Parque Cidade (`paiId`), **não** contratos.

1. Rode `python3 -I tools/check_all.py` e leia a seção `contratos` e `notas`.
2. Para cada contrato: `mo + mat == total` (ERRO se não), soma dos itens de MO × `mo` declarado (ALERTA com diferença em R$), preço unitário × meta mensal.
3. Para cada NFS-e: `bruto − retFederal − iss == liquido`; nº único; notas **substituídas** (campo `substitui`) não entram na soma; ligar à obra pelo tomador (CNPJ) e ao contrato só se for um dos 5.
4. Retenção real observada ≈ 18,65% (federais 16,65% + ISS 2%) × premissa da meta mensal (35%): mostrar a diferença, não decidir sozinho.
5. Nunca invente valores de contrato: campo vazio = "informar" e entra em `perguntasAbertas`.
Saída: tabela contrato × (total, MO, material, faturado, saldo a faturar) e lista de divergências com valores.
