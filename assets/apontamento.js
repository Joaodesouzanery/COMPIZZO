/* Apontamento diário do campo (formato Encarregado/Presentes/Equipamento/Serviço) → RDO, com mesclagem sem duplicar. */
'use strict';
const APT_FASE = [[/lixament/i, 'fa1'], [/trat.*junta|junta.*trinca|check ?list/i, 'fa2'], [/primer/i, 'fa3'], [/raspadinha/i, 'fa5'], [/demarc/i, 'fa7'], [/pintura(?!.*(vaga|demarc))/i, 'fa6']];
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
    const enc = (sc[2].join('\n').match(/encarregado\s*:\s*([^\n]+)/i) || [])[1] || '', pres = (sc[2].join('\n').match(/presentes\s*:\s*([\s\S]*)/i) || [])[1] || '';
    let presentes = aptPresentes(pres.replace(/\n+/g, ' ')); const servicos = [], fases = [];
    for (const l of sc[4]) {
      const ex = aptPresentes(l); if (ex.length && ex.every(p => findFunc(p.nome))) { presentes = presentes.concat(ex); continue; }
      servicos.push(l.replace(/\s+/g, ' '));
    }
    const servTxt = servicos.join(' '), fora = servTxt.replace(/\([^)]*\)/g, ' '), rxq = /(\d+(?:[.,]\d+)?)\s*(m²|m2|m\b|metros|un\b|unid\w*|vagas?)/gi;
    let qm = [...fora.matchAll(rxq)]; if (!qm.length) qm = [...servTxt.matchAll(rxq)];
    qm.forEach(m => { const un = /m²|m2/i.test(m[2]) ? 'm²' : /^m\b|metros/i.test(m[2]) ? 'm' : 'un'; const ctx = ''; const fz = APT_FASE.find(([re]) => re.test(servTxt)); fases.push({ faseId: un === 'm²' && fz ? fz[1] : '', nome: '', qtd: parseBR(m[1]), un, _ctx: ctx }); });
    const equip = sc[3].join(' ').replace(/^[-–—\s]+/, '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1));
    res.push({ obraTxt, data, local: sc[1].join(' '), encarregado: enc, presentes, equipamentos: equip, servicos, fases, obs: sc[5].join(' ') });
  }
  return res;
}
function aptResolve(a) { const o = findObra(a.obraTxt); a.obraId = o ? o.id : ''; a.presentes.forEach(p => { const f = findFunc(p.nome); p.func = f || null; if (f && !p.cargo) p.cargo = f.funcao; }); return a; }
function aptMesclar(list) {
  let novos = 0, mesclados = 0, iguais = 0;
  for (const a of list) {
    if (!a.obraId) continue;
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
  }
  save(); return { novos, mesclados, iguais };
}
let aptDraft = [];
function aptRender() {
  const el = $('#aptPrev'); if (!el) return;
  el.innerHTML = aptDraft.map((a, i) => { const ex = S.rdos.find(x => x.obraId === a.obraId && x.data === a.data && x.status === 'salvo');
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
