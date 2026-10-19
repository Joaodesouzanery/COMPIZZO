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
