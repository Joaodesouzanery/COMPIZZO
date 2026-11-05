#!/usr/bin/env python3
"""Conferência read-only de assets/data.json. Uso: python3 -I tools/check_all.py [caminho/data.json]
Imprime OK / ALERTA (revisar) / ERRO (corrigir antes de publicar). Sai com 1 se houver ERRO."""
import json, sys, re, unicodedata, collections
P = sys.argv[1] if len(sys.argv) > 1 else 'assets/data.json'
d = json.load(open(P)); res = []
def nz(s): return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode())).strip()
def add(nivel, area, msg): res.append((nivel, area, msg))
brl = lambda v: ('R$ {:,.2f}'.format(v)).replace(',', 'X').replace('.', ',').replace('X', '.')

# contratos
ct = [c for c in d['contratos'] if c.get('ativo', True)]
add('OK' if len(ct) == 5 else 'ERRO', 'contratos', f'{len(ct)} contratos ativos (esperado: 5 — Brasal, Horizon, Parque Nacional, Supera, SQS 314)')
for c in ct:
    if abs(c['mo'] + c['mat'] - c['total']) > 0.02: add('ERRO', 'contratos', f"{c['nome']}: MO + material {brl(c['mo']+c['mat'])} ≠ total {brl(c['total'])}")
    if c.get('somaMO') and abs(c['somaMO'] - c['mo']) > 0.02: add('ALERTA', 'contratos', f"{c['nome']}: itens de MO somam {brl(c['somaMO'])} ≠ declarado {brl(c['mo'])}")
nomes_ct = {c['obraId'] for c in ct}
# notas emitidas
subst = {n.get('substitui') for n in d.get('notasEmitidas', []) if n.get('substitui')}
for n in d.get('notasEmitidas', []):
    if abs(n['bruto'] - n['retFederal'] - n['iss'] - n['liquido']) > 0.02: add('ERRO', 'notas', f"NFS-e {n['numero']}: bruto − retenções ≠ líquido")
    if n['numero'] in subst: add('ALERTA', 'notas', f"NFS-e {n['numero']} foi substituída por outra — não somar")
    if n.get('contratoId') and n['contratoId'] not in {c['id'] for c in ct}: add('ERRO', 'notas', f"NFS-e {n['numero']} aponta para contrato inexistente {n['contratoId']}")
nums = [n['numero'] for n in d.get('notasEmitidas', [])]
if len(nums) != len(set(nums)): add('ERRO', 'notas', 'nº de NFS-e repetido')
# obras
ids = {o['id'] for o in d['obras']}
for o in d['obras']:
    if o.get('paiId') and o['paiId'] not in ids: add('ERRO', 'obras', f"{o['nome']}: paiId inválido")
# caixinha
ch = collections.Counter(c['chave'] for c in d['caixinha'])
for k, v in ch.items():
    if v > 1: add('ERRO', 'caixinha', f'chave duplicada: {k}')
tx = collections.Counter((c['data'], round((c.get('valorPago') or c.get('valorDoc') or c.get('valorTexto') or 0), 2), nz(c['fornecedor'])) for c in d['caixinha'])
for k, v in tx.items():
    if v > 1: add('ALERTA', 'caixinha', f'mesmo dia+valor+fornecedor {k}: possível duplicado')
for c in d['caixinha']:
    if c.get('valorDoc') is not None and c.get('valorTexto') is not None and abs(c['valorDoc'] - c['valorTexto']) > 0.02: add('ALERTA', 'caixinha', f"{c['data']} {c['fornecedor']}: valor do texto {c['valorTexto']} ≠ documento {c['valorDoc']}")
    if c.get('dataDoc') and c['dataDoc'] != c['data']: add('ALERTA', 'caixinha', f"{c['data']} {c['fornecedor']}: documento emitido em {c['dataDoc']}")
    if c.get('docChave') and len(re.sub(r'\D', '', c['docChave'])) != (50 if c.get('docTipo') == 'NFS-e' else 44): add('ERRO', 'caixinha', f"{c['fornecedor']}: chave de acesso sem 44 dígitos")
tot = sum((c.get('valorPago') or c.get('valorDoc') or c.get('valorTexto') or 0) for c in d['caixinha'])
add('OK', 'caixinha', f"{len(d['caixinha'])} lançamentos, total {brl(tot)}; sem documento: {sum(1 for c in d['caixinha'] if not c.get('docNumero') and not c.get('docChave') and not c.get('pixId') and not c.get('anexos'))}")
# estoque
M = {m['id']: m for m in d['materiais']}
for m in d['materiais']:
    if m['qtd'] < 0: add('ERRO', 'estoque', f"{m['nome']}: saldo negativo")
rk = collections.Counter((r['data'], r.get('materialId') or r.get('nomeOriginal'), r['qtd'], nz(r.get('destinoTxt') or r.get('obraId') or '')) for r in d['retiradas'])
for k, v in rk.items():
    if v > 1: add('ALERTA', 'estoque', f'retirada repetida {k}')
for r in d['retiradas']:
    if r.get('pendente'): add('ALERTA', 'estoque', f"{r['data']} {r.get('nomeOriginal') or r.get('materialId')}: pendência ({r['pendente']})")
    if r.get('faltou'): add('ALERTA', 'estoque', f"{r['data']} {r.get('nomeOriginal') or r.get('materialId')}: faltaram {r['faltou']} no estoque (contagem física)")
# RDOs e pessoas
rk = collections.Counter((r['obraId'], r['data']) for r in d['rdos'] if r.get('status') == 'salvo' and r.get('obraId'))
for k, v in rk.items():
    if v > 1: add('ALERTA', 'rdo', f'mais de um RDO salvo em {k} (ok se forem RDOs distintos do PDF, ex.: nº 11 e 12 do Brasal em 15/07)')
F = {nz(f['nome']) for f in d['funcionarios']} | {nz(a) for f in d['funcionarios'] for a in f.get('aliases', [])}
fora = sorted({n for r in d['rdos'] for n in (r.get('maoObra') or []) if nz(n) not in F})
if fora: add('ALERTA', 'pessoas', 'nomes nos RDOs fora do cadastro: ' + ', '.join(fora))
sem = [f['nome'] for f in d['funcionarios'] if f.get('custoDiaFixo') is None and not f.get('salario') and not f.get('diaria') and not f.get('taxaHora')]
if sem: add('ALERTA', 'pessoas', 'sem custo/dia cadastrado: ' + ', '.join(sem))
nom2 = sum(1 for r in d['rdos'] if r.get('status') == 'salvo' and not sum((l.get('qtd') or 0) for l in r.get('fases', [])))
add('ALERTA' if nom2 else 'OK', 'rdo', f'{nom2} RDO(s) salvos sem m² por fase')
# calendário
ck = collections.Counter(c.get('chave') for c in d['calendario'] if c.get('chave'))
for k, v in ck.items():
    if v > 1: add('ERRO', 'calendario', f'chave duplicada {k}')
dia = collections.defaultdict(lambda: collections.defaultdict(set))
for c in d['calendario']:
    if c.get('substituidoPor') or c.get('parado'): continue
    for n in c.get('equipe', []): dia[c['data']][nz(n)].add(c['obraId'])
for dt, m in sorted(dia.items()):
    for n, o in m.items():
        if len(o) > 1: add('ALERTA', 'calendario', f'{dt}: {n} em mais de uma obra ({", ".join(sorted(o))})')
niv = {'ERRO': 0, 'ALERTA': 1, 'OK': 2}
for n, a, m in sorted(res, key=lambda x: (niv[x[0]], x[1])): print(f'[{n}] {a}: {m}')
print(f"\nResumo: {sum(1 for r in res if r[0]=='ERRO')} erro(s), {sum(1 for r in res if r[0]=='ALERTA')} alerta(s)")
sys.exit(1 if any(r[0] == 'ERRO' for r in res) else 0)
