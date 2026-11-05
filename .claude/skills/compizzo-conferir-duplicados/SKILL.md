---
name: compizzo-conferir-duplicados
description: Checa duplicidade antes de lançar qualquer dado no Compizzo Admin (RDO, retirada, caixinha, calendário, notas, faltas). Use SEMPRE antes de gravar informação nova vinda do chat.
---
# Anti-duplicidade (regra permanente)

Chaves por coleção — compare **antes** de inserir e mostre "novo / já existia / atualizado":
- **RDO**: `obra + data` (se existir, mescla campos vazios; nunca cria 2º RDO do mesmo dia).
- **Calendário/agenda**: `obra|data|turno|texto-normalizado`. Agenda do dia **substitui** programação semanal e Meta 4 (`substituidoPor`), sem apagar.
- **Retirada**: `data + material + qtd + destino` (match flexível por material/nomeOriginal).
- **Caixinha**: chave de acesso (44 dígitos; NFS-e 50) → fornecedor+NF+série → ID Pix → `data+valor+fornecedor+descrição`. Mesmo valor em dias diferentes NÃO é duplicado (ex.: álcool R$ 90).
- **NFS-e emitida**: número. **Falta**: `funcionário|data`. **Foto/anexo**: nome+tamanho.
Todo script de ingestão deve ser **idempotente**: rodar 2× e a 2ª imprimir `novos 0`. Depois rode `python3 -I tools/check_all.py`.
