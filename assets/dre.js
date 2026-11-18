/* Resultado › DRE por contrato: faturado líquido − mão de obra − material − Caixinha − custos indiretos, com indicador de confiança. */
'use strict';
const dreCfg = () => { const c = cfgD(); c.indiretos = Object.assign({ alojamento: null, admin: null, provisaoPct: null, rateio: 'pessoadia', agenda: false, projetar: false }, c.indiretos || {}); return c.indiretos; };
function drePer() {
  if (tab.dd && tab.da && tab.dd <= tab.da) return { ini: tab.dd, fim: tab.da, rot: `${fdate(tab.dd)} a ${fdate(tab.da)}` };
  return resPer();
}
const diasEntre = p => Math.max(1, Math.round((new Date(p.fim > today() ? today() : p.fim) - new Date(p.ini < '2026-06-01' ? '2026-06-08' : p.ini)) / 864e5) + 1);
// presença estimada pela agenda nos dias sem RDO
function dreAgenda(ids, per, diasRdo) {
  let v = 0; const dias = new Set(); const feito = new Set();
  S.calendario.filter(e => !e.substituidoPor && !e.parado && ids.includes(e.obraId) && resIn(e.data, per) && e.data <= today() && diaUtil(e.data) && !diasRdo.has(e.data)).forEach(e => (e.equipe || []).forEach(nm => {
    const f = findFunc(nm); if (!f) return; const k = f.id + '|' + e.data + '|' + e.obraId; if (feito.has(k)) return; feito.add(k);
    const c = custoDiaInfo(f).v; if (c != null) { v += c; dias.add(e.data); }
  }));
  return { v, dias: dias.size };
}
function dreCalc(per) {
  const cfg = dreCfg(), units = dbUnidades(per), meses = diasEntre(per) / 30;
  const frota = cxPorObra(S.caixinha.filter(x => resIn(x.data, per)))[''] || 0;
  const rows = units.map(R => {
    const diasRdo = new Set(R.rdos.map(r => r.data)), ag = cfg.agenda ? dreAgenda(R.ids, per, diasRdo) : { v: 0, dias: 0 };
    const o = getObra(R.c.obraId), w = o && obraWindow(o), ini = w ? (w.ini > per.ini ? w.ini : per.ini) : per.ini, fim = w ? (w.fim < per.fim ? w.fim : per.fim) : per.fim;
    let esp = 0; for (let d = ini; d <= fim && d <= today(); d = addDays(d, 1)) if (diaUtil(d) && !R.ids.some(i => obraParada(i, d))) esp++;
    const cob = esp ? Math.min(100, (diasRdo.size + ag.dias) / esp * 100) : null;
    const sp = R.c.mo ? semPrecoLista(R.c, per).length : 0;
    let mo = R.cmo + ag.v; const fator = cfg.projetar && cob && cob < 100 ? 100 / cob : 1; mo *= fator;
    return { R, ret: R.fat - R.liq, mo, ag, cob, esp, semPreco: sp, semTaxa: R.semTaxa.length, fator, pd: R.pessDia, w: R.diasN };
  });
  const base = k => rows.reduce((a, x) => a + (k === 'pessoadia' ? x.pd + 1 : k === 'faturado' ? x.R.fat + 1 : 1), 0);
  const ind = (cfg.alojamento || 0) * meses + (cfg.admin || 0) * meses + frota;
  rows.forEach(x => { const share = (cfg.rateio === 'pessoadia' ? x.pd + 1 : cfg.rateio === 'faturado' ? x.R.fat + 1 : 1) / base(cfg.rateio);
    x.prov = x.mo * (cfg.provisaoPct || 0) / 100; x.mat = x.R.cmatRdo + x.R.cmatEst; x.cx = x.R.cxo; x.ind = ind * share;
    x.custo = x.mo + x.prov + x.mat + x.cx + x.ind; x.res = x.R.liq - x.custo; x.marg = x.R.liq ? x.res / x.R.liq * 100 : null;
    x.resProd = x.R.rec - x.custo; x.conf = x.cob == null ? 'Baixa' : (x.cob >= 80 && !x.semTaxa && !x.semPreco) ? 'Alta' : x.cob >= 50 ? 'Média' : 'Baixa'; });
  return { rows, ind, frota, meses };
}
function dreView() {
  const per = drePer(), cfg = dreCfg(), D = dreCalc(per), rows = D.rows, T = k => rows.reduce((a, x) => a + (k.split('.').reduce((o, p) => o[p], x) || 0), 0);
  const pill = c => `<span class="pill ${c === 'Alta' ? 'g' : c === 'Média' ? 'a' : 'r'}">${c}</span>`;
  const inp = (k, l, ph) => `<div><label class="mono">${l}</label><br><input data-dri="${k}" value="${cfg[k] == null ? '' : String(cfg[k]).replace('.', ',')}" placeholder="${ph}" style="width:130px;text-align:right"></div>`;
  const tabs = `<div class="tabs">${[['tudo', 'Tudo'], ['mes', 'Mês atual'], ['quin', 'Quinzena'], ['sem', 'Semana']].map(([k, l]) => `<button data-rpd="${k}" class="${!(tab.dd && tab.da) && (tab.rp || 'tudo') === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="row" style="margin:-4px 0 14px;gap:8px"><span class="mono">ou intervalo</span><input type="date" data-ddi="dd" value="${tab.dd || ''}"><input type="date" data-ddi="da" value="${tab.da || ''}"></div>`;
  const tr = x => { const c = x.R.c; return `<tr><td><i class="sw" style="border-color:${obraCor(c.obraId)};background:${obraCor(c.obraId)}"></i><b>${esc(short(c.nome))}</b><small>${c.semValor ? 'fora da carteira' : 'MO contratada ' + brl(c.mo)}</small></td><td class="n">${brl(x.R.fat)}</td><td class="n">${brl(x.ret)}</td><td class="n"><b>${brl(x.R.liq)}</b></td><td class="n">${brl(x.mo)}${x.ag.v ? `<small>inclui ${brl(x.ag.v)} pela agenda</small>` : ''}${x.fator > 1 ? `<small>projetado ×${x.fator.toFixed(1).replace('.', ',')}</small>` : ''}</td><td class="n">${brl(x.prov)}</td><td class="n">${brl(x.mat)}</td><td class="n">${brl(x.cx)}</td><td class="n">${brl(x.ind)}</td><td class="n">${brl(x.custo)}</td><td class="n ${x.res >= 0 ? 'grn' : 'red'}"><b>${brl(x.res)}</b></td><td class="n">${x.marg == null ? '—' : pc1r(x.marg) + '%'}</td><td>${pill(x.conf)}<small>${x.cob == null ? 'sem janela' : 'RDO em ' + pc1r(x.cob, 0) + '% dos dias'}</small></td></tr>`; };
  const tot = `<tr style="font-weight:600"><td>Total</td><td class="n">${brl(T('R.fat'))}</td><td class="n">${brl(T('ret'))}</td><td class="n">${brl(T('R.liq'))}</td><td class="n">${brl(T('mo'))}</td><td class="n">${brl(T('prov'))}</td><td class="n">${brl(T('mat'))}</td><td class="n">${brl(T('cx'))}</td><td class="n">${brl(T('ind'))}</td><td class="n">${brl(T('custo'))}</td><td class="n">${brl(T('R.liq') - T('custo'))}</td><td class="n">${T('R.liq') ? pc1r((T('R.liq') - T('custo')) / T('R.liq') * 100) + '%' : '—'}</td><td></td></tr>`;
  const prod = rows.map(x => `<tr><td><b>${esc(short(x.R.c.nome))}</b></td><td class="n">${brl(x.R.rec)}</td><td class="n">${brl(x.custo)}</td><td class="n ${x.resProd >= 0 ? 'grn' : 'red'}">${brl(x.resProd)}</td><td class="n">${brl(x.R.fat - x.R.rec)}</td><td class="n">${x.w ? brl(x.mo / x.w) : '—'}</td><td class="n">${x.R.m2 ? brl(x.mo / x.R.m2) : '—'}</td><td class="n">${x.pd ? pc1r(x.R.m2 / x.pd, 1) : '—'}</td><td class="n">${(() => { const pr = (getObra(x.R.c.obraId) || {}).precoPiso; return x.w && pr ? pc1r(x.mo / x.w / pr, 1) + ' m²/dia' : '—'; })()}</td></tr>`).join('');
  const sp = rows.filter(x => x.semPreco).map(x => `${esc(short(x.R.c.nome))}: ${x.semPreco} lançamento(s) sem preço`);
  return `${head('Resultado', 'DRE por contrato · ' + per.rot, `<button class="btn" data-exp="open">Exportar período (Excel)</button>`)}${rtTabs()}${tabs}
  <div class="alert" style="margin-bottom:14px;background:var(--ambS);border-color:var(--line)"><b class="amb">Como ler</b><ul style="margin:6px 0 0;padding-left:18px"><li><b>Faturado × custo</b> é visão de caixa: NFS-e do período menos o custo registrado no mesmo período. <b>Competência</b> (abaixo) compara a receita ganha pelos RDOs com o mesmo custo.</li><li>Só dá para confiar no resultado onde a <b>confiança é Alta</b> (RDO em ≥ 80% dos dias úteis, todas as pessoas com custo/dia e todos os serviços com preço). Em Baixa, o custo está subestimado e o lucro aparece maior que o real.</li>${sp.length ? `<li>${sp.join(' · ')}.</li>` : ''}</ul></div>
  <div class="card" style="margin-bottom:14px"><div class="row sp"><h2>Parâmetros de custos indiretos</h2><span class="mono">preencha o que souber; vazio = não entra</span></div><div class="row" style="gap:16px;margin-top:8px">${inp('alojamento', 'Alojamento (R$/mês)', 'a informar')}${inp('admin', 'Administrativo (R$/mês)', 'Valim, Vinicius, Cícero')}${inp('provisaoPct', 'Provisão 13º/férias/FGTS (% da MO)', 'ex.: 25')}<div><label class="mono">Rateio dos indiretos</label><br><select data-dri="rateio"><option value="pessoadia" ${cfg.rateio === 'pessoadia' ? 'selected' : ''}>por pessoa-dia</option><option value="faturado" ${cfg.rateio === 'faturado' ? 'selected' : ''}>pelo faturado</option><option value="igual" ${cfg.rateio === 'igual' ? 'selected' : ''}>igual</option></select></div><label><input type="checkbox" data-dri="agenda" ${cfg.agenda ? 'checked' : ''}> completar presença pela agenda (dias sem RDO)</label><label><input type="checkbox" data-dri="projetar" ${cfg.projetar ? 'checked' : ''}> projetar custo pela cobertura</label></div><small class="sub">Frota/combustível sem obra do período (Caixinha "Geral/Frota"): ${brl(D.frota)} entram automaticamente nos indiretos.</small></div>
  <div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>DRE — faturado × custo</h2><span class="mono">${esc(per.rot)}</span></div><table class="zebra"><tr><th>Contrato / obra</th><th class="n">Faturado bruto</th><th class="n">(−) Retenções</th><th class="n">Receita líquida</th><th class="n">(−) Mão de obra</th><th class="n">(−) Provisão</th><th class="n">(−) Material</th><th class="n">(−) Caixinha</th><th class="n">(−) Indiretos</th><th class="n">Custo total</th><th class="n">Resultado</th><th class="n">Margem</th><th>Confiança</th></tr>${rows.map(tr).join('')}${tot}</table></div>
  <div class="card tw"><div class="row sp"><h2>Competência — produção × custo e indicadores</h2><span class="mono">receita ganha pelos itens do contrato</span></div><table class="zebra"><tr><th>Contrato / obra</th><th class="n">Receita ganha (RDOs)</th><th class="n">Custo</th><th class="n">Resultado da produção</th><th class="n">Faturado − receita ganha</th><th class="n">MO por dia c/ RDO</th><th class="n">MO por m²</th><th class="n">m² por pessoa-dia</th><th class="n">Equilíbrio (piso/dia)</th></tr>${prod}</table><p class="sub" style="margin:8px 0 0">"Faturado − receita ganha" positivo = medição adiantada em relação ao que os RDOs comprovam. Equilíbrio = quantos m² de piso completo por dia pagam a mão de obra.</p></div>`;
}
const rtTabs = () => `<div class="tabs"><button data-rt="res" class="${tab.rt !== 'dre' ? 'on' : ''}">Resultado</button><button data-rt="dre" class="${tab.rt === 'dre' ? 'on' : ''}">DRE por contrato</button></div>`;
const _res = VIEWS.res;
VIEWS.res = () => (tab.rt === 'dre' ? dreView() : _res().replace('<div class="tabs">', rtTabs() + '<div class="tabs">'));
EXT.click.push(async e => { let t; if ((t = e.target.closest('[data-rt]'))) { tab.rt = t.dataset.rt; render(); return true; } if ((t = e.target.closest('[data-rpd]'))) { tab.dd = ''; tab.da = ''; tab.rp = t.dataset.rpd; render(); return true; } return false; });
EXT.change.push(async e => {
  const t = e.target; if (!t.dataset) return false;
  if (t.dataset.ddi) { tab[t.dataset.ddi] = t.value; render(); return true; }
  if (t.dataset.dri) { const c = dreCfg(), k = t.dataset.dri; c[k] = t.type === 'checkbox' ? t.checked : (k === 'rateio' ? t.value : (t.value === '' ? null : parseBR(t.value))); save(); render(); return true; }
  return false;
});
