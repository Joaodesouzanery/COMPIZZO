/* Relatório semanal "situação de tudo": formato Item | Valor com subtotais, por obra/contrato ativo + custos fixos/variáveis. */
'use strict';
NAV.splice(4, 0, ['rel', 'Relatório semanal']);
ICO.rel = 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7';
const relSemana = () => tab.rw || (() => { const ds = S.rdos.filter(r => r.status === 'salvo').map(r => r.data).sort(); return mondayOf(ds[ds.length - 1] || today()); })();
function relDados(w) {
  const per = { ini: w, fim: addDays(w, 5) }, ativos = (S.contratos || []).filter(c => c.ativo);
  const obras = ativos.map(c => {
    const R = resCalc(c, per), o = ctObra(c), parada = o && (obraStatusParada(o) || (S.paradas || []).some(p => p.obraId === o.id && p.ini <= per.fim && p.fim >= per.ini));
    const pessoas = new Set(); R.rdos.forEach(r => (r.maoObra || []).forEach(n => pessoas.add(norm(n))));
    const plan = (S.calendario || []).filter(e => !e.substituidoPor && R.ids.includes(e.obraId) && e.data >= per.ini && e.data <= per.fim && !e.parado);
    return { c, o, R, parada, pessoas: pessoas.size, planDias: new Set(plan.map(e => e.data)).size };
  });
  const cm = (S.config || {}).custosMensais, fx = cm ? cm.fixos.reduce((a, x) => a + x[1], 0) : 0, vr = cm ? cm.variaveis.reduce((a, x) => a + x[1], 0) : 0;
  return { per, obras, cm, fx, vr };
}
const relRow = (t, v, o = {}) => `<tr class="${o.cls || ''}"><td style="${o.ind ? 'padding-left:22px' : ''}">${o.b ? `<b>${t}</b>` : t}</td><td class="n">${o.b ? `<b>${v}</b>` : v}</td></tr>`;
function relView() {
  const w = relSemana(), D = relDados(w), dias = [0, 1, 2, 3, 4, 5].map(i => addDays(w, i));
  const blocos = D.obras.map(({ c, o, R, parada, pessoas, planDias }) => {
    const sem = !R.rdos.length;
    let h = `<table class="rel"><tr><th colspan="2" style="text-align:left">${esc(short(c.nome))}${parada ? ' <span class="pill r">PARADA</span>' : ''}${sem && !parada ? ' <span class="pill a">sem RDO na semana</span>' : ''}</th></tr>`;
    if (sem) { h += relRow('Programado na agenda', planDias ? planDias + ' dia(s)' : '—', { ind: 1 }) + relRow('Faturado (NFS-e) na semana', mon(R.fat || null), { ind: 1 }); return h + '</table>'; }
    h += relRow('Dias com RDO', R.diasN + (planDias ? ` de ${planDias} programados` : ''), { ind: 1 }) + relRow('Pessoas distintas / pessoa-dia', `${pessoas} / ${R.pess.reduce((a, p) => a + p.dias.size, 0)}`, { ind: 1 }) + relRow('m² de piso executados', nfmt(R.m2), { ind: 1 })
      + relRow('Receita ganha (itens do contrato)', mon(R.rec), { b: 1 }) + relRow('(−) Mão de obra', mon(R.cmo), { ind: 1 }) + relRow('(−) Material (retiradas valoradas)', mon(R.cmatEst + R.cmatRdo), { ind: 1 }) + relRow('(−) Caixinha', mon(R.cxo), { ind: 1 })
      + relRow('Custo direto da semana', mon(R.custoTot), { b: 1 }) + relRow('Resultado (receita − custo)', mon(R.lucro), { b: 1, cls: R.lucro < 0 ? 'bad' : 'ok' }) + relRow('Faturado na semana (NFS-e bruto)', mon(R.fat || null), { ind: 1 });
    return h + '</table>';
  }).join('');
  const T = k => D.obras.reduce((a, x) => a + (x.R[k] || 0), 0), cm = D.cm;
  const tot = `<table class="rel"><tr><th colspan="2" style="text-align:left">Total da semana (obras ativas)</th></tr>${relRow('Receita ganha', mon(T('rec')), { b: 1 })}${relRow('Mão de obra', mon(T('cmo')), { ind: 1 })}${relRow('Material', mon(T('cmatEst') + T('cmatRdo')), { ind: 1 })}${relRow('Caixinha', mon(T('cxo')), { ind: 1 })}${relRow('Custo direto', mon(T('custoTot')), { b: 1 })}${relRow('Resultado direto', mon(T('lucro')), { b: 1 })}${relRow('Indiretos estimados (fixos + variáveis ÷ 4,33)', mon((D.fx + D.vr) / 4.33), { ind: 1 })}${relRow('Resultado após indiretos (estimado)', mon(T('lucro') - (D.fx + D.vr) / 4.33), { b: 1 })}</table>`;
  const custos = cm ? `<table class="rel"><tr><th colspan="2" style="text-align:left">Custos fixos e variáveis — ${esc(cm.rotulo)}</th></tr>${relRow('Fixos', '', { b: 1 })}${cm.fixos.map(x => relRow(esc(x[0]), brl(x[1]), { ind: 1 })).join('')}${relRow('Total fixos', brl(D.fx), { b: 1 })}${relRow('Variáveis', '', { b: 1 })}${cm.variaveis.map(x => relRow(esc(x[0]), brl(x[1]), { ind: 1 })).join('')}${relRow('Total variáveis', brl(D.vr), { b: 1 })}${relRow('Total do mês', brl(D.fx + D.vr), { b: 1 })}</table>` : '';
  const pend = []; D.obras.forEach(x => { if (x.R.rdos.length && !x.R.rec) pend.push(`${esc(short(x.c.nome))}: RDO sem preço/quantidade por serviço`); if (x.R.semTaxa.length) pend.push(`${esc(short(x.c.nome))}: sem custo/dia — ${x.R.semTaxa.map(esc).join(', ')}`); if (!x.R.rdos.length && x.planDias && !x.parada) pend.push(`${esc(short(x.c.nome))}: programada em ${x.planDias} dia(s), mas sem RDO`); });
  const parados = (S.paradas || []).filter(p => p.ini <= D.per.fim && p.fim >= D.per.ini).map(p => `${esc(short(obraNome(p.obraId)))}: ${esc(p.motivo)}`);
  return `${head('Relatório semanal', 'Situação de tudo na semana dos apontamentos', '<button class="btn" onclick="window.print()">Imprimir</button>')}
  <div class="row" style="margin-bottom:12px"><button class="btn sm" data-rwk="-7">◀ anterior</button><b>${fdate(dias[0])} a ${fdate(dias[5])}</b><button class="btn sm" data-rwk="7">próxima ▶</button><button class="btn sm" data-rwk="0">última com dados</button></div>
  <div class="dgrid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">${blocos.split('</table>').filter(Boolean).map(b => `<div class="card tw" style="margin:0">${b}</table></div>`).join('')}<div class="card tw" style="margin:0">${tot}</div>${cm ? `<div class="card tw" style="margin:0">${custos}</div>` : ''}</div>
  <div class="card" style="margin-top:14px"><h2>Pendências e alertas</h2>${[...parados.map(x => 'Parada: ' + x), ...pend].map(x => `<div class="row" style="padding:4px 0;border-bottom:1px solid var(--line)">${x}</div>`).join('') || '<p class="sub">Nada pendente.</p>'}</div>`;
}
VIEWS.rel = relView;
EXT.click.push(async e => { const t = e.target.closest('[data-rwk]'); if (!t) return false; const n = +t.dataset.rwk; tab.rw = n === 0 ? null : addDays(relSemana(), n); render(); return true; });

/* ---- menos poluição: em Contratos, cada cartão vira seção recolhível; abre só se tiver informação ---- */
const _renderBase = render;
render = function () {
  _renderBase();
  if (view !== 'contratos') return;
  const v = $('#view');
  v.querySelectorAll('.card').forEach(card => {
    if (card.classList.contains('kpi') || card.closest('details') || card.querySelector('.kpi') || card.parentElement !== v && !card.parentElement.classList.contains('grid')) return;
    const h = card.querySelector('h2'); if (!h) return;
    const dados = card.querySelectorAll('tr').length > 1 || card.querySelectorAll('li').length > 0 || card.querySelectorAll('.row').length > 1 || card.querySelector('svg,.hb');
    const vazio = !dados || /^\s*$/.test(card.textContent.replace(h.textContent, ''));
    const d = document.createElement('details'); d.className = card.className; d.setAttribute('style', card.getAttribute('style') || '');
    if (!vazio && /Notas|Avan|Itens|Cruzamentos|Valor por contrato/.test(h.textContent)) d.open = view === 'contratos' && !!tab.ct || /Notas|Valor por contrato/.test(h.textContent);
    const s = document.createElement('summary'); s.style.cursor = 'pointer'; s.innerHTML = `<b>${h.textContent}</b>${vazio ? ' <span class="mono">sem informações</span>' : ''}`;
    h.remove(); const wrap = document.createElement('div'); while (card.firstChild) wrap.appendChild(card.firstChild);
    d.append(s, wrap); card.replaceWith(d);
  });
  const hist = (S.contratosHist || []);
  if (hist.length && !tab.ct) v.insertAdjacentHTML('beforeend', `<details class="card" style="margin-top:14px"><summary style="cursor:pointer"><b>Contratos históricos / documentos guardados (${hist.length})</b> <span class="mono">fora dos 5 ativos e do resultado</span></summary>${hist.map(h => `<table class="rel"><tr><th colspan="2" style="text-align:left">${esc(h.nome)}</th></tr>${relRow('Contratante / CNPJ', esc(h.contratante) + ' · ' + esc(h.cnpj))}${relRow('Local', esc(h.local))}${relRow('Mão de obra', brl(h.mo) + ` (${nfmt(h.m2)} m² × R$ ${pc1r(h.precoM2MO, 2)})`)}${relRow('Material', brl(h.mat))}${relRow('Total', brl(h.total), { b: 1 })}${relRow('Retenção', esc(h.retencao))}${relRow('Prazo', fdate(h.ini) + ' a ' + fdate(h.fim))}${relRow('Situação', esc(h.status))}</table>`).join('')}</details>`);
};
