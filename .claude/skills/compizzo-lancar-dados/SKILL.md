---
name: compizzo-lancar-dados
description: Fluxo para lançar informações novas no Compizzo Admin (ler, checar duplicados, script idempotente, testar, publicar). Use sempre que o usuário mandar dados novos pelo chat.
---
# Lançar dados no Compizzo Admin

1. **Ler** o material (texto, imagens, PDFs com `pdftotext`) e separar por coleção: retiradas, caixinha, RDO/agenda, notas, contratos, pessoas.
2. **Conferir** com as skills `compizzo-conferir-*` e `python3 -I tools/check_all.py`. Divergência: mostrar ao usuário, não decidir sozinho.
3. **Gravar** com script Python em scratchpad (`python3 -I`), idempotente (chaves), incrementando `version` em `assets/data.json`. Rodar 2×: a 2ª deve imprimir 0 novos.
4. **Testar** com Playwright (`/opt/node-tools/node_modules/playwright`, servidor `python3 -m http.server 8123`): sem erros de console, telas afetadas, claro e escuro.
5. **Publicar**: `git add -A && git commit` (com trailers de atribuição), `git push -u origin claude/loving-ptolemy-7irt84`, `mcp__Vercel__create_deployment` (team_yqBLMg8jWVHIXVYD3hXCz7ov, projeto compizzoadmin, target production, gitSource org Joaodesouzanery/COMPIZZO + sha) e `get_deployment` até READY.
6. **Responder** em português: o que foi lançado, divergências, pendências (perguntas em aberto) e o lembrete da Caixinha.
Limites a declarar: sem Supabase (o que o usuário digita no site fica só no navegador dele); link atrás do login da Vercel; receita é estimativa; rendimento por pessoa é média da equipe.
