---
name: compizzo-conferir-estoque
description: Confere retiradas e entradas de estoque do Compizzo Admin (destino, material, embalagens, saldo, faltou). Use ao receber "RETIRADA DE MATERIAL DO ESTOQUE" ou compra para estoque.
---
# Conferir estoque

- Formato: `RETIRADA DE MATERIAL DO ESTOQUE` / Data / Destino / Materiais retirados / Responsável. Destino "A informar" → `pendente: destino`.
- Casar o material com `matchMat`; empate ou palavra solta ("rolos brancos") → `pendente: material`, não adivinhar. Zeros à esquerda e plural são normalizados ("04 rolos de 09 cm" = Rolo 9CM).
- Embalagens: Fita 24 mm cx=48 un; Fita 48 mm cx=24 un; Desempenadeira cx=6; Luva pacote=12 pares; filtro de máscara cx=6 (conferir unidade do estoque antes de converter).
- Saldo insuficiente: baixa o que há e registra `faltou` (contagem física pendente). Saldo negativo é ERRO.
- Entrada (compra para estoque) vai em `entradas[]` e soma em `materiais[].qtd`.
- Rode `tools/check_all.py` (seção estoque).
