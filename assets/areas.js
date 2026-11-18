/* Caixinha › Classificação mensal: quanto foi gasto em cada área e em cada contrato/obra. */
'use strict';
const AREAS = ['Combustível e frota', 'Alimentação', 'Deslocamento (Uber/99/passagem)', 'Diárias e mão de obra', 'EPI e uniformes', 'Material de consumo e limpeza', 'Ferramentas e equipamentos', 'Materiais de obra', 'Alojamento', 'Administrativo e escritório', 'Outros'];
const AREA_REGRAS = [
  [/combust|abasteci|gasolina|etanol|posto/, 'Combustível e frota'],
  [/almoco|lanche|marmita|alimenta|refei|mortadela|pao fran/, 'Alimentação'],
  [/uber|99pop|99 tecn|passagem|corrida|deslocamento/, 'Deslocamento (Uber/99/passagem)'],
  [/diaria/, 'Diárias e mão de obra'],
  [/\bbota|\bepi\b|luva|capacete|oculos|mascara|uniforme|camisa/, 'EPI e uniformes'],
  [/vassour|saco.{0,6}lixo|pano|limpeza|alcool|lixeira|detergente/, 'Material de consumo e limpeza'],
  [/porca|parafuso|ferrament|lixadeira|rodo|espatula|trena|extens/, 'Ferramentas e equipamentos'],
  [/pu flex|selante|massa plastica|tinta|primer|rolo|fita|sika|graunt|lona|thinner|disco de lixa|trincha|epoxi/, 'Materiais de obra'],
  [/alojamento|aluguel|gas do|botijao/, 'Alojamento'],
  [/escritorio|plotagem|papel|impress/, 'Administrativo e escritório']];
function cxArea(c) {
  if (c.area) return c.area;
  const t = norm([c.tipo, c.fornecedor, c.descricao].join(' '));
  if (c.tipo === 'Combustível' || c.veiculo) return 'Combustível e frota';
  const r = AREA_REGRAS.find(([re]) => re.test(t)); return r ? r[1] : 'Outros';
}
const unidadeDe = id => { if (!id || id === 'estoque') return 'Geral / frota / estoque'; const ct = (S.contratos || []).find(c => c.ativo !== false && obraFamilia(c.obraId).includes(id)); if (ct) return short(ct.nome); const o = getObra(id), top = o && o.paiId ? getObra(o.paiId) : o; return top ? short(top.nome) : 'Geral / frota / estoque'; };
function areasMatriz(per) {
  const cel = {}, cols = new Set(), lan = S.caixinha.filter(c => resIn(c.data, per));
  lan.forEach(c => { const v = cxVal(c), os = (c.obras && c.obras.length) ? c.obras : [{ obraId: '', valor: v }], a = cxArea(c);
    os.forEach(o => { const col = unidadeDe(o.obraId), val = o.valor ?? v / os.length; (cel[a] = cel[a] || {})[col] = ((cel[a] || {})[col] || 0) + val; cols.add(col); }); });
  const cl = [...cols].sort((x, y) => (x.startsWith('Geral') ? 1 : y.startsWith('Geral') ? -1 : x.localeCompare(y)));
  return { cel, cols: cl, lan };
}
function areaMes() { const ms = [...new Set(S.caixinha.map(c => c.data.slice(0, 7)))].sort(); return tab.am && ms.includes(tab.am) ? tab.am : ms[ms.length - 1]; }
function areasCard() {
  const ms = [...new Set(S.caixinha.map(c => c.data.slice(0, 7)))].sort(), m = areaMes(); if (!m) return '';
  const per = { ini: m + '-01', fim: m + '-31', rot: MESES[+m.slice(5) - 1] }, X = areasMatriz(per), tot = Object.values(X.cel).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0) || 1;
  const rows = AREAS.filter(a => X.cel[a]).map(a => { const sum = Object.values(X.cel[a]).reduce((x, y) => x + y, 0); return `<tr><td><b>${esc(a)}</b></td>${X.cols.map(c => `<td class="n">${X.cel[a][c] ? brl(X.cel[a][c]) : '—'}</td>`).join('')}<td class="n"><b>${brl(sum)}</b></td><td class="n">${pc1r(sum / tot * 100)}%</td></tr>`; }).join('');
  const colT = X.cols.map(c => AREAS.reduce((a, ar) => a + ((X.cel[ar] || {})[c] || 0), 0));
  const revisar = X.lan.filter(c => cxArea(c) === 'Outros' || c.area).slice(0, 12);
  return `<div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Classificação do mês: área × contrato</h2><div class="row"><select data-am="1">${ms.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${MESES[+x.slice(5) - 1]} ${x.slice(0, 4)}</option>`).join('')}</select><span class="mono">${brl(tot === 1 && !Object.keys(X.cel).length ? 0 : tot)} no mês</span></div></div>
  <table class="zebra"><tr><th>Área</th>${X.cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}<th class="n">Total</th><th class="n">% do mês</th></tr>${rows}<tr style="font-weight:600"><td>Total</td>${colT.map(v => `<td class="n">${brl(v)}</td>`).join('')}<td class="n">${brl(tot === 1 && !Object.keys(X.cel).length ? 0 : tot)}</td><td></td></tr></table>
  <details style="margin-top:8px"><summary class="sub" style="cursor:pointer">Reclassificar lançamentos (${X.lan.length} no mês)</summary><table class="zebra" style="margin-top:6px"><tr><th>Data</th><th>Lançamento</th><th class="n">Valor</th><th>Área</th></tr>${X.lan.slice().sort((a, b) => b.data.localeCompare(a.data)).map(c => `<tr><td>${fdate(c.data)}</td><td>${esc(c.fornecedor)} — ${esc(c.descricao)}</td><td class="n">${brl(cxVal(c))}</td><td><select data-area="${c.id}">${AREAS.map(a => `<option ${cxArea(c) === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></td></tr>`).join('')}</table></details>
  <p class="sub" style="margin:8px 0 0">A área é sugerida pelo texto do lançamento; você pode corrigir. Compras sem obra entram em "Geral / frota / estoque" e viram custo indireto no DRE.</p></div>`;
}
const _cxa = CAD.cx; CAD.cx = function () { return areasCard() + _cxa(); };
EXT.change.push(async e => { const t = e.target; if (!t.dataset) return false; if (t.dataset.am) { tab.am = t.value; render(); return true; } if (t.dataset.area) { S.caixinha.find(c => c.id === t.dataset.area).area = t.value; save(); render(); return true; } return false; });
