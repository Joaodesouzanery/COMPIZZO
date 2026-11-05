---
name: compizzo-conferir-pessoas-rdo
description: Confere RDOs, presença, custo/dia e programação semanal do Compizzo Admin (nomes × cadastro, conflitos de alocação, RDO sem m²). Use ao receber RDO, agenda do dia, programação semanal ou dados de funcionário.
---
# Conferir pessoas, RDO e programação

- Nomes do RDO/agenda → cadastro (`findFunc`, aliases; Thiago=Tiago=Thiaguinho; Mateus=Matheus). Nome fora do cadastro = ALERTA.
- Custo/dia: `custoDiaFixo` (já com encargos) → diária → taxa×jornada → salário÷22 (×encargos). Sem base: "informar"; estimativa só pela média do mesmo cargo e marcada "est.".
- RDO: um por obra+dia; precisa m² por fase, presentes e HH; sem m² não gera receita nem produtividade.
- Programação: a **agenda do dia substitui a semanal**; listar mudanças de equipe, pessoa em 2 obras no mesmo dia, equipe em obra parada ("atividade a definir"), atividade em feriado, dependências (liberação do campo, projeto impresso).
- Aderência = dias com atividade prevista que têm RDO salvo.
- Rode `tools/check_all.py` (seções pessoas, rdo, calendario).
