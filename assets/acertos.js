/* Caixinha: acertos com funcionários (reembolsar, descontar, adiantamentos). */
'use strict';
function acertosCard() {
  const l = (S.caixinha || []).filter(c => c.acerto), pend = l.filter(c => c.acertoStatus !== 'feito');
  if (!l.length) return '';
  const tot = t => pend.filter(c => c.acerto === t).reduce((a, c) => a + cxVal(c), 0), lbl = { reembolsar: 'Reembolsar ao funcionário', descontar: 'Descontar do funcionário', adiantamento: 'Adiantamento a conferir' };
  const pp = {}; pend.filter(c => c.acerto === 'reembolsar').forEach(c => { const k = c.pessoa || 'a informar'; pp[k] = (pp[k] || 0) + cxVal(c); });
  const ppTxt = Object.entries(pp).map(([k, v]) => `${esc(k)}: ${brl(v)}`).join(' · ');
  const rows = l.slice().sort((a, b) => b.data.localeCompare(a.data)).map(c => `<tr><td>${fdate(c.data)}</td><td>${esc(c.descricao)}<small>${esc(c.obs || '')}</small></td><td>${esc(c.pessoa || '—')}</td><td><span class="pill ${c.acerto === 'descontar' ? 'r' : c.acerto === 'reembolsar' ? 'a' : 'b'}">${lbl[c.acerto]}</span></td><td class="n">${brl(cxVal(c))}</td><td><select data-acs="${c.id}"><option value="pendente" ${c.acertoStatus !== 'feito' ? 'selected' : ''}>pendente</option><option value="feito" ${c.acertoStatus === 'feito' ? 'selected' : ''}>${c.acerto === 'descontar' ? 'descontado' : 'acertado'}</option></select></td></tr>`).join('');
  return `<div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Acertos com funcionários</h2><span class="mono">repor: ${ppTxt || '—'} · a reembolsar ${brl(tot('reembolsar'))} · a descontar ${brl(tot('descontar'))} · adiantamentos ${brl(tot('adiantamento'))}</span></div><table class="zebra"><tr><th>Data</th><th>Lançamento</th><th>Pessoa</th><th>Tipo de acerto</th><th class="n">Valor</th><th>Situação</th></tr>${rows}</table><p class="sub" style="margin:8px 0 0">Descontos só valem se houver autorização do funcionário e respeitarem a legislação trabalhista; confirme com o Valim/RH antes de lançar na folha.</p></div>`;
}
const _cxv = CAD.cx; CAD.cx = function () { return acertosCard() + _cxv(); };
EXT.change.push(async e => { const t = e.target; if (!t.dataset || !t.dataset.acs) return false; S.caixinha.find(c => c.id === t.dataset.acs).acertoStatus = t.value; save(); render(); return true; });
