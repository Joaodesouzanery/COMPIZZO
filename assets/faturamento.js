/* Contratos: faturamento (NFS-e) × contrato, recebimento, saldo a faturar, documentos e edição do contrato. */
'use strict';
const ctAtivos = () => (S.contratos || []).filter(c => c.ativo !== false);
const notasDe = c => (S.notasEmitidas || []).filter(n => n.contratoId === c.id && n.status !== 'cancelada');
const rec = n => (n.recebimento && n.recebimento.status === 'recebido');
function ctFat(c) {
  const ns = notasDe(c), s = k => ns.reduce((a, n) => a + (n[k] || 0), 0), bruto = s('bruto'), liq = s('liquido'), recebido = ns.filter(rec).reduce((a, n) => a + n.liquido, 0);
  return { ns, bruto, liq, ret: s('retFederal') + s('iss'), recebido, aReceber: liq - recebido, saldo: Math.max(0, (c.mo || 0) - bruto), pct: c.mo ? bruto / c.mo * 100 : 0, ult: ns.map(n => n.data).sort().pop() };
}
function fatCard() {
  const cs = ctAtivos(), F = cs.map(c => ({ c, f: ctFat(c) })), T = k => F.reduce((a, x) => a + x.f[k], 0), mo = cs.reduce((a, c) => a + (c.mo || 0), 0);
  const fora = (S.notasEmitidas || []).filter(n => !n.contratoId && n.status !== 'cancelada'), foraV = fora.reduce((a, n) => a + n.bruto, 0);
  const k = (t, v, sub) => `<div class="card kpi" style="margin:0;padding:16px"><div class="mono">${t}</div><div class="v" style="font-size:24px">${v}</div><small class="sub">${sub}</small></div>`;
  const rows = F.map(({ c, f }) => `<tr class="clk" data-ct="${c.id}"><td><i class="sw" style="border-color:${obraCor(c.obraId)};background:${obraCor(c.obraId)}"></i><b>${esc(short(c.nome))}</b><small>${f.ns.length} medição(ões)${f.ult ? ' · última ' + fdate(f.ult) : ''}</small></td><td class="n">${brl(c.mo)}</td><td class="n"><b>${brl(f.bruto)}</b></td><td style="min-width:150px">${pc1r(f.pct)}%${ticksBar(f.pct, 'var(--grn)', 24)}</td><td class="n">${brl(f.ret)}</td><td class="n">${brl(f.liq)}</td><td class="n grn">${brl(f.recebido)}</td><td class="n ${f.aReceber ? 'amb' : ''}">${brl(f.aReceber)}</td><td class="n"><b>${brl(f.saldo)}</b></td></tr>`).join('');
  const tot = `<tr style="font-weight:600"><td>Total (5 contratos)</td><td class="n">${brl(mo)}</td><td class="n">${brl(T('bruto'))}</td><td>${pc1r(mo ? T('bruto') / mo * 100 : 0)}%</td><td class="n">${brl(T('ret'))}</td><td class="n">${brl(T('liq'))}</td><td class="n">${brl(T('recebido'))}</td><td class="n">${brl(T('aReceber'))}</td><td class="n">${brl(T('saldo'))}</td></tr>`;
  const notas = (S.notasEmitidas || []).filter(n => n.status !== 'cancelada').slice().sort((a, b) => b.data.localeCompare(a.data));
  const med = notas.map(n => { const c = S.contratos.find(x => x.id === n.contratoId); return `<tr><td>${esc(n.numero)}${n.substitui ? `<small>substitui ${esc(n.substitui)}</small>` : ''}</td><td>${fdate(n.data)}</td><td>${c ? esc(short(c.nome)) : `<span class="pill">${esc(short(obraNome(n.obraId)))} · fora da carteira</span>`}</td><td>${esc(n.descricao)}</td><td class="n">${brl(n.bruto)}</td><td class="n">${brl(n.liquido)}</td><td><select data-nrc="${n.id}"><option value="a confirmar" ${rec(n) ? '' : 'selected'}>a confirmar</option><option value="recebido" ${rec(n) ? 'selected' : ''}>recebido</option></select> <input type="date" data-nrd="${n.id}" value="${esc((n.recebimento || {}).data || '')}" style="width:140px"></td></tr>`; }).join('');
  return `<div class="grid g4" style="margin-bottom:14px">${k('Faturado (NFS-e) — 5 contratos', brl(T('bruto')), `${pc1r(mo ? T('bruto') / mo * 100 : 0)}% da MO contratada (${brl(mo)})`)}${k('Saldo a faturar', brl(T('saldo')), 'MO contratada − faturado')}${k('Líquido a receber', brl(T('liq')), `após retenções de ${brl(T('ret'))}`)}${k('Recebido (confirmado)', brl(T('recebido')), T('aReceber') ? `${brl(T('aReceber'))} ainda a confirmar` : 'tudo confirmado')}</div>
  <div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Faturamento × contrato</h2><span class="mono">mão de obra · NFS-e emitidas</span></div><table class="zebra"><tr><th>Contrato</th><th class="n">MO contratada</th><th class="n">Faturado</th><th>% da MO</th><th class="n">Retenções</th><th class="n">Líquido</th><th class="n">Recebido</th><th class="n">A receber</th><th class="n">Saldo a faturar</th></tr>${rows}${tot}</table>
  <p class="sub" style="margin:8px 0 0">Material é faturamento direto do cliente e fica fora das NFS-e. ${fora.length ? `Fora da carteira: ${brl(foraV)} em ${fora.length} nota(s) (Parque Cidade).` : ''} "Recebido" só muda quando você confirma abaixo.</p></div>
  <div class="card tw" style="margin-bottom:14px"><h2>Medições e recebimento</h2><table class="zebra"><tr><th>NFS-e</th><th>Emissão</th><th>Contrato</th><th>Descrição</th><th class="n">Bruto</th><th class="n">Líquido</th><th>Recebimento</th></tr>${med}</table></div>`;
}
function ctMedicoes(c) {
  const f = ctFat(c);
  return `<div class="card tw"><div class="row sp"><h2>Medições (NFS-e) deste contrato</h2><span class="mono">faturado ${brl(f.bruto)} · ${pc1r(f.pct)}% da MO · saldo ${brl(f.saldo)}</span></div>${ticksBar(f.pct, 'var(--grn)', 40)}<table class="zebra"><tr><th>NFS-e</th><th>Emissão</th><th>Descrição</th><th class="n">Bruto</th><th class="n">% da MO</th><th class="n">Líquido</th><th>Recebimento</th></tr>${f.ns.slice().sort((a, b) => a.data.localeCompare(b.data)).map(n => `<tr><td>${esc(n.numero)}${n.arquivo ? ` · <a href="${esc(n.arquivo.id.replace('url:', ''))}" target="_blank">PDF</a>` : ''}</td><td>${fdate(n.data)}</td><td>${esc(n.descricao)}</td><td class="n">${brl(n.bruto)}</td><td class="n">${c.mo ? pc1r(n.bruto / c.mo * 100) + '%' : '—'}</td><td class="n">${brl(n.liquido)}</td><td>${rec(n) ? '<span class="pill g">recebido</span>' : '<span class="pill a">a confirmar</span>'}</td></tr>`).join('') || '<tr><td colspan="7">Nenhuma NFS-e deste contrato.</td></tr>'}</table></div>`;
}
function ctDocs(c) {
  const ds = c.documentos || [];
  return `<div class="card"><div class="row sp"><h2>Documentos do contrato</h2><div class="row"><button class="btn sm" data-ctedit="${c.id}">Editar dados do contrato</button><button class="btn sm pri" data-ctdocadd="${c.id}">Adicionar documento</button></div></div>
  ${ds.length ? `<div class="list" style="margin-top:6px">${ds.map((d, i) => `<div class="it"><div class="t"><b>${esc(d.nome)}</b><small>${esc(d.tipo || 'Contrato')}${d.data ? ' · ' + fdate(d.data) : ''}${d.local ? ' · salvo só neste navegador' : ''}</small></div><button class="btn sm" data-ctdocopen="${c.id}:${i}">Abrir</button><button class="btn sm" data-ctdocdel="${c.id}:${i}">Remover</button></div>`).join('')}</div>` : '<p class="sub" style="margin:8px 0 0">Nenhum documento anexado. Envie o contrato pelo chat para ele ficar visível a todos (o que você adiciona pelo botão fica só neste navegador até existir Supabase).</p>'}</div>`;
}
const _cv = VIEWS.contratos;
VIEWS.contratos = () => {
  let h = _cv(); const sel = tab.ct && S.contratos.find(c => c.id === tab.ct);
  if (sel) { const m = '<div class="card tw"><h2>Itens e preços unitários</h2>'; h = h.replace(m, ctMedicoes(sel) + ctDocs(sel) + m); }
  else { const m = '<div class="card tw" style="margin-top:14px"><div class="row sp"><h2>Notas emitidas'; const i = h.indexOf(m); h = i >= 0 ? h.slice(0, i) + fatCard() + h.slice(i) : h + fatCard(); }
  return h;
};
function ctEditar(id) {
  const c = S.contratos.find(x => x.id === id); if (!c) return;
  const f = (k, l, v, t = 'text') => `<label>${l}</label><input id="cte_${k}" type="${t}" value="${esc(v == null ? '' : String(v).replace('.', ','))}">`;
  modal(`<h2>Editar contrato — ${esc(c.nome)}</h2><div class="grid g2" style="gap:10px">${f('total', 'Valor total (R$)', c.total)}${f('mo', 'Mão de obra (R$)', c.mo)}${f('mat', 'Material (R$)', c.mat)}${f('m2', 'Metragem total (m²)', c.m2)}<div><label>Início</label><input id="cte_inicio" type="date" value="${esc(c.inicio || '')}"></div><div><label>Fim</label><input id="cte_fim" type="date" value="${esc(c.fim || '')}"></div></div><label>Metragem (descrição)</label><input id="cte_metragem" value="${esc(c.metragem || '')}"><label>Observações</label><textarea id="cte_nota" style="min-height:70px">${esc(c.nota || '')}</textarea><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" data-act="close">Cancelar</button><button class="btn blue" data-ctsave="${c.id}">Salvar</button></div>`);
}
EXT.click.push(async e => {
  const g = k => e.target.closest(`[${k}]`);
  let t;
  if ((t = g('data-ctedit'))) { ctEditar(t.dataset.ctedit); return true; }
  if ((t = g('data-ctsave'))) { const c = S.contratos.find(x => x.id === t.dataset.ctsave), v = id => $('#cte_' + id).value.trim();
    ['total', 'mo', 'mat', 'm2'].forEach(k => { const n = parseBR(v(k)); if (!isNaN(n)) c[k] = n; }); c.inicio = v('inicio'); c.fim = v('fim'); c.metragem = v('metragem'); c.nota = v('nota'); c.semValor = !(c.mo > 0);
    save(); closeModal(); render(); return true; }
  if ((t = g('data-ctdocadd'))) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,image/*'; const id = t.dataset.ctdocadd;
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const r = await putFile(f), c = S.contratos.find(x => x.id === id); (c.documentos = c.documentos || []).push({ nome: f.name, tipo: 'Contrato', data: today(), id: r.id, local: true }); save(); render(); }; inp.click(); return true; }
  if ((t = g('data-ctdocopen'))) { const [id, i] = t.dataset.ctdocopen.split(':'), d = S.contratos.find(x => x.id === id).documentos[+i]; openFile(d.id || d.url); return true; }
  if ((t = g('data-ctdocdel'))) { const [id, i] = t.dataset.ctdocdel.split(':'); if (confirm('Remover este documento da lista?')) { S.contratos.find(x => x.id === id).documentos.splice(+i, 1); save(); render(); } return true; }
  return false;
});
EXT.change.push(async e => {
  const t = e.target; if (!t.dataset) return false;
  if (t.dataset.nrc) { const n = S.notasEmitidas.find(x => x.id === t.dataset.nrc); n.recebimento = Object.assign({ data: '' }, n.recebimento, { status: t.value }); if (t.value === 'recebido' && !n.recebimento.data) n.recebimento.data = today(); save(); render(); return true; }
  if (t.dataset.nrd) { const n = S.notasEmitidas.find(x => x.id === t.dataset.nrd); n.recebimento = Object.assign({ status: 'a confirmar' }, n.recebimento, { data: t.value }); save(); return true; }
  return false;
});
