/* Apontamento diário do campo (formato Encarregado/Presentes/Equipamento/Serviço) → RDO, com mesclagem sem duplicar. */
'use strict';
const APT_FASE = [[/lixament/i, 'fa1'], [/trat.*junta|junta.*trinca|check ?list/i, 'fa2'], [/primer/i, 'fa3'], [/raspadinha/i, 'fa5'], [/demarc/i, 'fa7'], [/barrad|parede/i, 'fa9'], [/meio-?fio/i, 'fa10'], [/pintura(?!.*(vaga|demarc))/i, 'fa6']];
function aptPresentes(txt) {
  const out = [];
  for (const part of String(txt || '').split(/[,;]|\s{2,}/).map(x => x.trim()).filter(Boolean)) {
    // "Renan - 1/2 of de pintor e Samuel - Ajudante" → 2 pessoas; "Tiago e Mateus - ajudante" → 2 pessoas, mesmo cargo
    for (const sub of part.split(/\s+e\s+(?=[A-Za-zÀ-ú]+\s*[-–—]|[A-Za-zÀ-ú]+\s*$)/i)) {
      const m = sub.trim().match(/^(.+?)\s*[-–—]\s*(.+)$/); if (m) out.push({ nome: m[1].trim(), cargo: m[2].trim() }); else out.push({ nome: sub.trim(), cargo: '' });
    }
  }
  for (let i = out.length - 2; i >= 0; i--) if (!out[i].cargo && out[i + 1].cargo) out[i].cargo = out[i + 1].cargo;
  return out;
}
function parseApontamento(txt) {
  const blocks = String(txt).split(/(?=apontamento\s*:)/i).filter(b => /obra\s*:/i.test(b)), res = [];
  for (const b of blocks) {
    const g = re => ((b.match(re) || [])[1] || '').trim();
    const obraTxt = g(/obra\s*:\s*([^|\n]+)/i), data = dataBR(g(/data\s*:\s*([^\n|]+)/i)) || today();
    const lines = b.split('\n').map(l => l.trim()); let sec = 0; const sc = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const l of lines) { const m = l.match(/^(\d)\)\s*(.*)$/); if (m && +m[1] >= 1 && +m[1] <= 5) { sec = +m[1]; const rest = m[2].replace(/^(local|equipe do dia|equipamento e m[aá]quinas|servi[cç]o executado[^:]*|observa[cç][oõ]es)\s*[:\-–]?\s*/i, '').trim(); if (rest) sc[sec].push(rest); continue; } if (sec && l) sc[sec].push(l); }
    const enc = (sc[2].join('\n').match(/encarregado\s*:\s*([^\n]+)/i) || [])[1] || '', pres = (sc[2].join('\n').match(/presentes\s*:\s*([\s\S]*)/i) || [])[1] || (enc || /parad[ao]/i.test(sc[2].join(' ')) ? '' : sc[2].join(' '));
    let presentes = aptPresentes(pres.replace(/\n+/g, ' ')); const servicos = [], fases = [];
    for (const l of sc[4]) {
      const ex = aptPresentes(l); if (ex.length && ex.every(p => findFunc(p.nome))) { presentes = presentes.concat(ex); continue; }
      servicos.push(l.replace(/\s+/g, ' '));
    }
    const servTxt = servicos.join(' '), fora = servTxt.replace(/\([^)]*\)/g, ' '), rxq = /(\d+(?:[.,]\d+)?)\s*(m²|m2|m\b|metros|un\b|unid\w*|vagas?)/gi;
    let qm = [...fora.matchAll(rxq)]; if (!qm.length) qm = [...servTxt.matchAll(rxq)];
    qm.forEach(m => { const un = /m²|m2/i.test(m[2]) ? 'm²' : /^m\b|metros/i.test(m[2]) ? 'm' : 'un'; const ctx = ''; const fz = APT_FASE.find(([re]) => re.test(servTxt)); fases.push({ faseId: un === 'm²' && fz ? fz[1] : '', nome: '', qtd: parseBR(m[1]), un, _ctx: ctx }); });
    const equip = sc[3].join(' ').replace(/^[-–—\s]+/, '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1));
    const rng = g(/data\s*:\s*([^\n|]+)/i).match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:a|até|–|—|-)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    const base = { obraTxt, data, local: sc[1].join(' '), encarregado: enc, presentes, equipamentos: equip, servicos, fases, obs: sc[5].join(' ') };
    if (!rng) { res.push(base); continue; }
    // período (ex.: 03/11 a 06/11): uma linha por dia, "NOME faltou" tira a pessoa do dia, quantidade repetida em dias seguidos fica só no 1º dia
    const ini = dataBR(rng[1]), fim = dataBR(rng[2]), raw = b.trim(), dias = [];
    if (/parad[ao]/i.test(sc[2].join(' ')) && !sc[4].join('').trim()) { res.push({ ...base, parada: true, ini, fim, raw, servicos: [], fases: [], presentes: [] }); continue; }
    for (const l of sc[4]) { const m = l.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[-–—:]?\s*(.*)$/); if (m) dias.push({ d: dataBR(m[1]), t: m[2] }); else if (dias.length && l) dias[dias.length - 1].t += ' ' + l; }
    let ult = '';
    dias.forEach((x, i) => {
      const falt = [...x.t.matchAll(/([A-Za-zÀ-ú]+)\s+faltou/gi)].map(m => (findFunc(m[1]) || { nome: m[1] }).nome), txt = x.t.replace(/[-–—\s]*[A-Za-zÀ-ú]+\s+faltou/gi, '').replace(/\s+/g, ' ').trim();
      const rxq = /(\d+(?:[.,]\d+)?)\s*(m²|m2|unds?|un\b|unid\w*)/gi; let q = [...txt.replace(/\([^)]*\)/g, ' ').matchAll(rxq)]; if (!q.length) q = [...txt.matchAll(rxq)]; const fz = [];
      q.forEach(m => { const un = /m²|m2/i.test(m[2]) ? 'm²' : 'un', sig = m[1] + un; if (sig === ult) return; ult = sig; const f = APT_FASE.find(([re]) => re.test(txt)); fz.push({ faseId: un === 'm²' && f ? f[1] : (un === 'un' ? 'fa8' : ''), nome: '', qtd: parseBR(m[1]), un }); });
      res.push({ ...base, data: x.d, ini, fim, raw, servicos: [txt], fases: fz, faltas: falt, presentes: base.presentes.filter(p => !falt.some(n => norm(n) === norm((findFunc(p.nome) || p).nome || p.nome))), obs: i === dias.length - 1 ? base.obs : '' });
    });
  }
  return res;
}
function aptResolve(a) { const o = findObra(a.obraTxt); a.obraId = o ? o.id : ''; a.presentes.forEach(p => { const f = findFunc(p.nome); p.func = f || null; if (f && !p.cargo) p.cargo = f.funcao; }); return a; }
function aptMesclar(list) {
  let novos = 0, mesclados = 0, iguais = 0;
  const hist = {};
  for (const a of list) {
    if (!a.obraId) continue;
    if (a.raw) { const k = `apt|${a.obraId}|${a.ini}|${a.fim}`, h = (hist[k] = hist[k] || { chave: k, obraId: a.obraId, ini: a.ini, fim: a.fim, enviadoEm: today(), local: a.local, texto: a.raw, rdoIds: [], parada: !!a.parada }); h._a = (h._a || 0) + 1; }
    if (a.parada) { S.paradas = S.paradas || []; if (!S.paradas.some(p => p.obraId === a.obraId && p.ini === a.ini && p.fim === a.fim)) S.paradas.push({ id: uid('pa'), obraId: a.obraId, ini: a.ini, fim: a.fim, motivo: (a.obs || 'Obra parada') }); continue; }
    (a.faltas || []).forEach(n => { const f = findFunc(n); if (f && !(S.faltas || []).some(x => x.funcId === f.id && x.data === a.data)) { (S.faltas = S.faltas || []).push({ id: uid('fl'), funcId: f.id, data: a.data, obraId: a.obraId, motivo: 'Faltou (apontamento)', chave: f.id + '|' + a.data, fonte: 'apontamento' }); } });
    const nomes = [...new Set(a.presentes.map(p => (p.func ? p.func.nome : p.nome)))], ids = nomes.map(n => (findFunc(n) || {}).id).filter(Boolean);
    const enc = findFunc(a.encarregado), cargos = Object.fromEntries(a.presentes.map(p => [p.func ? p.func.nome : p.nome, p.cargo]));
    let r = S.rdos.find(x => x.obraId === a.obraId && x.data === a.data && x.status === 'salvo');
    const txtServ = a.servicos.join(' · ');
    if (!r) { r = { id: 'rdoa_' + a.obraId + '_' + a.data, chave: `rdo|${a.obraId}|${a.data}`, importado: false, origem: 'apontamento', status: 'salvo', obraId: a.obraId, data: a.data, titulo: '', responsavel: enc ? enc.nome : a.encarregado, respNome: enc ? enc.nome : a.encarregado, clima: '', maoObra: [], maoObraIds: [], fases: [], servicos: [], descricao: '', hh: '', horasSemProd: '', motivoSemProd: '', materiais: [], equipamentos: [], ocorrencias: [], ocHoras: {}, obs: '', fotos: [], fotosQtd: 0, proximo: '', respData: a.data };
      S.rdos.push(r); novos++; }
    let mudou = novos > 0 && r.maoObra.length === 0 && r.servicos.length === 0;
    const addL = (k, vs) => { r[k] = r[k] || []; vs.forEach(v => { if (v && !r[k].some(x => norm(x) === norm(v))) { r[k].push(v); mudou = true; } }); };
    addL('maoObra', nomes); addL('maoObraIds', ids); addL('equipamentos', a.equipamentos); addL('servicos', a.servicos);
    a.fases.forEach(f => { if (!(r.fases || []).some(x => (x.faseId || '') === (f.faseId || '') && +x.qtd === +f.qtd && (x.un || 'm²') === f.un)) { (r.fases = r.fases || []).push({ faseId: f.faseId, nome: f.faseId ? '' : (txtServ || 'Serviço do apontamento').slice(0, 80), qtd: f.qtd, un: f.un }); mudou = true; } });
    const addT = (k, v) => { if (v && !norm(r[k] || '').includes(norm(v))) { r[k] = ((r[k] || '') + ' ' + v).trim(); mudou = true; } };
    addT('obs', a.obs); addT('descricao', txtServ);
    if (a.local && !r.local) { r.local = a.local; mudou = true; } if (a.encarregado && !r.encarregado) { r.encarregado = enc ? enc.nome : a.encarregado; mudou = true; }
    r.cargosDia = Object.assign(r.cargosDia || {}, cargos);
    if (novos === 0) { if (mudou) mesclados++; else iguais++; }
    if (a.raw) { const h = hist[`apt|${a.obraId}|${a.ini}|${a.fim}`]; if (h && !h.rdoIds.includes(r.id)) h.rdoIds.push(r.id); }
  }
  Object.values(hist).forEach(h => { delete h._a; S.apontamentos = S.apontamentos || []; const ex = S.apontamentos.find(x => x.chave === h.chave); if (ex) Object.assign(ex, { texto: h.texto, rdoIds: h.rdoIds, local: h.local, parada: h.parada, atualizadoEm: today() }); else S.apontamentos.push({ id: uid('ap'), ...h }); });
  save(); return { novos, mesclados, iguais };
}
let aptDraft = [];
function aptRender() {
  const el = $('#aptPrev'); if (!el) return;
  el.innerHTML = aptDraft.map((a, i) => { if (a.parada) return `<div class="card" style="margin:8px 0;padding:12px"><b>${a.obraId ? esc(obraNome(a.obraId)) : '<span class="bad">obra não encontrada</span>'}</b> <span class="pill r">OBRA PARADA</span> ${fdate(a.ini)} a ${fdate(a.fim)} — não gera RDO e não é cobrada na cobertura.</div>`; const ex = S.rdos.find(x => x.obraId === a.obraId && x.data === a.data && x.status === 'salvo');
    return `<div class="card" style="margin:8px 0;padding:12px"><div class="row sp"><b>${a.obraId ? esc(obraNome(a.obraId)) : '<span class="bad">obra não encontrada</span>'} · ${fdate(a.data)}</b>${ex ? '<span class="pill a">já existe RDO — será mesclado</span>' : '<span class="pill g">novo RDO</span>'}</div>
    <div class="grid g3" style="gap:8px;margin-top:8px"><div><label class="mono">Obra</label><br><select data-apt="${i}:obraId"><option value="">— escolher —</option>${S.obras.map(o => `<option value="${o.id}" ${o.id === a.obraId ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></div><div><label class="mono">Data</label><br><input type="date" data-apt="${i}:data" value="${a.data}"></div><div><label class="mono">Local / encarregado</label><br>${esc(a.local || '—')} · ${esc(a.encarregado || '—')}</div></div>
    <div style="margin-top:8px"><span class="mono">Presentes (${a.presentes.length})</span><br>${a.presentes.map(p => `<span class="pill ${p.func ? 'b' : 'r'}" title="${p.func ? 'cadastrado: ' + esc(p.func.nomeCompleto || p.func.nome) : 'não encontrado no cadastro'}">${esc(p.func ? p.func.nome : p.nome)}${p.cargo ? ' · ' + esc(p.cargo) : ''}</span>`).join(' ') || '—'}</div>
    <div style="margin-top:6px"><span class="mono">Equipamentos</span> ${esc(a.equipamentos.join(', ') || '—')}</div><div style="margin-top:6px"><span class="mono">Serviço / quantitativo</span> ${esc(a.servicos.join(' · ') || '—')} ${a.fases.map(f => `<span class="pill">${nfmt(f.qtd)} ${f.un}${f.faseId ? ' · ' + esc((S.fases.find(x => x.id === f.faseId) || {}).nome || '') : ''}</span>`).join(' ')}</div>${a.obs ? `<div style="margin-top:6px"><span class="mono">Observações</span> ${esc(a.obs)}</div>` : ''}</div>`; }).join('') || '<p class="sub">Nada interpretado ainda.</p>';
}
function aptOpen() {
  aptDraft = [];
  modal(`<h2>Colar apontamento do campo</h2><p class="sub">Formato: <code>Apontamento: OBRA: … | DATA: …</code> com 1) LOCAL, 2) EQUIPE DO DIA (Encarregado / Presentes), 3) EQUIPAMENTO E MÁQUINAS, 4) serviço + quantitativo, 5) OBSERVAÇÕES. Pode colar vários; apontamentos da mesma obra e dia viram <b>um único RDO</b> (sem duplicar pessoas nem serviços).</p><textarea id="aptTxt"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-apt-go="parse">Interpretar</button></div><div id="aptPrev"></div><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-apt-go="save">Gravar no RDO</button></div>`);
}
EXT.click.push(async e => {
  const b = e.target.closest('[data-apt-go]'); if (!b) return false;
  if (b.dataset.aptGo === 'parse') { aptDraft = parseApontamento($('#aptTxt').value).map(aptResolve); if (!aptDraft.length) return alert('Não encontrei “Apontamento: OBRA: … | DATA: …”.'), true; aptRender(); }
  else if (b.dataset.aptGo === 'save') { if (!aptDraft.length) return alert('Interprete o texto primeiro.'), true; const falt = aptDraft.filter(a => !a.obraId); if (falt.length) return alert('Escolha a obra de todos os apontamentos.'), true; const r = aptMesclar(aptDraft); closeModal(); render(); alert(`${r.novos} RDO(s) novo(s), ${r.mesclados} atualizado(s), ${r.iguais} já estava(m) igual(is).`); }
  else if (b.dataset.aptGo === 'open') aptOpen();
  return true;
});
EXT.change.push(async e => { const t = e.target; if (!t.dataset.apt) return false; const [i, k] = t.dataset.apt.split(':'); aptDraft[+i][k] = t.value; aptResolve(aptDraft[+i]); aptRender(); return true; });

/* ---------- histórico de apontamentos (Produção › Apontamentos) ---------- */
function aptHistView() {
  const lista = (S.apontamentos || []).slice().sort((a, b) => (b.ini + b.fim).localeCompare(a.ini + a.fim)), of = tab.apo || 'all';
  const fl = lista.filter(a => of === 'all' || a.obraId === of);
  const k = (t, v, s) => `<div class="card kpi" style="margin:0;padding:16px"><div class="mono">${t}</div><div class="v" style="font-size:26px">${v}</div><small class="sub">${s}</small></div>`;
  const obras = [...new Set(lista.map(a => a.obraId))];
  const cards = fl.map(a => { const rs = (a.rdoIds || []).map(id => S.rdos.find(r => r.id === id)).filter(Boolean).sort((x, y) => x.data.localeCompare(y.data)), m2 = rs.reduce((t, r) => t + rdoCalc(r).m2, 0);
    return `<div class="card" style="margin:0"><div class="row sp"><div><i class="sw" style="border-color:${obraCor(a.obraId)};background:${obraCor(a.obraId)}"></i><b style="font-size:16px">${esc(obraNome(a.obraId))}</b><small style="display:block;color:var(--mut)">${fdate(a.ini)} a ${fdate(a.fim)}${a.local ? ' · ' + esc(a.local) : ''} · enviado em ${fdate(a.enviadoEm)}${a.atualizadoEm ? ' · atualizado ' + fdate(a.atualizadoEm) : ''}</small></div>${a.parada ? '<span class="pill r">OBRA PARADA</span>' : `<span class="pill g">${rs.length} RDO(s) · ${nfmt(m2)} m²</span>`}</div>
    ${rs.length ? `<div class="row" style="gap:6px;margin-top:8px">${rs.map(r => `<button class="btn sm" data-cv="open:${r.id}">${fdate(r.data).slice(0, 5)} · ${(r.maoObra || []).length} pessoa(s)</button>`).join('')}</div>` : ''}
    <details style="margin-top:8px"><summary class="sub" style="cursor:pointer">Texto original recebido</summary><pre style="white-space:pre-wrap;font-size:12.5px;background:var(--soft);padding:10px;border-radius:10px;margin:6px 0 0">${esc(a.texto)}</pre></details></div>`; }).join('');
  return `<div class="grid g4" style="margin-bottom:14px">${k('Apontamentos guardados', lista.length, 'histórico do que o campo enviou')}${k('Obras com apontamento', obras.length, 'no histórico')}${k('Última entrega', lista.length ? fdate(lista.map(a => a.fim).sort().pop()) : '—', 'fim do último período')}${k('RDOs gerados', lista.reduce((t, a) => t + (a.rdoIds || []).length, 0), 'um por obra e dia')}</div>
  <div class="row" style="margin-bottom:12px"><label class="mono">Obra</label><select data-apo="1"><option value="all">Todas</option>${obras.map(o => `<option value="${o}" ${o === of ? 'selected' : ''}>${esc(obraNome(o))}</option>`).join('')}</select><span class="sub" style="margin:0">Cada apontamento colado vira RDO por dia e fica aqui com o texto original; reenviar o mesmo período atualiza.</span></div>
  <div class="dgrid" style="grid-template-columns:repeat(auto-fill,minmax(440px,1fr))">${cards || '<div class="card">Nenhum apontamento guardado.</div>'}</div>`;
}
EXT.change.push(async e => { const t = e.target; if (!t.dataset || !t.dataset.apo) return false; tab.apo = t.value; render(); return true; });
