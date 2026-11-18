/* Contratos › Preços por serviço: valoriza a produção dos RDOs pelos itens do contrato (receita ganha). */
'use strict';
function precoExec(c, faseId) { // quantidade executada de uma fase nos RDOs salvos da obra do contrato (com sub-obras)
  const ids = obraFamilia(c.obraId);
  return S.rdos.filter(r => r.status === 'salvo' && ids.includes(r.obraId)).reduce((a, r) => a + (r.fases || []).filter(l => l.faseId === faseId).reduce((x, l) => x + (+l.qtd || 0), 0), 0);
}
function semPrecoLista(c, per) { // linhas de RDO com quantidade e sem preço (contrato ou peso da fase), opcionalmente num período
  const ids = obraFamilia(c.obraId), out = [];
  S.rdos.filter(r => r.status === 'salvo' && ids.includes(r.obraId) && (!per || resIn(r.data, per))).forEach(r => (r.fases || []).forEach(l => {
    const q = +l.qtd || 0; if (!q) return; const f = S.fases.find(x => x.id === l.faseId), p = f && precoFase(getObra(r.obraId), f);
    if (!p) out.push({ r, nome: f ? f.nome : (l.nome || 'serviço avulso'), q, un: l.un || (f && f.un) || '' });
  }));
  return out;
}
function ctPrecosCard(c) {
  const fs = S.fases.filter(f => f.ativa !== false), P = c.precos || {};
  let ganha = 0; const rows = fs.map(f => { const p = P[f.id] || {}, q = precoExec(c, f.id), v = q * (p.preco || 0); ganha += v;
    return `<tr><td>${esc(f.nome)}</td><td>${esc(f.un)}</td><td class="n"><input data-prc="${c.id}:${f.id}" value="${p.preco ? String(p.preco).replace('.', ',') : ''}" placeholder="a informar" style="width:110px;text-align:right"></td><td class="n">${q ? nfmt(q) + ' ' + esc(f.un) : '—'}</td><td class="n">${v ? brl(v) : q && !p.preco ? '<span class="pill a">sem preço</span>' : '—'}</td><td><small>${esc(p.fonte || '—')}</small></td></tr>`; }).join('');
  const sem = semPrecoLista(c), fat = ctFat(c).bruto;
  const avisos = sem.length ? `<div class="alert" style="margin-top:10px;background:var(--ambS);border-color:var(--line)"><b class="amb">Serviço lançado sem preço (${sem.length})</b><ul style="margin:6px 0 0;padding-left:18px">${sem.slice(0, 8).map(x => `<li>${fdate(x.r.data)} — ${esc(x.nome)}: ${nfmt(x.q)} ${esc(x.un)} ${x.un === 'un' ? '(o contrato precifica por metro: lançar em metros ou informar preço por unidade)' : ''}</li>`).join('')}</ul></div>` : '';
  return `<div class="card tw"><div class="row sp"><h2>Preços por serviço (receita ganha)</h2><span class="mono">receita ganha ${brl(ganha)} · faturado ${brl(fat)} · ${fat > ganha ? 'faturou ' + brl(fat - ganha) + ' além do que os RDOs valorizam' : 'RDOs valorizam ' + brl(ganha - fat) + ' além do faturado'}</span></div>
  <table class="zebra"><tr><th>Serviço</th><th>Un.</th><th class="n">Preço (R$)</th><th class="n">Executado nos RDOs</th><th class="n">Receita ganha</th><th>Origem do preço</th></tr>${rows}</table>${avisos}
  <p class="sub" style="margin:8px 0 0">A receita ganha é uma estimativa: só soma o que foi lançado nos RDOs com quantidade. RDO sem m², metros ou unidades por serviço não gera receita.</p></div>`;
}
const _cv2 = VIEWS.contratos;
VIEWS.contratos = () => {
  let h = _cv2(); const sel = tab.ct && S.contratos.find(c => c.id === tab.ct);
  if (sel) { const m = '<div class="card tw"><h2>Itens e preços unitários</h2>'; h = h.replace(m, ctPrecosCard(sel) + m); }
  return h;
};
EXT.change.push(async e => {
  const t = e.target; if (!t.dataset || !t.dataset.prc) return false; const [cid, fid] = t.dataset.prc.split(':'), c = S.contratos.find(x => x.id === cid), f = S.fases.find(x => x.id === fid), v = parseBR(t.value);
  c.precos = c.precos || {}; if (!v || isNaN(v)) delete c.precos[fid]; else c.precos[fid] = { preco: v, un: f.un, item: '', fonte: 'editado no sistema' };
  save(); render(); return true;
});
