# Compizzo Admin
Painel estático (sem build) para controle de obras: estoque central com retiradas por obra, compras/orçamentos, boletos (conciliação + anexos) e avaliação quinzenal de mão de obra.

- Base de dados: `assets/data.json` (versionada). Alterações feitas no site ficam no navegador (localStorage/IndexedDB); "Exportar dados" baixa o JSON.
- Para publicar uma nova base, aumente `version` em `data.json` (descarta o cache local).
- `supabase/schema.sql`: esquema para migrar a base ao Supabase (próximo passo).
- Deploy: Vercel, projeto estático apontando para a raiz.
