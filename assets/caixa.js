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
const cxNomeObra = id => (id === 'estoque' ? 'Estoque central' : id ? short(obraNome(id)) : 'Geral / Frota');
const cxMeses = () => [...new Set(cxArr().map(r => r.data.slice(0, 7)))].sort();

function cxFiltros() { tab.cxf = tab.cxf || {}; return tab.cxf; }
function cxFiltrar(all) {
  const f = cxFiltros(), q = norm(f.q || '');
  return all.filter(r => {
    if (f.mes && f.mes !== 'all' && !r.data.startsWith(f.mes)) return false;
    if (f.de && r.data < f.de) return false; if (f.ate && r.data > f.ate) return false;
    const obrasR = (r.obras || []).map(o => o.obraId);
    if (obraF !== 'all' && !obrasR.includes(obraF)) return false;
    if (f.obra && f.obra !== 'all' && !(f.obra === '-' ? !obrasR.length : obrasR.includes(f.obra))) return false;
    if (f.tipo && f.tipo !== 'all' && r.tipo !== f.tipo) return false;
    if (f.forn && f.forn !== 'all' && r.fornecedor !== f.forn) return false;
    if (f.veic && f.veic !== 'all' && (r.veiculo || '') !== f.veic) return false;
    if (f.pgto && f.pgto !== 'all' && (r.formaPgto || '—') !== f.pgto) return false;
    const fl = cxFlags(r);
    if (f.doc === 'sem' && !(r.docTipo === 'Sem documento' || !r.docTipo)) return false;
    if (f.doc === 'com' && (r.docTipo === 'Sem documento' || !r.docTipo)) return false;
    if (f.doc === 'anexo' && !(r.anexos || []).length) return false;
    if (f.doc === 'semanexo' && (r.anexos || []).length) return false;
    if (f.doc === 'pend' && !fl.some(x => x[0] === 'r' || x[0] === 'a')) return false;
    if (f.vmin && cxVal(r) < cxNum(f.vmin)) return false; if (f.vmax && cxVal(r) > cxNum(f.vmax)) return false;
    if (q && !norm([r.fornecedor, r.descricao, r.solicitante, r.veiculo, r.docNumero, r.obs, (r.obras || []).map(o => cxNomeObra(o.obraId)).join(' ')].join(' ')).includes(q)) return false;
    return true;
  });
}
function cxCsv(list) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Data', 'Tipo', 'Fornecedor', 'Descrição', 'Obra(s)', 'Solicitante', 'Veículo', 'Forma pgto', 'Valor', 'Documento', 'Nº doc', 'Anexos', 'Pendências'].map(q).join(';')];
  list.forEach(r => rows.push([fdate(r.data), r.tipo, r.fornecedor, r.descricao, (r.obras || []).map(o => cxNomeObra(o.obraId) + ' ' + o.valor.toFixed(2).replace('.', ',')).join(' + '), r.solicitante, r.veiculo, r.formaPgto, cxVal(r).toFixed(2).replace('.', ','), r.docTipo, r.docNumero, (r.anexos || []).length, cxFlags(r).map(x => x[1]).join(' | ')].map(q).join(';')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'caixinha-' + today() + '.csv'; a.click();
}
function cxView() {
  const all = cxArr(), meses = cxMeses(), f = cxFiltros();
  if (!all.length) return `<div class="card"><p class="sub">Nenhum lançamento ainda. Clique em “Novo lançamento” para colar o texto do grupo e anexar as fotos.</p></div>`;
  if (f.mes === undefined) f.mes = meses[meses.length - 1];
  const list = cxFiltrar(all).sort((a, b) => b.data.localeCompare(a.data));
  const uniq = (fn) => [...new Set(all.map(fn).filter(Boolean))].sort();
  const sel = (k, l, opts, all0 = 'Todos') => `<div><label class="mono">${l}</label><br><select data-cxf="${k}"><option value="all">${all0}</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${f[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const ativos = ['obra', 'tipo', 'forn', 'veic', 'pgto'].filter(k => f[k] && f[k] !== 'all').length + ['doc', 'q', 'de', 'ate', 'vmin', 'vmax'].filter(k => f[k]).length;
  const po = cxPorObra(list), obraSel = obraF !== 'all' ? obraF : (f.obra && f.obra !== 'all' && f.obra !== '-' ? f.obra : null), total = obraSel ? (po[obraSel] || 0) : list.reduce((a, r) => a + cxVal(r), 0), pt = {}, pf = {}, pv = {};
  list.forEach(r => { pt[r.tipo] = (pt[r.tipo] || 0) + cxVal(r); pf[r.fornecedor] = (pf[r.fornecedor] || 0) + cxVal(r); if (r.veiculo) pv[r.veiculo] = (pv[r.veiculo] || 0) + cxVal(r); });
  const bar = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="row sp" style="padding:3px 0;border-bottom:1px solid var(--line)"><span>${esc(k ? k(n) : n)}</span><b>${brl(v)}</b></div>`).join('') || '<small class="sub">—</small>';
  const rows = list.map(r => { const fl = cxFlags(r); return `<tr><td>${fdate(r.data)}</td><td><b>${esc(r.fornecedor)}</b><small style="display:block;color:var(--mut)">${esc(r.tipo)}${r.veiculo ? ' · ' + esc(r.veiculo) : ''}</small></td><td>${esc(r.descricao)}${r.solicitante ? `<small style="display:block;color:var(--mut)">${esc(r.solicitante)}</small>` : ''}</td><td>${(r.obras || []).map(o => esc(cxNomeObra(o.obraId))).join(' + ') || 'Geral / Frota'}</td><td class="n"><b>${brl(cxVal(r))}</b></td><td>${esc(r.docTipo || '—')}${r.docNumero ? ` <small style="color:var(--mut)">nº ${esc(r.docNumero)}</small>` : ''}${(r.anexos || []).length ? ` 📎${r.anexos.length}` : ''}</td><td>${fl.length ? fl.map(x => `<span class="pill ${x[0]}" title="${esc(x[1])}">${x[0] === 'r' ? '!' : '•'}</span>`).join(' ') : '<span class="pill g">ok</span>'}</td><td><button class="btn sm" data-cxd="${r.id}">Abrir</button></td></tr>`; }).join('');
  return `<div class="card" style="margin-bottom:14px"><div class="row sp" style="margin-bottom:8px"><div class="tabs" style="margin:0"><button data-cxf-mes="all" class="${f.mes === 'all' ? 'on' : ''}">Todos</button>${meses.map(m => `<button data-cxf-mes="${m}" class="${f.mes === m ? 'on' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</button>`).join('')}</div><div class="row"><span class="mono">${list.length} de ${all.length} lançamentos</span>${ativos ? '<button class="btn sm" data-cxf-clear="1">Limpar filtros (' + ativos + ')</button>' : ''}<button class="btn sm" data-cxf-csv="1">Exportar CSV</button></div></div>
  <div class="grid g4" style="gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div><label class="mono">Buscar</label><br><input id="cxq" data-cxf="q" placeholder="fornecedor, descrição, NF…" value="${esc(f.q || '')}" style="width:100%"></div>${sel('obra', 'Obra', [['-', 'Sem obra (geral/frota)'], ...S.obras.map(o => [o.id, short(o.nome)]), ['estoque', 'Estoque central']])}${sel('tipo', 'Tipo', CX_TIPOS.map(t => [t, t]))}${sel('forn', 'Fornecedor', uniq(r => r.fornecedor).map(t => [t, t]))}${sel('veic', 'Veículo', uniq(r => r.veiculo).map(t => [t, t]))}${sel('pgto', 'Pagamento', uniq(r => r.formaPgto || '—').map(t => [t, t]))}
  <div><label class="mono">Documento</label><br><select data-cxf="doc"><option value="">Todos</option>${[['sem', 'Sem documento'], ['com', 'Com documento'], ['semanexo', 'Sem imagem anexa'], ['anexo', 'Com imagem anexa'], ['pend', 'Com pendência']].map(([v, t]) => `<option value="${v}" ${f.doc === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label class="mono">De</label><br><input type="date" data-cxf="de" value="${f.de || ''}"></div><div><label class="mono">Até</label><br><input type="date" data-cxf="ate" value="${f.ate || ''}"></div><div><label class="mono">Valor mín.</label><br><input data-cxf="vmin" value="${esc(f.vmin || '')}" style="width:90px"></div><div><label class="mono">Valor máx.</label><br><input data-cxf="vmax" value="${esc(f.vmax || '')}" style="width:90px"></div></div></div>
  <div class="grid g3" style="margin-bottom:14px"><div class="card" style="margin:0"><div class="mono">Total no filtro</div><div class="kpi"><div class="v">${brl(total)}</div></div><small class="sub">${list.length} lançamento(s)${obraSel ? ' · parte desta obra (com rateio)' : list.length ? ' · média ' + brl(total / list.length) : ''}</small></div><div class="card" style="margin:0"><div class="mono">Por obra (com rateio)</div>${bar(po, cxNomeObra)}</div><div class="card" style="margin:0"><div class="mono">Por tipo</div>${bar(pt)}<div class="mono" style="margin-top:8px">Por veículo</div>${bar(pv)}<div class="mono" style="margin-top:8px">Por fornecedor</div>${bar(pf)}</div></div>
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
  const m = e.target.closest('[data-cxf-mes]'); if (m) { cxFiltros().mes = m.dataset.cxfMes; render(); return true; }
  if (e.target.closest('[data-cxf-clear]')) { tab.cxf = { mes: 'all' }; render(); return true; }
  if (e.target.closest('[data-cxf-csv]')) { cxCsv(cxFiltrar(cxArr()).sort((a, b) => b.data.localeCompare(a.data))); return true; }
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


/* ---------- importação em lote de imagens / ZIP, com conferência antes de anexar ---------- */
const cxImg = { items: [], busy: false, ocr: false };
const cxLoadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const t = document.createElement('script'); t.src = src; t.onload = res; t.onerror = () => rej(new Error('Não foi possível carregar ' + src)); document.head.appendChild(t); });
async function cxHash(f) { try { const b = await f.arrayBuffer(); const h = await crypto.subtle.digest('SHA-1', b); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
const cxRowLabel = r => `${fdate(r.data).slice(0, 5)} · ${r.fornecedor.slice(0, 28)} · ${brl(cxVal(r))}${r.docNumero ? ' · NF ' + r.docNumero : ''}`;
const cxIsDup = (name, hash) => cxArr().some(r => (r.anexos || []).some(a => (hash && a.hash === hash) || String(a.name).toLowerCase() === name.toLowerCase() || String(a.id).endsWith('/' + name)));
const GEN_TOK = new Set(['compra', 'direta', 'abastecimento', 'comercial', 'ltda', 'combustiveis', 'combustivel', 'veiculos', 'para', 'pix', 'avulsa', 'informado', 'fornecedor', 'oficina']);
// pontuação: quanto o texto (nome do arquivo + OCR) combina com um lançamento
function cxScore(text, row) {
  const raw = String(text || '').toLowerCase(), t = norm(text || ''), digits = raw.replace(/\D/g, ''), alnum = raw.replace(/[^a-z0-9]/g, '');
  let s = 0; const why = [];
  if (row.docNumero && String(row.docNumero).replace(/\D/g, '').length >= 5 && digits.includes(String(row.docNumero).replace(/\D/g, ''))) { s += 6; why.push('nº da nota'); }
  if (row.docChave && String(row.docChave).length >= 30 && digits.includes(String(row.docChave).slice(6, 26))) { s += 6; why.push('chave de acesso'); }
  if (row.pixId && alnum.includes(String(row.pixId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(-14))) { s += 6; why.push('ID do Pix'); }
  const vals = [...new Set([row.valorTexto, row.valorDoc, row.valorPago].filter(v => v != null && v > 0).map(v => v.toFixed(2)))];
  for (const v of vals) { const br = v.replace('.', ','), us = v; if (raw.includes(br) || raw.includes(us) || digits.includes(v.replace('.', '') + '0') && false) { s += 4; why.push('valor ' + br); break; } }
  const toks = norm(row.fornecedor).split(' ').filter(w => w.length >= 4 && !GEN_TOK.has(w));
  if (toks.some(w => t.includes(w))) { s += 2; why.push('fornecedor'); }
  [row.dataDoc, row.data].filter(Boolean).forEach(d => { const [y, m, dd] = d.split('-'); if (raw.includes(`${dd}/${m}/${y}`) || raw.includes(`${dd}-${m}-${y}`) || raw.includes(`${y}${m}${dd}`) || raw.includes(`${y}-${m}-${dd}`)) { s += 1; if (!why.includes('data')) why.push('data'); } });
  return { s, why };
}
function cxBest(it) {
  const text = it.name + ' ' + (it.ocr || ''); let best = null;
  for (const r of cxArr()) { const sc = cxScore(text, r); if (!best || sc.s > best.s) best = { ...sc, id: r.id }; }
  const second = cxArr().filter(r => r.id !== (best && best.id)).map(r => cxScore(text, r).s).sort((a, b) => b - a)[0] || 0;
  if (best && best.s >= 3 && best.s > second) { it.rowId = best.id; it.score = best.s; it.why = best.why; } else { it.rowId = ''; it.score = best ? best.s : 0; it.why = best ? best.why : []; }
  it.conf = !it.rowId ? 'sem' : it.score >= 8 ? 'alta' : it.score >= 5 ? 'média' : 'baixa';
}
function cxImgOpen() {
  cxImg.items = [];
  modal(`<h2>Importar imagens da Caixinha</h2><p class="sub">Envie várias imagens/PDF ou um <b>.zip</b>. O sistema sugere de qual compra cada imagem é (pelo nome do arquivo e, se você ligar o OCR, pelo texto da foto: nº da nota, valor, fornecedor, chave, Pix). Você confere antes de anexar; arquivos já anexados são ignorados.</p>
  <label class="dz" style="display:block;cursor:pointer">Escolher imagens, PDFs ou ZIP<input type="file" id="cxMulti" accept="image/*,application/pdf,.zip,application/zip" multiple hidden></label>
  <div class="row" style="margin:10px 0"><button class="btn" data-cxi="ocr">Ler textos das imagens (OCR — experimental)</button><span id="cxStat" class="sub" style="margin:0"></span></div><div id="cxImgRows"></div>
  <div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-cxi="apply">Anexar selecionadas</button></div>`);
  cxImgDraw();
}
function cxImgDraw() {
  const el = $('#cxImgRows'); if (!el) return;
  const opts = sel => `<option value="">— sem correspondência —</option>${cxArr().slice().sort((a, b) => b.data.localeCompare(a.data)).map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(cxRowLabel(r))}</option>`).join('')}`;
  el.innerHTML = cxImg.items.length ? `<div class="tw"><table><tr><th></th><th>Imagem</th><th>Compra identificada</th><th>Confiança</th><th>Situação</th></tr>${cxImg.items.map((it, i) => `<tr><td><img src="${it.url}" alt="" style="height:54px;border-radius:6px"></td><td>${esc(it.name)}<small style="display:block;color:var(--mut)">${Math.round(it.file.size / 1024)} KB${it.ocr ? ' · OCR lido' : ''}</small></td><td><select data-cxi-sel="${i}" style="max-width:340px">${opts(it.rowId)}</select><small style="display:block;color:var(--mut)">${esc((it.why || []).join(', '))}</small></td><td><span class="pill ${it.conf === 'alta' ? 'g' : it.conf === 'média' ? 'b' : it.conf === 'baixa' ? 'a' : 'r'}">${it.conf}</span></td><td>${it.dup ? '<span class="pill a">já anexada — ignorar</span>' : it.rowId ? '<span class="pill g">anexar</span>' : '<span class="pill r">escolha a compra</span>'} <label class="row" style="display:inline-flex"><input type="checkbox" data-cxi-ck="${i}" ${it.ok && !it.dup ? 'checked' : ''} ${it.dup ? 'disabled' : ''}> usar</label></td></tr>`).join('')}</table></div>` : '<p class="sub">Nenhuma imagem escolhida.</p>';
}
async function cxImgAdd(files) {
  const st = $('#cxStat'); const list = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      try { if (!window.JSZip) await cxLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); const z = await JSZip.loadAsync(f);
        for (const [n, e] of Object.entries(z.files)) { if (e.dir || /(^|\/)(__MACOSX|\.)/.test(n) || !/\.(jpe?g|png|webp|gif|pdf)$/i.test(n)) continue; const b = await e.async('blob'); const base = n.split('/').pop(); list.push(new File([b], base, { type: /pdf$/i.test(base) ? 'application/pdf' : 'image/' + base.split('.').pop().toLowerCase().replace('jpg', 'jpeg') })); }
      } catch (err) { alert('Não consegui abrir o ZIP: ' + err.message + '. Envie as imagens soltas.'); }
    } else list.push(f);
  }
  for (const f of list) {
    if (cxImg.items.some(x => x.file.name === f.name && x.file.size === f.size)) continue;
    const hash = await cxHash(f), it = { file: f, name: f.name, hash, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : 'assets/logo.svg', ok: true, dup: cxIsDup(f.name, hash), ocr: '' };
    cxBest(it); it.ok = !!it.rowId; cxImg.items.push(it);
  }
  if (st) st.textContent = `${cxImg.items.length} arquivo(s)`; cxImgDraw();
}
async function cxImgOcr() {
  const st = $('#cxStat'); const todo = cxImg.items.filter(i => !i.ocr && i.file.type.startsWith('image/')); if (!todo.length) return alert('Nada para ler.');
  try { st.textContent = 'Carregando OCR…'; await cxLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); const w = await Tesseract.createWorker('por');
    let n = 0; for (const it of todo) { st.textContent = `Lendo ${++n}/${todo.length}…`; const r = await w.recognize(it.file); it.ocr = r.data.text || ''; cxBest(it); it.ok = !!it.rowId; cxImgDraw(); }
    await w.terminate(); st.textContent = 'OCR concluído — confira as sugestões.';
  } catch (e) { st.textContent = ''; alert('OCR indisponível agora (' + e.message + '). Selecione a compra manualmente.'); }
}
async function cxImgApply() {
  const sel = cxImg.items.filter(i => i.ok && !i.dup && i.rowId); if (!sel.length) return alert('Nenhuma imagem selecionada com compra identificada.');
  let n = 0, sk = 0;
  for (const it of sel) { const r = cxArr().find(x => x.id === it.rowId); if (!r || cxIsDup(it.name, it.hash)) { sk++; continue; } const a = await putFile(it.file); a.hash = it.hash; (r.anexos = r.anexos || []).push(a); if (r.docTipo === 'Sem documento') r.docTipo = /pdf$/i.test(it.name) ? 'Outro documento' : r.docTipo; n++; }
  save(); closeModal(); render(); alert(`${n} imagem(ns) anexada(s)${sk ? `, ${sk} ignorada(s) por já existirem` : ''}.`);
}
EXT.click.push(async e => {
  const b = e.target.closest('[data-cxi]'); if (!b) return false; const a = b.dataset.cxi;
  if (a === 'open') cxImgOpen(); else if (a === 'ocr') await cxImgOcr(); else if (a === 'apply') await cxImgApply();
  return true;
});
EXT.change.push(async e => {
  const t = e.target;
  if (t.id === 'cxMulti') { await cxImgAdd([...t.files]); return true; }
  if (t.dataset.cxiSel !== undefined) { const it = cxImg.items[+t.dataset.cxiSel]; it.rowId = t.value; it.ok = !!t.value; it.conf = t.value ? 'manual' : 'sem'; it.why = []; cxImgDraw(); return true; }
  if (t.dataset.cxiCk !== undefined) { cxImg.items[+t.dataset.cxiCk].ok = t.checked; return true; }
  return false;
});

EXT.change.push(async e => { const t = e.target; if (t.dataset.cxf && t.id !== 'cxq') { cxFiltros()[t.dataset.cxf] = t.value; render(); return true; } return false; });
EXT.input.push(e => { const t = e.target; if (t.id === 'cxq') { cxFiltros().q = t.value; const p = t.selectionStart; render(); const n = $('#cxq'); n.focus(); n.setSelectionRange(p, p); return true; } return false; });
