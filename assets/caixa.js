/* Caixinha / Linha direta: compras diretas com NF, cupom ou comprovante (aba dentro de Compras e orçamentos). */
'use strict';
const CX_TIPOS = ['Compra direta', 'Combustível', 'Pix / Reembolso', 'Outro'];
const CX_DOCS = ['NF-e', 'NFC-e', 'Comprovante Pix', 'Outro documento', 'Sem documento'];
const cxState = { rows: [], files: [] };
const cxArr = () => (S.caixinha = S.caixinha || []);
const cxVal = r => (r.valorPago ?? r.valorDoc ?? r.valorTexto ?? 0);
const cxDay = iso => Math.round(new Date(iso + 'T12:00:00Z') / 864e5);
const cxNum = v => (v === '' || v == null ? null : (typeof v === 'number' ? v : parseBR(v)));

function cxChave(r) {
  const digits = String(r.docChave || '').replace(/\D/g, '');
  if (digits.length === 44) return 'ck|' + digits;
  if (r.docNumero) return `nf|${norm(r.fornecedor)}|${String(r.docNumero).replace(/\D/g, '')}|${r.docSerie || ''}`;
  if (r.pixId) return 'px|' + r.pixId;
  return `tx|${r.data}|${(cxVal(r) || 0).toFixed(2)}|${norm(r.fornecedor)}|${norm(r.descricao || '').slice(0, 40)}`;
}
// já existe? mesma chave, ou mesmo fornecedor + valor + data a até 2 dias (texto sem NF × NF depois)
const GENERICOS = ['abastecimento', 'compra avulsa'];
function cxFind(r) {
  const ch = cxChave(r);
  return cxArr().find(x => x.chave === ch || (r.docNumero && x.docNumero && x.docNumero === r.docNumero && norm(x.fornecedor) === norm(r.fornecedor))
    || (norm(x.fornecedor) === norm(r.fornecedor) && Math.abs(cxVal(x) - cxVal(r)) < 0.015 && Math.abs(cxDay(x.data) - cxDay(r.data)) <= 2 && cxVal(r) > 0)
    // texto genérico ("Abastecimento", "Compra avulsa") × lançamento já detalhado: mesmo dia e tipo/valor
    || (GENERICOS.includes(norm(r.fornecedor)) && x.data === r.data && x.tipo === r.tipo && (cxVal(r) > 0 ? Math.abs(cxVal(x) - cxVal(r)) < 0.015 : r.tipo === 'Combustível'))
    || (GENERICOS.includes(norm(r.fornecedor)) && x.data === r.data && cxVal(r) > 0 && Math.abs(cxVal(x) - cxVal(r)) < 0.015)) || null;
}
function cxFlags(r) {
  const f = [];
  if (r.valorTexto != null && r.valorDoc != null && Math.abs(r.valorTexto - r.valorDoc) > 0.015) f.push(['r', `Texto ${brl(r.valorTexto)} ≠ documento ${brl(r.valorDoc)}`]);
  if (r.valorTexto == null && r.valorDoc != null) f.push(['a', 'Texto sem valor — usado o do documento']);
  if (r.dataDoc && r.dataDoc !== r.data) f.push(['a', `Documento emitido em ${fdate(r.dataDoc)} (lançado em ${fdate(r.data)})`]);
  if (!r.docTipo || r.docTipo === 'Sem documento') f.push(['r', 'Sem documento']);
  else if (r.docTipo === 'Comprovante Pix') f.push(['a', 'Comprovante Pix, sem NF']);
  if (r.alerta) f.push(['a', r.alerta]);
  return f;
}
// custo por obra (rateio); sem obra = Geral / Frota
function cxPorObra(list) {
  const m = {};
  list.forEach(r => { const v = cxVal(r), os = (r.obras && r.obras.length) ? r.obras : [{ obraId: '', valor: v }]; os.forEach(o => { m[o.obraId] = (m[o.obraId] || 0) + (o.valor ?? v / os.length); }); });
  return m;
}
const cxNomeObra = id => (id ? short(obraNome(id)) : 'Geral / Frota');
const cxMeses = () => [...new Set(cxArr().map(r => r.data.slice(0, 7)))].sort();

function cxView() {
  const all = cxArr(), meses = cxMeses();
  if (!all.length) return `<div class="card"><p class="sub">Nenhum lançamento ainda. Clique em “Novo lançamento” para colar o texto do grupo e anexar as fotos.</p></div>`;
  const mes = tab.cxm && meses.includes(tab.cxm) ? tab.cxm : meses[meses.length - 1];
  const list = all.filter(r => r.data.startsWith(mes) && (obraF === 'all' || (r.obras || []).some(o => o.obraId === obraF))).sort((a, b) => b.data.localeCompare(a.data));
  const total = list.reduce((a, r) => a + cxVal(r), 0), po = cxPorObra(list), pt = {}, pf = {};
  list.forEach(r => { pt[r.tipo] = (pt[r.tipo] || 0) + cxVal(r); pf[r.fornecedor] = (pf[r.fornecedor] || 0) + cxVal(r); });
  const bar = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="row sp" style="padding:3px 0;border-bottom:1px solid var(--line)"><span>${esc(k ? k(n) : n)}</span><b>${brl(v)}</b></div>`).join('');
  const rows = list.map(r => { const fl = cxFlags(r); return `<tr><td>${fdate(r.data)}</td><td><b>${esc(r.fornecedor)}</b><small style="display:block;color:var(--mut)">${esc(r.tipo)}</small></td><td>${esc(r.descricao)}${r.solicitante ? `<small style="display:block;color:var(--mut)">${esc(r.solicitante)}</small>` : ''}</td><td>${(r.obras || []).map(o => esc(cxNomeObra(o.obraId))).join(' + ') || 'Geral / Frota'}</td><td class="n"><b>${brl(cxVal(r))}</b></td><td>${esc(r.docTipo || '—')}${r.docNumero ? ` <small style="color:var(--mut)">nº ${esc(r.docNumero)}</small>` : ''}${(r.anexos || []).length ? ` 📎${r.anexos.length}` : ''}</td><td>${fl.length ? fl.map(x => `<span class="pill ${x[0]}" title="${esc(x[1])}">${x[0] === 'r' ? '!' : '•'}</span>`).join(' ') : '<span class="pill g">ok</span>'}</td><td><button class="btn sm" data-cxd="${r.id}">Abrir</button></td></tr>`; }).join('');
  return `<div class="tabs">${meses.map(m => `<button data-cxm="${m}" class="${m === mes ? 'on' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</button>`).join('')}</div>
  <div class="grid g3" style="margin-bottom:14px"><div class="card" style="margin:0"><div class="mono">Total do mês</div><div class="kpi"><div class="v">${brl(total)}</div></div><small class="sub">${list.length} lançamento(s)</small></div><div class="card" style="margin:0"><div class="mono">Por obra (com rateio)</div>${bar(po, cxNomeObra)}</div><div class="card" style="margin:0"><div class="mono">Por tipo</div>${bar(pt)}<div class="mono" style="margin-top:8px">Por fornecedor</div>${bar(pf)}</div></div>
  <div class="card tw"><table><tr><th>Data</th><th>Fornecedor</th><th>Descrição</th><th>Obra(s)</th><th class="n">Valor</th><th>Documento</th><th>Conferência</th><th></th></tr>${rows || '<tr><td colspan="8">Nada neste filtro.</td></tr>'}</table><p class="sub" style="margin-top:8px">Esta aba é separada das compras de orçamento: não entra no total de compras nem nos boletos.</p></div>`;
}
CAD.cx = cxView;

function cxCard() {
  const all = cxArr(); if (!all.length) return '';
  const m = today().slice(0, 7), list = all.filter(r => r.data.startsWith(m)), mm = list.length ? m : cxMeses().pop(), l2 = all.filter(r => r.data.startsWith(mm));
  const t = l2.reduce((a, r) => a + cxVal(r), 0), prob = l2.filter(r => cxFlags(r).some(f => f[0] === 'r')).length;
  return `<div class="card"><div class="mono">Caixinha · ${MESES[+mm.slice(5) - 1]}/${mm.slice(0, 4)}</div><div class="kpi"><div class="v">${brl(t)}</div></div><small class="sub">${l2.length} compras diretas${prob ? ` · <span class="bad">${prob} com pendência</span>` : ''}</small> <button class="btn sm" data-nav="compras" data-goto-cx="1">Ver</button></div>`;
}
function cxObrasCard() {
  const all = cxArr(); if (!all.length) return '';
  const po = cxPorObra(all);
  return `<div class="card"><h2>Caixinha — custo por obra</h2><div class="tw"><table>${Object.entries(po).sort((a, b) => b[1] - a[1]).map(([o, v]) => `<tr><td>${esc(cxNomeObra(o))}</td><td class="n">${brl(v)}</td></tr>`).join('')}</table></div></div>`;
}

/* ---------- parser do texto do grupo ---------- */
function cxParseTexto(txt, anoPad) {
  const out = []; let data = null, cur = null;
  const fim = () => { if (cur) { out.push(cur); cur = null; } };
  for (const raw of txt.split('\n')) {
    const l = raw.trim(); if (!l) continue; let m;
    if ((m = l.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*:?\s*$/))) { fim(); const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : anoPad; data = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; continue; }
    if (!data) continue;
    if ((m = l.match(/^([a-z])\)\s*(.+)$/i))) {
      fim(); const h = m[2].trim();
      if (/^vou adicionar mais/i.test(h)) { out.lembrete = true; continue; }
      cur = { data, tipo: 'Outro', fornecedor: '', descricao: '', solicitante: '', obrasTxt: '', valorTexto: null, docTipo: 'Sem documento', docNumero: '', docSerie: '', docChave: '', valorDoc: null, valorPago: null, dataDoc: '', anexo: -1, original: h };
      let hm;
      if ((hm = h.match(/^compra direta\s*[-–—]\s*(.+)$/i))) { cur.tipo = 'Compra direta'; cur.fornecedor = hm[1].trim(); }
      else if (/^abastec/i.test(h)) { cur.tipo = 'Combustível'; cur.fornecedor = 'Abastecimento'; cur.descricao = h; }
      else if ((hm = h.match(/^(.+?)\s*[-–—]\s*([A-ZÀ-Ú0-9 ,.]+)$/)) ) { cur.descricao = hm[1].trim(); cur.obrasTxt = hm[2].trim(); cur.tipo = /compra|tambor|pix/i.test(hm[1]) ? 'Pix / Reembolso' : 'Outro'; cur.fornecedor = 'Compra avulsa'; }
      else { cur.descricao = h; cur.fornecedor = h; }
      continue;
    }
    if (!cur) continue;
    if ((m = l.match(/^valor\s*:?\s*(?:R\$)?\s*([\d.,]+)/i))) { cur.valorTexto = parseBR(m[1]); continue; }
    // linha de descrição: "Item - Solicitado pelo X para Obra" | "Item - OBRA" | "Item - PESSOA"
    const k = l.lastIndexOf(' - '); let item = l, resto = '';
    if (k > 0) { item = l.slice(0, k).trim(); resto = l.slice(k + 3).trim(); }
    cur.descricao = cur.descricao && cur.descricao !== cur.original ? cur.descricao + '; ' + item : item;
    if (resto) {
      const s = resto.match(/solicitad[oa] pel[oa]\s+(.+?)(?:\s+para\s+(.+))?$/i);
      if (s) { cur.solicitante = s[1].trim(); if (s[2]) cur.obrasTxt = s[2].trim(); }
      else if (findObra(resto.split(/ e |,/)[0])) cur.obrasTxt = resto;
      else cur.solicitante = resto;
    }
  }
  fim(); out.forEach(r => cxResolve(r)); return out;
}
function cxResolve(r) {
  const nomes = (r.obrasTxt || '').split(/\s+e\s+|,|\+/i).map(s => s.trim()).filter(Boolean);
  r.obraIds = nomes.map(n => (findObra(n) || {}).id).filter(Boolean);
  r.obraNaoEncontrada = nomes.filter(n => !findObra(n));
  if (r.solicitante) { const f = findFunc(r.solicitante); if (f) r.solicitante = f.nome; }
  return r;
}
function cxBuild(r) {
  const v = cxVal(r), ids = [...new Set(r.obraIds || [])];
  return { id: uid('cx'), data: r.data, dataDoc: r.dataDoc || '', tipo: r.tipo, fornecedor: r.fornecedor, descricao: r.descricao, itens: r.itens || [], obras: ids.map(i => ({ obraId: i, valor: Math.round(v / ids.length * 100) / 100 })), solicitante: r.solicitante || '', valorTexto: r.valorTexto, valorDoc: r.valorDoc, valorPago: r.valorPago, formaPgto: r.formaPgto || '', docTipo: r.docTipo, docNumero: r.docNumero || '', docSerie: r.docSerie || '', docChave: r.docChave || '', pixId: r.pixId || '', anexos: r.anexos || [], estoque: false, origem: 'app', obs: r.obs || '' };
}

/* ---------- modal de lançamento ---------- */
function cxRowHtml(r, i) {
  const ex = cxFind({ ...r, obras: [], fornecedor: r.fornecedor, data: r.data });
  return `<div class="card" style="margin:8px 0;padding:12px" data-cxrow="${i}"><div class="row sp"><b>${ex ? `<span class="pill a">Já existe — será mesclado (${esc(ex.fornecedor)} ${brl(cxVal(ex))})</span>` : '<span class="pill g">Novo</span>'}</b><label class="row"><input type="checkbox" data-cxk="${i}:ok" ${r.ignorar ? '' : 'checked'}> gravar</label></div>
  <div class="grid g3" style="grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px"><div><label class="mono">Data</label><input type="date" data-cxk="${i}:data" value="${r.data}"></div><div><label class="mono">Tipo</label><select data-cxk="${i}:tipo">${CX_TIPOS.map(t => `<option ${t === r.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label class="mono">Fornecedor</label><input data-cxk="${i}:fornecedor" value="${esc(r.fornecedor)}"></div>
  <div style="grid-column:1/-1"><label class="mono">Descrição</label><input data-cxk="${i}:descricao" value="${esc(r.descricao)}" style="width:100%"></div>
  <div><label class="mono">Obra(s) — separe por “e”</label><input data-cxk="${i}:obrasTxt" value="${esc(r.obrasTxt || '')}">${r.obraNaoEncontrada && r.obraNaoEncontrada.length ? `<small class="bad">não cadastrada: ${esc(r.obraNaoEncontrada.join(', '))}</small>` : ''}</div><div><label class="mono">Solicitante</label><input data-cxk="${i}:solicitante" value="${esc(r.solicitante || '')}"></div><div><label class="mono">Valor do texto (R$)</label><input data-cxk="${i}:valorTexto" value="${r.valorTexto == null ? '' : String(r.valorTexto).replace('.', ',')}"></div>
  <div><label class="mono">Documento</label><select data-cxk="${i}:docTipo">${CX_DOCS.map(t => `<option ${t === r.docTipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label class="mono">Nº do documento</label><input data-cxk="${i}:docNumero" value="${esc(r.docNumero || '')}"></div><div><label class="mono">Valor do documento (R$)</label><input data-cxk="${i}:valorDoc" value="${r.valorDoc == null ? '' : String(r.valorDoc).replace('.', ',')}"></div>
  <div style="grid-column:1/-1"><label class="mono">Imagem anexa</label><select data-cxk="${i}:anexo"><option value="-1">— nenhuma —</option>${cxState.files.map((f, j) => `<option value="${j}" ${r.anexo === j ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div></div>`;
}
function cxDraw() { const el = $('#cxRows'); if (el) el.innerHTML = cxState.rows.map(cxRowHtml).join('') || '<p class="sub">Nada interpretado ainda.</p>'; const fl = $('#cxFiles'); if (fl) fl.innerHTML = cxState.files.map(f => `<span class="pill b">📎 ${esc(f.name)}</span>`).join(' ') || '<small class="sub">Nenhuma imagem escolhida.</small>'; }
function cxOpen() {
  cxState.rows = []; cxState.files = [];
  modal(`<h2>Novo lançamento — Caixinha / Linha direta</h2><label>1. Cole o texto do grupo (data, “a) Compra direta - Fornecedor”, descrição, “Valor:”)</label><textarea id="cxTxt" placeholder="21/10:&#10;a) Compra direta - CONDOR&#10;Rolos - Solicitado pelo Sr Bené para Supera&#10;Valor: 212,16"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-cx="parse">Interpretar texto</button><button class="btn" data-cx="addrow">+ lançamento manual</button></div>
  <label style="margin-top:12px">2. Imagens ou PDF das notas, cupons e comprovantes</label><label class="dz" style="display:block;cursor:pointer">Clique para escolher (várias) — depois ligue cada imagem a um lançamento<input type="file" id="cxFile" accept="image/*,application/pdf" multiple hidden></label><div id="cxFiles" class="row" style="margin-top:6px"></div>
  <div id="cxRows"></div><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-cx="save">Gravar lançamentos</button></div>`);
  cxDraw();
}
function cxSyncRows() {
  document.querySelectorAll('[data-cxk]').forEach(el => {
    const [i, k] = el.dataset.cxk.split(':'), r = cxState.rows[+i]; if (!r) return;
    if (k === 'ok') r.ignorar = !el.checked;
    else if (k === 'anexo') r.anexo = +el.value;
    else if (k === 'valorTexto' || k === 'valorDoc') r[k] = el.value.trim() === '' ? null : cxNum(el.value);
    else r[k] = el.value;
  });
  cxState.rows.forEach(cxResolve);
}
async function cxSave() {
  cxSyncRows(); const rows = cxState.rows.filter(r => !r.ignorar); if (!rows.length) return alert('Nada para gravar.');
  const falta = rows.find(r => !cxFind(cxBuild(r)) && (!r.fornecedor || !r.data || !(cxVal(r) > 0))); if (falta) return alert('Preencha data, fornecedor e ao menos um valor em todos os lançamentos.');
  let n = 0, m = 0; const up = {};
  for (const r of rows) {
    const novo = cxBuild(r);
    if (r.anexo >= 0 && cxState.files[r.anexo]) { const f = cxState.files[r.anexo]; up[r.anexo] = up[r.anexo] || await putFile(f); novo.anexos = [up[r.anexo]]; }
    const ex = cxFind(novo);
    if (ex) { // mescla sem apagar nada
      ['dataDoc', 'docNumero', 'docSerie', 'docChave', 'solicitante', 'obs'].forEach(k => { if (!ex[k] && novo[k]) ex[k] = novo[k]; });
      if (ex.valorDoc == null && novo.valorDoc != null) ex.valorDoc = novo.valorDoc; if (ex.valorTexto == null && novo.valorTexto != null) ex.valorTexto = novo.valorTexto;
      if (ex.docTipo === 'Sem documento' && novo.docTipo !== 'Sem documento') ex.docTipo = novo.docTipo;
      if ((!ex.obras || !ex.obras.length) && novo.obras.length) ex.obras = novo.obras;
      novo.anexos.forEach(a => { if (!(ex.anexos || []).some(x => x.name === a.name)) (ex.anexos = ex.anexos || []).push(a); });
      ex.chave = cxChave(ex); m++;
    } else { novo.chave = cxChave(novo); cxArr().push(novo); n++; }
  }
  save(); closeModal(); render(); alert(`${n} novo(s), ${m} já existia(m) e foi(ram) mesclado(s).`);
}
function cxDetail(id) {
  const r = cxArr().find(x => x.id === id); if (!r) return; const fl = cxFlags(r);
  modal(`<h2>${esc(r.fornecedor)} · ${brl(cxVal(r))}</h2><p><span class="pill">${esc(r.tipo)}</span> ${fdate(r.data)}</p><p>${esc(r.descricao)}</p><p class="sub">Obra(s): ${(r.obras || []).map(o => `${esc(cxNomeObra(o.obraId))} ${brl(o.valor)}`).join(' + ') || 'Geral / Frota'}${r.solicitante ? ' · solicitante: ' + esc(r.solicitante) : ''}</p>
  <p class="sub">Documento: ${esc(r.docTipo || '—')}${r.docNumero ? ' nº ' + esc(r.docNumero) : ''}${r.docSerie ? ' série ' + esc(r.docSerie) : ''}${r.dataDoc ? ' · emitido em ' + fdate(r.dataDoc) : ''}${r.docChave ? `<br>Chave: <span class="mono">${esc(r.docChave)}</span>` : ''}${r.pixId ? `<br>ID Pix: <span class="mono">${esc(r.pixId)}</span>` : ''}</p>
  <p class="sub">Valor no texto: ${r.valorTexto == null ? '—' : brl(r.valorTexto)} · no documento: ${r.valorDoc == null ? '—' : brl(r.valorDoc)}${r.valorPago != null ? ' · pago: ' + brl(r.valorPago) : ''}</p>${(r.itens || []).length ? `<ul>${r.itens.map(i => `<li>${esc(i.qtd)} ${esc(i.un)} ${esc(i.desc)}${i.vUnit ? ' × ' + brl(i.vUnit) : ''}</li>`).join('')}</ul>` : ''}
  ${fl.map(x => `<div class="alert" style="margin:6px 0">${esc(x[1])}</div>`).join('')}${r.obs ? `<p class="sub">${esc(r.obs)}</p>` : ''}
  <div class="row" style="margin:10px 0">${(r.anexos || []).map(a => `<button class="btn sm" data-open="${esc(a.id)}">📎 ${esc(a.name)}</button>`).join('') || '<small class="sub">Sem anexos.</small>'}</div>
  ${(r.anexos || []).filter(a => String(a.id).startsWith('url:') && /\.(jpe?g|png|webp)$/i.test(a.id)).map(a => `<img src="${esc(a.id.slice(4))}" style="max-width:100%;border-radius:12px;margin-bottom:8px" alt="">`).join('')}
  <div class="row sp" style="margin-top:12px"><button class="btn" data-act="close">Fechar</button><div class="row"><label class="btn sm">Anexar imagem<input type="file" accept="image/*,application/pdf" hidden data-cxatt="${r.id}"></label><button class="btn sm" data-cx="del:${r.id}">Excluir</button></div></div>`);
}

EXT.click.push(async e => {
  const gcx = e.target.closest('[data-goto-cx]'); if (gcx) { tab.c = 'cx'; return false; }
  const m = e.target.closest('[data-cxm]'); if (m) { tab.cxm = m.dataset.cxm; render(); return true; }
  const d = e.target.closest('[data-cxd]'); if (d) { cxDetail(d.dataset.cxd); return true; }
  const b = e.target.closest('[data-cx]'); if (!b) return false;
  const [a, id] = b.dataset.cx.split(':');
  if (a === 'new') cxOpen();
  else if (a === 'parse') { cxSyncRows(); const p = cxParseTexto($('#cxTxt').value, today().slice(0, 4)); if (!p.length) return alert('Não reconheci lançamentos. Use “DD/MM:” e “a) Compra direta - Fornecedor”.'), true; cxState.rows = cxState.rows.concat(p); if (p.lembrete) cxState.lembrete = true; cxDraw(); }
  else if (a === 'addrow') { cxSyncRows(); cxState.rows.push(cxResolve({ data: today(), tipo: 'Compra direta', fornecedor: '', descricao: '', solicitante: '', obrasTxt: obraF !== 'all' ? obraNome(obraF) : '', valorTexto: null, docTipo: 'Sem documento', anexo: -1 })); cxDraw(); }
  else if (a === 'save') await cxSave();
  else if (a === 'del') { if (confirm('Excluir este lançamento?')) { S.caixinha = cxArr().filter(x => x.id !== id); save(); closeModal(); render(); } }
  return true;
});
EXT.change.push(async e => {
  const t = e.target;
  if (t.id === 'cxFile') { cxSyncRows(); for (const f of t.files) if (!cxState.files.some(x => x.name === f.name && x.size === f.size)) cxState.files.push(f); cxDraw(); return true; }
  if (t.dataset.cxatt) { const r = cxArr().find(x => x.id === t.dataset.cxatt); for (const f of t.files) { if ((r.anexos || []).some(a => a.name === f.name)) continue; (r.anexos = r.anexos || []).push(await putFile(f)); } save(); cxDetail(r.id); render(); return true; }
  if (t.dataset.cxk) { cxSyncRows(); if (/:(obrasTxt|ok|anexo|valorTexto|valorDoc|fornecedor|data)$/.test(t.dataset.cxk)) cxDraw(); return true; }
  return false;
});
