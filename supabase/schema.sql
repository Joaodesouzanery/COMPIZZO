-- Compizzo Admin — esquema para migrar a base local (assets/data.json) para o Supabase.
create table obras (id uuid primary key default gen_random_uuid(), nome text not null, status text default 'Em andamento');
create table materiais (id uuid primary key default gen_random_uuid(), nome text not null, codigo text, unidade text, qtd numeric not null default 0, critica numeric not null default 5, ultimo_pedido date, nota text);
create table retiradas (id uuid primary key default gen_random_uuid(), data date not null default current_date, material_id uuid references materiais, obra_id uuid references obras, qtd numeric not null, faltou numeric);
create table ajustes (id uuid primary key default gen_random_uuid(), data date default current_date, material_id uuid references materiais, de numeric, para numeric);
create table fornecedores (id uuid primary key default gen_random_uuid(), nome text unique not null);
create table cotacoes (id uuid primary key default gen_random_uuid(), material text not null, fornecedor_id uuid references fornecedores, preco numeric);
create table compras (id uuid primary key default gen_random_uuid(), fornecedor text not null, data date, total numeric not null, itens jsonb default '[]');
create table boletos (id uuid primary key default gen_random_uuid(), compra_id uuid references compras, fornecedor text, nf text, emissao date, total_nf numeric, obs text, arquivos jsonb default '[]');
create table parcelas (id uuid primary key default gen_random_uuid(), boleto_id uuid references boletos on delete cascade, n int, vencimento date, valor numeric, pago boolean default false);
create table funcionarios (id uuid primary key default gen_random_uuid(), nome text not null, obra_id uuid references obras, funcao text);
create table avaliacoes (id uuid primary key default gen_random_uuid(), func_id uuid references funcionarios, obra_id uuid references obras, periodo text, faltas int, atrasos int, notas jsonb, media numeric, nota numeric, classificacao text);
-- Storage: criar bucket privado "boletos" para PDFs/imagens.
-- RLS: habilitar em todas as tabelas e liberar apenas para usuários autenticados.
do $$ declare t text; begin foreach t in array array['obras','materiais','retiradas','ajustes','fornecedores','cotacoes','compras','boletos','parcelas','funcionarios','avaliacoes'] loop
 execute format('alter table %I enable row level security', t);
 execute format('create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t); end loop; end $$;

-- Fase 2: produção, RDO, cadastros e calendário
create table cargos (id uuid primary key default gen_random_uuid(), nome text not null, taxa_hora numeric, salario numeric, he_sab numeric, he_dom numeric);
create table equipes (id uuid primary key default gen_random_uuid(), nome text not null, lider text, obra_id uuid references obras);
alter table obras add column bac numeric, add column inicio date, add column preco_piso numeric, add column modo_receita text default 'preco', add column fase_preco jsonb default '{}';
alter table funcionarios add column matricula text, add column setor text, add column local text, add column admissao date, add column contrato text, add column regime text, add column equipe_id uuid references equipes, add column status text default 'Ativo', add column taxa_hora numeric, add column salario numeric, add column he_sab numeric, add column he_dom numeric;
create table fases (id uuid primary key default gen_random_uuid(), nome text not null, un text, peso numeric, ativa boolean default true);
create table metas (id uuid primary key default gen_random_uuid(), obra_id uuid references obras, inicio date, fim date, qtds jsonb);
create table rdos (id uuid primary key default gen_random_uuid(), obra_id uuid references obras, data date, status text, conteudo jsonb);
create table calendario (id uuid primary key default gen_random_uuid(), obra_id uuid references obras, data date, tipo text, texto text, equipe text[], cond text, fonte text);
create table agenda (id uuid primary key default gen_random_uuid(), data date, equipe text, encarregado text, membros text[], texto text);
do $$ declare t text; begin foreach t in array array['cargos','equipes','fases','metas','rdos','calendario','agenda'] loop
 execute format('alter table %I enable row level security', t);
 execute format('create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t); end loop; end $$;
