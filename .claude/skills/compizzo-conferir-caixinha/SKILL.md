---
name: compizzo-conferir-caixinha
description: Confere lançamentos da Caixinha/Linha direta (compras diretas, combustível, Pix, cartão) contra NF/cupom/comprovante. Use ao receber texto ou foto de compra direta.
---
# Conferir Caixinha

1. Ler a imagem: fornecedor, CNPJ, nº/série, **chave de acesso (44 dígitos; NFS-e 50)**, data de emissão, valor total e pago, forma de pagamento, itens.
2. Comparar **valor do texto × valor do documento** e **data do texto × data de emissão** (ex.: NF emitida um dia depois) — divergência vira ALERTA, nunca corrigir em silêncio.
3. Destino: obra(s) com rateio (`obras[]`), `estoque` (só se o usuário disser), frota (`veiculo`). Compra no cartão: `formaPgto`, `vencimento` da fatura.
4. Sem foto/NF: registrar `docTipo: "Sem documento"` e cobrar.
5. Checar duplicidade (skill compizzo-conferir-duplicados) e totais: `tools/check_all.py` mostra total e nº sem documento.
6. Terminar toda resposta lembrando o usuário que ele disse "VOU ADICIONAR MAIS" até ele confirmar o fim.
