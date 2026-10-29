/* Produção e RDO: RDO, metas de produção, metas/calendário e agenda semanal. */
'use strict';
const CLIMAS = ['Sol', 'Nublado', 'Chuva', 'Outros'];
const OCORR = ['Chuva', 'Área não liberada', 'Interferência de terceiros', 'Falta de energia', 'Equipamento com defeito', 'Outros'];
const TCLASS = { 'CHECK LIST / ENTREGA': 'tc', 'PREPARAÇÃO': 'tp', 'PRIMER': 'tr', 'RASPADINHA': 'ts', 'PINTURA PISO': 'tn', 'DEMARCAÇÃO': 'td', 'BARRADO': 'tb', 'MUTIRÃO': 'tm', 'ESCADAS': 'te', 'MANUTENÇÃO': 'tt' };
const TIPO_KW = [['check', 'CHECK LIST / ENTREGA'], ['mutir', 'MUTIRÃO'], ['barrado', 'BARRADO'], ['demarc', 'DEMARCAÇÃO'], ['pintura', 'PINTURA PISO'], ['raspad', 'RASPADINHA'], ['primer', 'PRIMER'], ['lix', 'PREPARAÇÃO'], ['prepara', 'PREPARAÇÃO'], ['manuten', 'MANUTENÇÃO'], ['escada', 'ESCADAS']];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const dowIdx = iso => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
const short = n => (n || '').split(/[—(]/)[0].trim();
const classTipo = s => { const x = (s || '').toLowerCase(); return (TIPO_KW.find(([k]) => x.includes(k)) || [0, 'OUTRO'])[1]; };

/* ---------- regras de produção ---------- */
const getObra = id => S.obras.find(o => o.id === id);
const fasesAtivas = () => S.fases.filter(f => f.ativa !== false);
function precoFase(o, f) {
  if (!o || !f) return null;
  if (o.modoReceita === 'peso') return f.un === 'm²' && o.precoPiso > 0 ? o.precoPiso * f.peso / 100 : null;
  const p = (o.fasePreco || {})[f.id]; return p > 0 ? p : null;
}
const metaDoDia = (obraId, data) => S.metas.filter(m => m.obraId === obraId && m.inicio <= data && data <= m.fim);
function realizadoAcum(obraId, faseId, ini, ate, exceptId) {
  return S.rdos.filter(r => r.status === 'salvo' && r.obraId === obraId && r.id !== exceptId && r.data >= ini && r.data <= ate)
    .reduce((a, r) => a + r.fases.filter(l => l.faseId === faseId).reduce((x, l) => x + (+l.qtd || 0), 0), 0);
}
const diaObra = (o, d) => (o && o.inicio ? Math.max(1, dayDiff(o.inicio, d) + 1) : null);
function rdoCalc(r) {
  const o = getObra(r.obraId); let m2 = 0, receita = 0, semPreco = 0;
  for (const l of r.fases) {
    const q = +l.qtd || 0, f = S.fases.find(x => x.id === l.faseId);
    if (f && f.un === 'm²') m2 += q; else if (!f && (l.un || 'm²') === 'm²') m2 += q;
    if (f && q) { const p = precoFase(o, f); if (p == null) semPreco++; else receita += q * p; }
  }
  const hh = +r.hh || 0, sp = +r.horasSemProd || 0;
  const custo = r.materiais.reduce((a, m) => a + (+m.qtd || 0) * (+m.preco || 0), 0);
  return { m2, receita, semPreco, hh, sp, rup: hh && m2 ? hh / m2 : null, custo, ocH: Object.values(r.ocHoras || {}).reduce((a, v) => a + (+v || 0), 0) };
}
function removeRdoStock(id) {
  S.retiradas = S.retiradas.filter(x => { if (x.rdoId !== id) return true; const m = S.materiais.find(z => z.id === x.materialId); if (m) m.qtd += x.qtd - (x.faltou || 0); return false; });
}
function applyRdoStock(r) {
  removeRdoStock(r.id);
  for (const m of r.materiais) {
    const q = +m.qtd || 0, mat = S.materiais.find(z => z.id === m.materialId); if (!mat || q <= 0) continue;
    const faltou = Math.max(0, q - mat.qtd); mat.qtd = Math.max(0, mat.qtd - q);
    S.retiradas.push({ id: uid('r'), data: r.data, materialId: mat.id, qtd: q, obraId: r.obraId, nomeOriginal: mat.nome, faltou: faltou || undefined, rdoId: r.id, obs: 'RDO' });
  }
}

/* ---------- RDO: estado e formulário ---------- */
let rd = null;
const novoRdo = () => ({ id: uid('rdo'), status: 'rascunho', obraId: obraF !== 'all' ? obraF : (S.obras.find(o => o.status === 'Em andamento') || S.obras[0]).id, data: today(), responsavel: '', clima: '', maoObra: [], fases: [{ faseId: '', nome: '', qtd: '' }], descricao: '', hh: '', horasSemProd: '', motivoSemProd: '', materiais: [], equipamentos: [], ocorrencias: [], ocHoras: {}, obs: '', fotos: [], proximo: '', respNome: '', respData: today() });
function rdSync() {
  if (!rd) return;
  document.querySelectorAll('[data-r]').forEach(el => { rd[el.dataset.r] = el.value; });
  document.querySelectorAll('[data-ra]').forEach(el => {
    const [l, i, k] = el.dataset.ra.split(':'); if (!rd[l][i]) return;
    rd[l][i][k] = el.value;
  });
  document.querySelectorAll('[data-oh]').forEach(el => { rd.ocHoras[el.dataset.oh] = el.value; });
}
function rdoSummary() {
  const c = rdoCalc(rd), o = getObra(rd.obraId);
  return `<div class="grid g4"><div class="kpi"><div class="mono">m² do dia</div><div class="v">${num(c.m2)}</div></div><div class="kpi"><div class="mono">RUP (HH ÷ m²)</div><div class="v">${c.rup == null ? '—' : c.rup.toFixed(2).replace('.', ',')}</div></div><div class="kpi"><div class="mono">Custo de material</div><div class="v">${brl(c.custo)}</div></div><div class="kpi"><div class="mono">Receita estimada</div><div class="v">${brl(c.receita)}</div>${c.semPreco ? `<small class="amb">${c.semPreco} fase(s) sem preço</small>` : ''}</div></div>
  <p class="sub" style="margin:8px 0 0">HH do dia ${num(c.hh)} · sem produção ${num(c.sp)} · HH produtivas ${num(Math.max(0, c.hh - c.sp))}${c.ocH ? ` · horas de ocorrência ${num(c.ocH)}` : ''}${o && o.modoReceita === 'peso' && !(o.precoPiso > 0) ? ' · <span class="amb">defina o preço do piso pronto em Metas de produção</span>' : ''}</p>`;
}
function rdoForm() {
  const o = getObra(rd.obraId), dia = diaObra(o, rd.data), metas = metaDoDia(rd.obraId, rd.data);
  const avail = S.funcionarios.filter(f => f.status !== 'Desligado' && !rd.maoObra.includes(f.nome));
  const fOpts = (sel) => `<option value="">— avulso (fora da meta) —</option>` + fasesAtivas().map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
  const faseRows = rd.fases.map((l, i) => {
    const f = S.fases.find(x => x.id === l.faseId); let metaTxt = '—';
    if (f) { const m = metas.find(x => (x.qtds || {})[f.id]); if (m) { const mq = +m.qtds[f.id], ac = realizadoAcum(rd.obraId, f.id, m.inicio, rd.data, rd.id) + (+l.qtd || 0); metaTxt = `${num(mq)} ${f.un} · acum. ${num(ac)} (${(ac / mq * 100).toFixed(0)}%)`; } else metaTxt = '<span class="amb">sem meta</span>'; }
    return `<tr><td><select data-ra="fases:${i}:faseId" data-struct="1">${fOpts(l.faseId)}</select>${f ? '' : `<input data-ra="fases:${i}:nome" placeholder="serviço avulso" value="${esc(l.nome)}" style="margin-top:4px;width:100%">`}</td><td><input type="number" step="any" min="0" data-ra="fases:${i}:qtd" value="${esc(l.qtd)}" style="width:90px"></td><td>${f ? f.un : '<select data-ra="fases:' + i + ':un"><option>m²</option><option ' + (l.un === 'm' ? 'selected' : '') + '>m</option><option ' + (l.un === 'un' ? 'selected' : '') + '>un</option></select>'}</td><td>${metaTxt}</td><td><button class="btn sm" data-rd="delRow:fases:${i}">✕</button></td></tr>`;
  }).join('');
  const matRows = rd.materiais.map((m, i) => {
    const mat = S.materiais.find(x => x.id === m.materialId);
    return `<tr><td><select data-ra="materiais:${i}:materialId" data-struct="1"><option value="">— fora do estoque —</option>${S.materiais.map(x => `<option value="${x.id}" ${x.id === m.materialId ? 'selected' : ''}>${esc(x.nome)} (${num(x.qtd)})</option>`).join('')}</select>${mat ? '' : `<input data-ra="materiais:${i}:nome" placeholder="material" value="${esc(m.nome)}" style="margin-top:4px;width:100%">`}</td><td><input type="number" step="any" min="0" data-ra="materiais:${i}:qtd" value="${esc(m.qtd)}" style="width:80px"></td><td><input type="number" step="any" min="0" data-ra="materiais:${i}:preco" value="${esc(m.preco)}" style="width:90px"></td><td>${mat ? `<span class="pill g">estoque · saldo ${num(mat.qtd)}</span>` : '<span class="pill a">fora do estoque · será contabilizado</span>'}</td><td><button class="btn sm" data-rd="delRow:materiais:${i}">✕</button></td></tr>`;
  }).join('');
  const metaBox = metas.length ? metas.map(m => `<div class="mono">${fdate(m.inicio)} → ${fdate(m.fim)}</div>`).join('') : `<div class="alert">Esta obra ainda não tem meta cadastrada para ${fdate(rd.data)}. <button class="btn sm" data-rd="goMetas">Criar meta</button></div>`;
  return `${head(rd.status === 'salvo' ? 'RDO' : 'Novo RDO', 'Diário de obra — demarcação e pintura de piso industrial', `<button class="btn" data-rd="fill">Preencher com texto</button><button class="btn" data-rd="print">Imprimir / PDF</button><button class="btn" data-rd="draft">Salvar rascunho</button><button class="btn pri" data-rd="save">Salvar RDO</button><button class="btn ghost" data-rd="back">Voltar</button>`)}
  <div class="card"><h2>Informações gerais</h2><div class="grid g4" style="margin-top:10px"><div><label class="mono">Obra</label><br><select data-r="obraId" data-struct="1" style="width:100%">${S.obras.map(x => `<option value="${x.id}" ${x.id === rd.obraId ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div><div><label class="mono">BAC (faturamento previsto)</label><div class="kpi"><div class="v" style="font-size:20px">${o && o.bac ? brl(o.bac) : '—'}</div></div></div><div><label class="mono">Data</label><br><input type="date" data-r="data" data-struct="1" value="${rd.data}"></div><div><label class="mono">Dia da obra</label><div class="kpi"><div class="v" style="font-size:20px">${dia ? String(dia).padStart(2, '0') : '—'}</div></div></div></div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-top:10px"><div><label class="mono">Responsável</label><br><input data-r="responsavel" list="dlf" value="${esc(rd.responsavel)}" placeholder="funcionário / gestor da obra" style="width:100%"><datalist id="dlf">${S.funcionarios.map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist></div><div><label class="mono">Condições climáticas</label><br><div class="tabs" style="margin:0">${CLIMAS.map(c => `<button data-rd="clima:${c}" class="${rd.clima === c ? 'on' : ''}">${c}</button>`).join('')}</div></div></div></div>
  <div class="card"><h2>Mão de obra (${rd.maoObra.length})</h2><div class="row" style="margin:10px 0">${rd.maoObra.map((n, i) => `<span class="pill b">${esc(n)} <a href="#" data-rd="delRow:maoObra:${i}" style="text-decoration:none">✕</a></span>`).join('') || '<small class="sub" style="margin:0">Ninguém adicionado.</small>'}</div><div class="row"><select id="rdMo"><option value="">— Selecione um funcionário —</option>${avail.map(f => `<option>${esc(f.nome)}</option>`).join('')}</select><button class="btn sm" data-rd="addMo">Adicionar</button><input id="rdMoT" placeholder="Ou digite um nome"><button class="btn sm" data-rd="addMoT">Adicionar</button><button class="btn sm" data-rd="moEquipe">Equipe da obra</button></div></div>
  <div class="card"><h2>Fases do dia</h2><div class="tw"><table><tr><th>Fase / serviço</th><th>Qtd. dia</th><th>Un.</th><th>Meta</th><th></th></tr>${faseRows}</table></div><div class="row sp" style="margin-top:8px"><button class="btn sm" data-rd="addFase">Adicionar fase</button></div><p class="sub" style="margin-top:8px">A linha com fase alimenta a meta de produção da obra. A linha avulsa vale para o dia, mas não entra na meta. Precisa de uma obra selecionada.</p></div>
  <div class="card"><h2>Descrição do que foi executado</h2><textarea data-r="descricao" style="width:100%;font-family:inherit">${esc(rd.descricao)}</textarea>
  <div class="grid g3" style="margin-top:10px"><div><label class="mono">Horas trabalhadas (HH do dia)</label><br><input type="number" step="any" min="0" data-r="hh" value="${esc(rd.hh)}" placeholder="ex.: 40"></div><div><label class="mono">Horas sem produção</label><br><input type="number" step="any" min="0" data-r="horasSemProd" value="${esc(rd.horasSemProd)}" placeholder="ex.: 2"></div><div><label class="mono">O que ocupou essas horas</label><br><input data-r="motivoSemProd" value="${esc(rd.motivoSemProd)}" placeholder="deslocamento, canteiro…" style="width:100%"></div></div><p class="sub" style="margin-top:6px">As horas sem produção saem do rateio do custo por serviço e aparecem à parte.</p></div>
  <div class="card"><h2>Metas de produção</h2>${metaBox}</div>
  <div class="card"><h2>Materiais utilizados</h2><div class="tw"><table><tr><th>Material</th><th>Qtd.</th><th>R$/un</th><th>Origem</th><th></th></tr>${matRows || '<tr><td colspan="5"><small class="sub">Nenhum material.</small></td></tr>'}</table></div><button class="btn sm" data-rd="addMat" style="margin-top:8px">Adicionar material</button><p class="sub" style="margin-top:8px">Materiais do estoque dão baixa no estoque central, vinculada à obra, ao salvar o RDO.</p></div>
  <div class="card"><h2>Equipamentos</h2><div class="row" style="margin:10px 0">${rd.equipamentos.map((n, i) => `<span class="pill">${esc(n)} <a href="#" data-rd="delRow:equipamentos:${i}" style="text-decoration:none">✕</a></span>`).join('') || '<small class="sub" style="margin:0">Nenhum equipamento adicionado.</small>'}</div><div class="row"><input id="rdEq" placeholder="Equipamento"><button class="btn sm" data-rd="addEq">Adicionar equipamento</button></div></div>
  <div class="card"><h2>Ocorrências</h2><div class="tabs" style="margin:10px 0">${['Sem ocorrências', ...OCORR].map(c => `<button data-rd="oc:${c}" class="${(c === 'Sem ocorrências' ? !rd.ocorrencias.length : rd.ocorrencias.includes(c)) ? 'on' : ''}">${c}</button>`).join('')}</div>${rd.ocorrencias.map(c => `<div class="row" style="margin-bottom:6px"><span style="min-width:200px">${c}</span><input type="number" step="any" min="0" data-oh="${c}" value="${esc(rd.ocHoras[c] ?? '')}" placeholder="horas (opcional)" style="width:150px"></div>`).join('')}<p class="sub">As horas são opcionais — em branco significa “aconteceu, não medimos”, e não zero.</p></div>
  <div class="card"><h2>Observações</h2><textarea data-r="obs" style="width:100%;font-family:inherit" placeholder="Descreva as ocorrências do dia...">${esc(rd.obs)}</textarea></div>
  <div class="card"><h2>Registro fotográfico (${rd.fotos.length})</h2><div class="row" style="margin:10px 0">${rd.fotos.map(f => `<button class="btn sm" data-open="${f.id}">📷 ${esc(f.name)}</button>`).join('')}</div><label class="dz" style="display:block;cursor:pointer">Clique para adicionar fotos<input type="file" accept="image/*" multiple hidden data-foto="1"></label></div>
  <div class="card"><h2>Planejamento para o próximo dia</h2><textarea data-r="proximo" style="width:100%;font-family:inherit" placeholder="Dar continuidade aos serviços de demarcação nas áreas já liberadas...">${esc(rd.proximo)}</textarea></div>
  <div class="card"><h2>Responsável pela obra</h2><div class="grid g2" style="grid-template-columns:1fr 1fr"><div><label class="mono">Nome</label><br><input data-r="respNome" list="dlf" value="${esc(rd.respNome)}" style="width:100%"></div><div><label class="mono">Data</label><br><input type="date" data-r="respData" value="${esc(rd.respData)}"></div></div></div>
  <div class="card" id="rsum">${rdoSummary()}</div>`;
}
function rdoList() {
  const list = S.rdos.filter(r => obraF === 'all' || r.obraId === obraF).sort((a, b) => b.data.localeCompare(a.data));
  return `<div class="card tw"><table><tr><th>Data</th><th>Obra</th><th class="n">Dia</th><th class="n">m²</th><th class="n">RUP</th><th>Responsável / equipe</th><th>Status</th><th></th></tr>${list.map(r => { const c = rdoCalc(r), o = getObra(r.obraId); return `<tr><td>${fdate(r.data)}</td><td>${esc(o ? o.nome : '— sem obra —')}${r.importado ? ' <span class="pill">#' + r.numero + '</span>' : ''}</td><td class="n">${r.diaTxt || diaObra(o, r.data) || '—'}</td><td class="n">${num(c.m2)}</td><td class="n">${c.rup == null ? '—' : c.rup.toFixed(2).replace('.', ',')}</td><td>${esc(r.responsavel || '—')}${(r.maoObra || []).length ? `<small style="display:block;color:var(--mut)">${esc(r.maoObra.join(', '))}</small>` : ''}</td><td><span class="pill ${r.status === 'salvo' ? 'g' : 'a'}">${r.status === 'salvo' ? 'Salvo' : 'Rascunho'}</span></td><td><button class="btn sm" data-rd="open:${r.id}">Abrir</button> <button class="btn sm" data-rd="del:${r.id}">Excluir</button></td></tr>`; }).join('') || '<tr><td colspan="8">Nenhum RDO ainda. Clique em “Novo RDO”.</td></tr>'}</table></div>`;
}
function parseRdoTexto(txt) {
  const out = { fases: [], materiais: [] }; let sec = '';
  for (const raw of txt.split('\n')) {
    const l = raw.trim(); if (!l) continue; let m;
    if ((m = l.match(/^(obra|data|respons[aá]vel|clima|m[aã]o de obra|descri[cç][aã]o|hh|horas sem produ[cç][aã]o|observa[cç][oõ]es|planejamento|equipamentos|ocorr[eê]ncias|fases|materiais)[^:]*:\s*(.*)$/i))) {
      const k = norm(m[1]).split(' ')[0], v = m[2].trim(); sec = k;
      if (k === 'obra') out.obra = v; else if (k === 'data') out.data = v; else if (k.startsWith('respons')) out.responsavel = v; else if (k === 'clima') out.clima = v;
      else if (k === 'mao') out.mao = v; else if (k.startsWith('descri')) out.descricao = v; else if (k === 'hh') out.hh = v; else if (k === 'horas') out.sp = v;
      else if (k.startsWith('observ')) out.obs = v; else if (k === 'planejamento') out.proximo = v; else if (k === 'equipamentos') out.eq = v; else if (k.startsWith('ocorr')) out.oc = v;
      continue;
    }
    const li = l.replace(/^[-*•]\s*/, '');
    if (sec === 'fases' && (m = li.match(/^(.+?)[:\s]+([\d.,]+)\s*(m²|m2|m|un)?$/i))) out.fases.push({ nome: m[1].trim(), qtd: parseBR(m[2]), un: m[3] });
    else if (sec === 'materiais' && (m = li.match(/^(.+?)[:\s]+([\d.,]+)\s*(?:un|l|kg|m)?\b/i))) out.materiais.push({ nome: m[1].trim(), qtd: parseBR(m[2]) });
    else if (sec === 'descri' + 'cao' || sec.startsWith('descri')) out.descricao = (out.descricao ? out.descricao + ' ' : '') + li;
    else if (sec.startsWith('observ')) out.obs = (out.obs ? out.obs + ' ' : '') + li;
  }
  return out;
}
function aplicaTexto(p) {
  const o = findObra(p.obra); if (o) rd.obraId = o.id;
  if (p.data) { const m = p.data.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) rd.data = `${m[3]}-${m[2]}-${m[1]}`; }
  if (p.responsavel) { const f = findFunc(p.responsavel); rd.responsavel = f ? f.nome : p.responsavel; }
  if (p.clima) rd.clima = CLIMAS.find(c => norm(c) === norm(p.clima)) || 'Outros';
  if (p.mao) rd.maoObra = [...new Set(p.mao.split(/,| e /).map(s => s.trim()).filter(Boolean).map(n => { const f = findFunc(n); return f ? f.nome : n; }))];
  if (p.descricao) rd.descricao = p.descricao; if (p.hh) rd.hh = parseBR(p.hh); if (p.sp) rd.horasSemProd = parseBR(p.sp);
  if (p.obs) rd.obs = p.obs; if (p.proximo) rd.proximo = p.proximo;
  if (p.eq) rd.equipamentos = p.eq.split(',').map(s => s.trim()).filter(Boolean);
  if (p.oc) rd.ocorrencias = OCORR.filter(c => norm(p.oc).includes(norm(c).split(' ')[0]));
  if (p.fases.length) rd.fases = p.fases.map(f => { const fa = S.fases.find(x => norm(x.nome).includes(norm(f.nome)) || norm(f.nome).includes(norm(x.nome).split(' ')[0]) && norm(f.nome).split(' ')[0] === norm(x.nome).split(' ')[0]); return fa ? { faseId: fa.id, nome: '', qtd: f.qtd } : { faseId: '', nome: f.nome, qtd: f.qtd, un: f.un === 'm2' ? 'm²' : f.un || 'm²' }; });
  if (p.materiais.length) rd.materiais = p.materiais.map(m => { const mt = matchMat(m.nome); return mt ? { materialId: mt.id, nome: '', qtd: m.qtd, preco: '' } : { materialId: '', nome: m.nome, qtd: m.qtd, preco: '' }; });
}

/* ---------- Metas de produção ---------- */
function metasView() {
  const oid = tab.po && getObra(tab.po) ? tab.po : (obraF !== 'all' ? obraF : S.obras[0].id), o = getObra(oid); tab.po = oid;
  const ativas = fasesAtivas(), area = ativas.filter(f => f.un === 'm²'), soma = area.reduce((a, f) => a + (+f.peso || 0), 0);
  const nopeso = ativas.filter(f => f.un !== 'm²'), semPreco = ativas.filter(f => precoFase(o, f) == null);
  const metas = S.metas.filter(m => m.obraId === oid).sort((a, b) => b.inicio.localeCompare(a.inicio));
  return `<div class="row sp" style="margin-bottom:12px"><div class="row"><label class="mono">Obra</label><select data-pobra="1">${S.obras.map(x => `<option value="${x.id}" ${x.id === oid ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div><button class="btn pri" data-pm="newMeta">Nova meta de período</button></div>
  <div class="card"><h2>Como a metragem das fases vira dinheiro</h2><div class="tabs" style="margin:10px 0"><button data-pm="modo:peso" class="${o.modoReceita === 'peso' ? 'on' : ''}">Peso por fase</button><button data-pm="modo:preco" class="${o.modoReceita !== 'peso' ? 'on' : ''}">Preço próprio por fase</button></div>
  <div class="grid g3"><div><label class="mono">BAC (R$)</label><br><input type="number" step="any" data-obf="bac" value="${o.bac || ''}"></div><div><label class="mono">Início da obra</label><br><input type="date" data-obf="inicio" value="${o.inicio || ''}"></div>${o.modoReceita === 'peso' ? `<div><label class="mono">Preço do piso pronto (R$/m²)</label><br><input type="number" step="any" data-obf="precoPiso" value="${o.precoPiso || ''}"></div>` : '<div></div>'}</div>
  ${o.modoReceita === 'peso' ? `<p class="sub" style="margin-top:8px">Cada fase vale a fatia dela do preço do piso pronto. Um m² só vale o preço cheio depois de passar por todas as fases de área.</p>${soma !== 100 ? `<div class="alert">Os pesos das fases de área somam ${soma.toFixed(1)}%, não 100%. ${soma < 100 ? `Faltam ${(100 - soma).toFixed(1)} pontos — a obra inteira valeria menos que o contratado.` : `Passam ${(soma - 100).toFixed(1)} pontos.`}</div>` : '<p class="ok">✓ Pesos de área somam 100%.</p>'}${nopeso.length ? `<p class="sub">${nopeso.map(f => esc(f.nome)).join('; ')} (${[...new Set(nopeso.map(f => f.un))].join('/')}) não é medida em m². No modo “peso” não gera receita — troque para “preço próprio por fase”.</p>` : ''}` : `<p class="sub" style="margin-top:8px">Neste modo o preço é por fase, na unidade dela — o R$/m² da obra não é usado. Necessário com demarcação (metro linear) ou sinalização (unidade).</p>${semPreco.length ? `<div class="alert">${semPreco.length} fase(s) sem preço próprio: ${semPreco.map(f => esc(f.nome)).join(', ')}. Entram na metragem, mas não geram receita.</div>` : ''}`}
  <div class="tw" style="margin-top:12px"><table><tr><th>#</th><th>Fase</th><th>Un.</th><th class="n">Peso %</th><th class="n">R$/un.</th><th>Ativa</th></tr>${S.fases.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.nome)}</td><td>${f.un}</td><td class="n"><input type="number" step="any" data-fp="${f.id}:peso" value="${f.peso}" style="width:80px"></td><td class="n">${o.modoReceita === 'peso' ? (precoFase(o, f) != null ? brl(precoFase(o, f)) : '—') : `<input type="number" step="any" data-fp="${f.id}:preco" value="${(o.fasePreco || {})[f.id] ?? ''}" style="width:90px">`}</td><td><input type="checkbox" data-fp="${f.id}:ativa" ${f.ativa !== false ? 'checked' : ''}></td></tr>`).join('')}</table></div>
  <div class="row" style="margin-top:10px"><input id="nfN" placeholder="Fase (ex.: Polimento)"><select id="nfU"><option>m²</option><option>m</option><option>un</option></select><input id="nfP" type="number" step="any" placeholder="Peso %" style="width:90px"><button class="btn sm" data-pm="addFase">Adicionar fase</button></div><p class="sub">⚠ Acrescentar fase não redistribui os pesos — a soma tem de voltar a 100%.</p></div>
  <div class="card"><h2>Metas de produção — quanto entregar, de tal dia a tal dia</h2>${metas.length ? `<div class="tw"><table><tr><th>Período</th>${ativas.map(f => `<th class="n">${esc(f.nome.split(' ').slice(0, 2).join(' '))} (${f.un})</th>`).join('')}<th></th></tr>${metas.map(m => `<tr><td>${fdate(m.inicio)} → ${fdate(m.fim)}</td>${ativas.map(f => { const q = (m.qtds || {})[f.id]; const ac = realizadoAcum(oid, f.id, m.inicio, m.fim); return `<td class="n">${q ? `${num(q)}<small style="display:block;color:var(--mut)">real. ${num(ac)} (${(ac / q * 100).toFixed(0)}%)</small>` : '—'}</td>`; }).join('')}<td><button class="btn sm" data-pm="delMeta:${m.id}">Excluir</button></td></tr>`).join('')}</table></div>` : '<p class="sub">Nenhuma meta cadastrada. A meta diz quanto se pretende entregar num período — é contra ela que o RDO do dia é comparado.</p>'}</div>`;
}

/* ---------- Metas e Calendário ---------- */
function metaMensalView() {
  const m = S.metaMensal, ld = m.liquidoDesc;
  const rows = m.obras.map(x => {
    const soma = x.itens.reduce((a, i) => a + i.q * i.p, 0), ok = !x.itens.length || Math.abs(soma - x.bruto) < 0.02;
    const liq = x.bruto * (1 - ld.imposto - ld.retencao) - (x.obraId === ld.entradaObra ? ld.entrada : 0), okL = Math.abs(liq - x.liquido) < 0.02;
    return `<tr><td><b>${esc(obraNome(x.obraId))}</b>${x.estimado ? ' <span class="pill a">estimado</span>' : ''}<small style="display:block;color:var(--mut)">${x.itens.map(i => `${num(i.q)} ${i.un} ${esc(i.d)} × ${brl(i.p)}`).join(' · ') || 'sem quantitativo fechado'}</small></td><td class="n">${brl(x.bruto)}${x.itens.length ? `<small style="display:block" class="${ok ? 'ok' : 'bad'}">${ok ? '✓ itens somam ' : '✗ itens somam '}${brl(soma)}</small>` : ''}</td><td class="n">${brl(x.liquido)}<small style="display:block" class="${okL ? 'ok' : 'bad'}">${okL ? '✓ confere' : '✗ cálculo ' + brl(liq)}</small></td></tr>`;
  }).join('');
  const tb = m.obras.reduce((a, x) => a + x.bruto, 0), tl = m.obras.reduce((a, x) => a + x.liquido, 0);
  return `<div class="card"><div class="row sp"><h2>Meta mensal de faturamento e execução</h2><span class="mono">${esc(m.periodo)}</span></div><div class="tw"><table><tr><th>Obra / frente</th><th class="n">Bruto</th><th class="n">Líquido</th></tr>${rows}<tr><td><b>Total do mês</b></td><td class="n"><b>${brl(tb)}</b><small style="display:block" class="${Math.abs(tb - m.totalBruto) < .02 ? 'ok' : 'bad'}">${Math.abs(tb - m.totalBruto) < .02 ? '✓' : '✗'} informado ${brl(m.totalBruto)}</small></td><td class="n"><b>${brl(tl)}</b><small style="display:block" class="${Math.abs(tl - m.totalLiquido) < .02 ? 'ok' : 'bad'}">${Math.abs(tl - m.totalLiquido) < .02 ? '✓' : '✗'} informado ${brl(m.totalLiquido)}</small></td></tr></table></div><p class="sub" style="margin-top:8px">Líquido = bruto − ${ld.imposto * 100}% de impostos − ${ld.retencao * 100}% de retenção − ${brl(ld.entrada)} de desconto da entrada (somente ${esc(obraNome(ld.entradaObra))}). Obras externas são previsões estimadas.</p></div>`;
}
function calView() {
  const mes = tab.cm || '2026-10', [Y, M] = mes.split('-').map(Number), first = `${mes}-01`, nd = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const start = addDays(first, -dowIdx(first)), weeks = Math.ceil((dowIdx(first) + nd) / 7);
  const nomes = [...new Set(S.calendario.flatMap(e => e.equipe))].sort(), fo = tab.cf || '';
  const ents = S.calendario.filter(e => !e.substituidoPor && (obraF === 'all' || e.obraId === obraF) && (!fo || e.equipe.includes(fo)));
  const by = {}; ents.forEach(e => (by[e.data] = by[e.data] || []).push(e));
  let cells = '';
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const dt = addDays(start, w * 7 + d), inM = dt.startsWith(mes), fer = S.feriados[dt];
    cells += `<div class="cd ${inM ? '' : 'out'} ${d === 5 ? 'sab' : ''} ${d === 6 ? 'dom' : ''} ${dt === today() ? 'hoje' : ''}"><div class="cdn"><b>${+dt.slice(8)}</b>${fer ? `<span class="pill r" title="${esc(fer)}">feriado</span>` : ''}</div>${fer ? `<small class="bad">${esc(fer)}</small>` : ''}${(by[dt] || []).map(e => `<div class="chip ${TCLASS[e.tipo] || 'to'}" data-cal="${e.id}" title="${esc(e.texto)}"><b>${obraF === 'all' ? esc(short(obraNome(e.obraId))) + ' · ' : ''}${esc(e.tipo.charAt(0) + e.tipo.slice(1).toLowerCase())}</b>${e.cond ? ` <i>(${esc(e.cond)})</i>` : ''}<br>${e.turno && e.turno !== 'dia' ? `<i>${esc(e.turno)}:</i> ` : ''}${e.parado ? '<b>PARADO</b>' : esc(e.texto)}${e.nota ? `<small>${esc(e.nota)}</small>` : ''}${e.equipe.length ? `<small>${esc(e.equipe.join(', '))}</small>` : ''}</div>`).join('')}</div>`;
  }
  const alerts = [];
  const byDay = {}; S.calendario.filter(e => !e.substituidoPor && e.data.startsWith(mes)).forEach(e => (byDay[e.data] = byDay[e.data] || []).push(e));
  for (const [dt, es] of Object.entries(byDay)) {
    if (S.feriados[dt]) alerts.push(`${fdate(dt)} é feriado (${S.feriados[dt]}) e há atividade programada em ${[...new Set(es.map(e => short(obraNome(e.obraId))))].join(', ')} — confirmar execução ou remanejar.`);
    const who = {}; es.forEach(e => e.equipe.forEach(n => { (who[n] = who[n] || new Set()).add(e.obraId); }));
    for (const [n, os] of Object.entries(who)) if (os.size > 1) alerts.push(`${fdate(dt)}: ${n} está em ${os.size} obras ao mesmo tempo (${[...os].map(i => short(obraNome(i))).join(' e ')}).`);
    if (dowIdx(dt) === 6) alerts.push(`${fdate(dt)} é domingo e há atividade programada.`);
  }
  const lead = S.calendario.some(e => e.cond && e.data.startsWith(mes)) ? [`Há atividades “se liberado” neste mês — dependem da liberação da área.`] : [];
  const meses = ['2026-09', '2026-10', '2026-11', '2026-12'];
  return `${metaMensalView()}<div class="card"><div class="row sp" style="margin-bottom:10px"><div class="row"><div class="tabs" style="margin:0">${meses.map(x => `<button data-cm="${x}" class="${x === mes ? 'on' : ''}">${MESES[+x.slice(5) - 1].slice(0, 3)}/${x.slice(2, 4)}</button>`).join('')}</div><select data-cf="1"><option value="">Todos os funcionários</option>${nomes.map(n => `<option ${n === fo ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div class="row"><button class="btn" data-pm="impCal">Importar mensagem</button><button class="btn pri" data-pm="newAtiv">Nova atividade</button></div></div>
  <h2 style="margin-bottom:8px">${MESES[M - 1][0].toUpperCase() + MESES[M - 1].slice(1)} de ${Y}${obraF !== 'all' ? ' · ' + esc(obraNome(obraF)) : ''}</h2><div class="cal"><div class="cdh">${DOW.map(x => `<span>${x}</span>`).join('')}</div><div class="cgrid">${cells}</div></div>
  <div class="legend" style="margin-top:10px">${Object.entries(TCLASS).map(([k, c]) => `<span><i class="sw ${c}"></i>${k.charAt(0) + k.slice(1).toLowerCase()}</span>`).join('')}</div></div>
  <div class="card"><h2>Alertas do mês</h2>${[...alerts, ...lead].map(a => `<div class="it" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="pill a">alerta</span>&nbsp;<span>${esc(a)}</span></div>`).join('') || '<p class="sub">Nenhum conflito encontrado.</p>'}</div>`;
}
function agendaView() {
  const dates = [...new Set(S.agenda.map(a => a.data))].sort(), weeks = [...new Set(dates.map(d => addDays(d, -dowIdx(d))))];
  const wk = tab.aw && weeks.includes(tab.aw) ? tab.aw : weeks[weeks.length - 1], days = [0, 1, 2, 3, 4, 5].map(i => addDays(wk, i));
  const es = S.agenda.filter(a => days.includes(a.data)), teams = [...new Map(es.map(a => [a.equipe, a])).values()];
  return `<div class="row sp" style="margin-bottom:12px"><div class="row"><label class="mono">Semana</label><select data-aw="1">${weeks.map(w => `<option value="${w}" ${w === wk ? 'selected' : ''}>${fdate(w)} a ${fdate(addDays(w, 5))}</option>`).join('')}</select></div><button class="btn pri" data-pm="newAg">Novo lançamento</button></div>
  <div class="card tw"><table><tr><th>Equipe</th>${days.map(d => `<th>${DOW[dowIdx(d)]} ${fdate(d).slice(0, 5)}${S.feriados[d] ? ' <span class="pill r">feriado</span>' : ''}</th>`).join('')}</tr>${teams.map(t => `<tr><td style="min-width:150px"><b>${esc(t.equipe)}</b>${t.encarregado ? `<small style="display:block;color:var(--mut)">Enc.: ${esc(t.encarregado)}</small>` : ''}${t.membros.map(m => `<small style="display:block;color:var(--mut)">${esc(m)}</small>`).join('')}</td>${days.map(d => `<td style="min-width:150px;font-size:12.5px">${es.filter(a => a.data === d && a.equipe === t.equipe).map(a => `<div>${esc(a.texto)}</div>`).join('') || '<small style="color:var(--mut)">Sem programação.</small>'}</td>`).join('')}</tr>`).join('') || '<tr><td>Sem lançamentos nesta semana.</td></tr>'}</table></div><p class="sub">Meta da semana: executar os serviços com o planejamento 100% cumprido.</p>`;
}
function parseCalTexto(txt, obraId) {
  const out = []; let dt = null;
  for (const raw of txt.split('\n')) {
    const l = raw.trim(); if (!l) continue; let m;
    if ((m = l.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) { dt = `${m[3]}-${m[2]}-${m[1]}`; continue; }
    if (!dt || /^(funcion|previs|total|meta)/i.test(l)) continue;
    let local = '', body = l;
    if ((m = l.match(/^([^:]{2,30}):\s*(.+)$/))) { local = m[1].trim(); body = m[2]; }
    let nomes = [], texto = body; const k = body.lastIndexOf(' - ');
    if (k > 0) { const cand = body.slice(k + 3).replace(/\.$/, ''); const ns = names_inList(cand); if (ns.length) { nomes = ns; texto = body.slice(0, k); } }
    out.push({ obraId, data: dt, tipo: classTipo(texto), tipos: [], texto: (local ? local + ' — ' : '') + texto.replace(/\.$/, ''), equipe: nomes, cond: '', fonte: 'Mensagem' });
  }
  return out;
}
const names_inList = s => s.split(/,| e /).map(x => x.trim()).filter(x => x && S.funcionarios.some(f => norm(f.nome) === norm(x.replace(/\(.*\)/, '').trim()) || norm(f.nome).startsWith(norm(x.replace(/\(.*\)/, '').trim()))) ).map(x => x.replace(/\(.*\)/, '').trim());


/* ---------- Cobertura diária de RDO ---------- */
const FIRST_RDO = obraId => S.rdos.filter(r => r.obraId === obraId).map(r => r.data).sort()[0];
function obraWindow(o) {
  if (o.status === 'Programada' && !o.inicio) return null;
  const ini = o.inicio || FIRST_RDO(o.id); if (!ini) return null;
  const last = S.rdos.filter(r => r.obraId === o.id).map(r => r.data).sort().pop();
  let fim = o.fim || (o.status === 'Concluída' ? last : today()); if (!fim) fim = today();
  return { ini, fim: fim > today() ? today() : fim };
}
const diaUtil = d => dowIdx(d) < 6 && !S.feriados[d];
function covData(mes) {
  const [Y, M] = mes.split('-').map(Number), nd = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const days = Array.from({ length: nd }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  const obras = S.obras.map(o => ({ o, w: obraWindow(o) }));
  return { days, obras };
}
function covView() {
  const all = S.rdos.map(r => r.data).sort(), first = all[0] || today().slice(0, 7) + '-01';
  const meses = []; for (let m = first.slice(0, 7); m <= today().slice(0, 7);) { meses.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
  const mes = tab.cvm && meses.includes(tab.cvm) ? tab.cvm : meses[meses.length - 1 - (meses.length > 1 && !S.rdos.some(r => r.data.startsWith(meses[meses.length - 1])) ? 1 : 0)];
  const { days, obras } = covData(mes), show = tab.cvall ? obras : obras.filter(x => x.w && (obraF === 'all' || x.o.id === obraF) && x.w.fim >= days[0] && x.w.ini <= days[days.length - 1]);
  const cols = (obraF === 'all' ? show : show.filter(x => x.o.id === obraF));
  const byKey = {}; S.rdos.forEach(r => { (byKey[r.obraId + '|' + r.data] = byKey[r.obraId + '|' + r.data] || []).push(r); });
  const rows = days.slice().reverse().filter(d => d <= today()).map(d => {
    let exp = 0, ok = 0;
    const cells = cols.map(({ o, w }) => {
      const rs = byKey[o.id + '|' + d] || [], inWin = w && d >= w.ini && d <= w.fim, esperado = inWin && diaUtil(d);
      const salvos = rs.filter(r => r.status === 'salvo'), dr = rs.filter(r => r.status !== 'salvo');
      if (esperado) exp++; if (salvos.length) ok++;
      if (salvos.length) { const m2 = salvos.reduce((a, r) => a + rdoCalc(r).m2, 0); return `<td><button class="cv ok" data-cv="open:${salvos[0].id}" title="${esc(salvos[0].titulo || '')}">✔ ${salvos.length > 1 ? salvos.length + ' RDOs' : 'RDO'}${m2 ? `<br>${num(m2)} m²` : ''}</button></td>`; }
      if (dr.length) return `<td><button class="cv dr" data-cv="open:${dr[0].id}">◐ rascunho</button></td>`;
      if (esperado) return `<td><button class="cv no" data-cv="new:${o.id}:${d}" title="Criar RDO">✖ sem RDO</button></td>`;
      return `<td><span class="cv na">${inWin ? (S.feriados[d] ? 'feriado' : '') : '▫'}</span></td>`;
    });
    const fx = !diaUtil(d);
    return `<tr class="${fx ? 'fx' : ''}"><td><b>${fdate(d).slice(0, 5)}</b> <small style="color:var(--mut)">${DOW[dowIdx(d)]}</small>${exp ? `<small style="display:block" class="${ok === exp ? 'ok' : ok ? 'amb' : 'bad'}">${ok} de ${exp}</small>` : ''}</td>${cells.join('')}</tr>`;
  }).join('');
  // resumo por obra no mês
  const sum = cols.map(({ o, w }) => {
    const exp = days.filter(d => d <= today() && w && d >= w.ini && d <= w.fim && diaUtil(d)), com = exp.filter(d => (byKey[o.id + '|' + d] || []).some(r => r.status === 'salvo'));
    const pct = exp.length ? com.length / exp.length * 100 : null, falta = exp.length - com.length;
    return `<div class="card" style="margin:0"><div class="mono">${esc(short(o.nome))}</div><div class="kpi"><div class="v" style="font-size:26px">${pct == null ? '—' : pct.toFixed(0) + '%'}</div></div><small class="sub">${exp.length ? `${com.length} de ${exp.length} dias úteis com RDO · <span class="${falta ? 'bad' : 'ok'}">${falta} sem RDO</span>` : 'sem dias esperados neste mês'}</small></div>`;
  }).join('');
  const orfaos = S.rdos.filter(r => !r.obraId), inf = S.rdos.filter(r => r.obraInferida);
  const semInicio = obras.filter(x => !x.w).map(x => short(x.o.nome));
  return `<div class="row sp" style="margin-bottom:12px"><div class="tabs" style="margin:0">${meses.map(m => `<button data-cvm="${m}" class="${m === mes ? 'on' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</button>`).join('')}</div><label class="row"><input type="checkbox" data-cvall="1" ${tab.cvall ? 'checked' : ''}> mostrar todas as obras cadastradas</label></div>
  <div class="grid g4" style="margin-bottom:14px">${sum || '<p class="sub">Nenhuma obra com expediente neste mês.</p>'}</div>
  <div class="card"><div class="row sp"><h2>Cobertura de RDO por dia · ${MESES[+mes.slice(5) - 1]}/${mes.slice(0, 4)}</h2><div class="legend" style="margin:0"><span class="ok">✔ com RDO</span><span class="amb">◐ rascunho</span><span class="bad">✖ sem RDO</span><span>▫ fora do período/expediente</span></div></div>
  <div class="cov" style="margin-top:10px"><table><tr><th>Dia</th>${cols.map(({ o }) => `<th>${esc(short(o.nome))}</th>`).join('')}</tr>${rows || '<tr><td>Sem dias.</td></tr>'}</table></div>
  <p class="sub" style="margin-top:8px">Dia esperado = segunda a sábado, sem feriado, entre o início e o fim da obra. Clique em ✖ para criar o RDO do dia.</p></div>
  ${orfaos.length ? `<div class="alert">${orfaos.length} RDO(s) importado(s) sem obra identificada (nº ${orfaos.map(r => r.numero).join(', ')}) — abra e escolha a obra.</div>` : ''}
  ${inf.length ? `<p class="sub">RDO nº ${inf.map(r => r.numero).join(', ')} sem obra no título: atribuído(s) a ${esc(obraNome(inf[0].obraId))} pela data e equipe — confirme.</p>` : ''}
  ${!tab.cvall && semInicio.length ? `<p class="sub">Sem início cadastrado (não aparecem acima): ${semInicio.map(esc).join(', ')}. Marque “mostrar todas” ou informe o início em Metas de produção.</p>` : ''}`;
}

VIEWS.prod = () => {
  const t = tab.p || 'geral';
  const tabs = [['geral', 'Geral'], ['desemp', 'Desempenho'], ['rdo', 'RDO'], ['cov', 'Cobertura diária'], ['metas', 'Metas de produção'], ['mc', 'Metas e calendário'], ['agenda', 'Agenda semanal']];
  if (t === 'rdo' && rd && tab.rdoEdit) return rdoForm();
  if (t === 'rdo' && tab.rv) return rdoFicha(tab.rv);
  const act = t === 'rdo' || t === 'geral' ? '<button class="btn" data-apt-go="open">Colar apontamento</button>' + (t === 'rdo' ? '<button class="btn pri" data-rd="new">Novo RDO</button>' : '') : '';
  const body = t === 'geral' ? geralView() : t === 'desemp' ? desempenhoView() : t === 'rdo' ? rdoListV2() : t === 'cov' ? covView() : t === 'metas' ? metasView() : t === 'mc' ? calView() : agendaView();
  return `${head('Produção e RDO', 'Diário de obra · metas · calendário', act)}<div class="tabs">${tabs.map(([k, l]) => `<button data-pt="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`;
};

/* ---------- eventos ---------- */
const rdRender = () => { rdSync(); render(); };
EXT.click.push(async e => {
  const g = e.target.closest('[data-goto]'); if (g) { tab.p = g.dataset.goto; tab.rdoEdit = false; return false; }
  const nav = e.target.closest('[data-nav]'); if (nav && nav.dataset.nav !== 'prod') return false;
  const cvm = e.target.closest('[data-cvm]'); if (cvm) { tab.cvm = cvm.dataset.cvm; render(); return true; }
  const cv = e.target.closest('[data-cv]');
  if (cv) { const [a, x, y] = cv.dataset.cv.split(':'); if (a === 'open') { rd = JSON.parse(JSON.stringify(S.rdos.find(z => z.id === x))); } else { rd = novoRdo(); rd.obraId = x; rd.data = y; rd.respData = y; } tab.p = 'rdo'; tab.rdoEdit = true; render(); return true; }
  const pt = e.target.closest('[data-pt]'); if (pt) { rdSync(); tab.p = pt.dataset.pt; tab.rdoEdit = false; tab.rv = null; render(); return true; }
  const cm = e.target.closest('[data-cm]'); if (cm) { tab.cm = cm.dataset.cm; render(); return true; }
  const cal = e.target.closest('[data-cal]');
  if (cal) { const x = S.calendario.find(z => z.id === cal.dataset.cal); modal(`<h2>${esc(obraNome(x.obraId))} · ${fdate(x.data)}</h2><p><span class="pill">${esc(x.tipo)}</span> ${x.cond ? `<span class="pill a">${esc(x.cond)}</span>` : ''}</p><p>${esc(x.texto)}</p><p class="sub">Equipe: ${esc(x.equipe.join(', ') || '—')} · fonte: ${esc(x.fonte)}</p><div class="row sp"><button class="btn" data-act="close">Fechar</button><button class="btn" data-pm="delCal:${x.id}">Excluir</button></div>`); return true; }
  const r = e.target.closest('[data-rd]');
  if (r) {
    const [a, b, c] = r.dataset.rd.split(':');
    if (r.tagName === 'A') e.preventDefault();
    if (a === 'new') { rd = novoRdo(); tab.rdoEdit = true; render(); }
    else if (a === 'open') { rd = JSON.parse(JSON.stringify(S.rdos.find(z => z.id === b))); tab.rdoEdit = true; render(); }
    else if (a === 'del') { if (confirm('Excluir este RDO? Baixas de estoque vinculadas serão desfeitas.')) { removeRdoStock(b); S.rdos = S.rdos.filter(z => z.id !== b); save(); render(); } }
    else if (a === 'back') { rd = null; tab.rdoEdit = false; render(); }
    else if (a === 'clima') { rdSync(); rd.clima = rd.clima === b ? '' : b; render(); }
    else if (a === 'delRow') { rdSync(); rd[b].splice(+c, 1); render(); }
    else if (a === 'addFase') { rdSync(); rd.fases.push({ faseId: '', nome: '', qtd: '' }); render(); }
    else if (a === 'addMat') { rdSync(); rd.materiais.push({ materialId: '', nome: '', qtd: '', preco: '' }); render(); }
    else if (a === 'addMo') { rdSync(); const v = $('#rdMo').value; if (v) rd.maoObra.push(v); render(); }
    else if (a === 'addMoT') { rdSync(); const v = $('#rdMoT').value.trim(); if (v && !rd.maoObra.includes(v)) rd.maoObra.push(v); render(); }
    else if (a === 'moEquipe') { rdSync(); S.funcionarios.filter(f => f.obraId === rd.obraId && f.status !== 'Desligado').forEach(f => { if (!rd.maoObra.includes(f.nome)) rd.maoObra.push(f.nome); }); render(); }
    else if (a === 'addEq') { rdSync(); const v = $('#rdEq').value.trim(); if (v) rd.equipamentos.push(v); render(); }
    else if (a === 'oc') { rdSync(); if (b === 'Sem ocorrências') { rd.ocorrencias = []; rd.ocHoras = {}; } else { const i = rd.ocorrencias.indexOf(b); if (i >= 0) rd.ocorrencias.splice(i, 1); else rd.ocorrencias.push(b); } render(); }
    else if (a === 'goMetas') { rdSync(); tab.p = 'metas'; tab.po = rd.obraId; tab.rdoEdit = false; render(); }
    else if (a === 'print') { rdSync(); window.print(); }
    else if (a === 'fill') modal(`<h2>Preencher com texto</h2><p class="sub">Cole o relatório (Obra:, Data:, Responsável:, Clima:, Mão de obra:, Fases: com “- fase qtd un”, Descrição:, HH:, Materiais: com “- material qtd”, Observações:, Planejamento:).</p><textarea id="rdTxt"></textarea><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-rd="fillGo">Aplicar</button></div>`);
    else if (a === 'fillGo') { rdSync(); aplicaTexto(parseRdoTexto($('#rdTxt').value)); closeModal(); render(); }
    else if (a === 'draft' || a === 'save') {
      rdSync(); if (!rd.obraId || !rd.data) return alert('Selecione obra e data.'), true;
      if (a === 'save') { const ruim = rd.materiais.find(m => m.materialId && (+m.qtd || 0) <= 0); if (ruim) return alert('Informe a quantidade dos materiais do estoque.'), true; }
      rd.fases = rd.fases.filter(l => l.faseId || l.nome || +l.qtd);
      const dupR = S.rdos.find(z => z.id !== rd.id && z.obraId === rd.obraId && z.data === rd.data && z.status === 'salvo');
      if (dupR && !confirm(`Já existe um RDO salvo de ${obraNome(rd.obraId)} em ${fdate(rd.data)}. Criar mesmo assim (duplicado)?`)) return true;
      const prev = S.rdos.findIndex(z => z.id === rd.id), was = prev >= 0 ? S.rdos[prev].status : '';
      rd.status = a === 'save' ? 'salvo' : (was === 'salvo' ? 'salvo' : 'rascunho');
      if (a === 'save') applyRdoStock(rd); else if (was !== 'salvo') removeRdoStock(rd.id);
      const copy = JSON.parse(JSON.stringify(rd)); if (prev >= 0) S.rdos[prev] = copy; else S.rdos.push(copy);
      save(); alert(a === 'save' ? 'RDO salvo.' : 'Rascunho salvo.'); if (a === 'save') { rd = null; tab.rdoEdit = false; } render();
    }
    return true;
  }
  const pm = e.target.closest('[data-pm]');
  if (pm) {
    const [a, id] = pm.dataset.pm.split(':'), o = getObra(tab.po);
    if (a === 'modo') { o.modoReceita = id; save(); render(); }
    else if (a === 'addFase') { const n = $('#nfN').value.trim(); if (!n) return true; S.fases.push({ id: uid('fa'), nome: n, un: $('#nfU').value, peso: parseFloat($('#nfP').value) || 0, preco: null, ativa: true }); save(); render(); }
    else if (a === 'newMeta') { const at = fasesAtivas(); modal(`<h2>Nova meta de período — ${esc(o.nome)}</h2><div class="grid g2" style="grid-template-columns:1fr 1fr;gap:0 14px"><div><label>Início</label><input id="mi" type="date" value="${today()}"></div><div><label>Fim</label><input id="mf" type="date" value="${addDays(today(), 30)}"></div></div><label>Quantidade a entregar por fase</label>${at.map(f => `<div class="row" style="margin-bottom:6px"><span style="flex:1">${esc(f.nome)} (${f.un})</span><input type="number" step="any" min="0" data-mq="${f.id}" style="width:120px"></div>`).join('')}<div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-pm="saveMeta">Salvar</button></div>`); }
    else if (a === 'saveMeta') { const qtds = {}; document.querySelectorAll('[data-mq]').forEach(i => { if (+i.value > 0) qtds[i.dataset.mq] = +i.value; }); const ini = $('#mi').value, fim = $('#mf').value; if (!ini || !fim || fim < ini || !Object.keys(qtds).length) return alert('Informe período válido e ao menos uma quantidade.'), true; S.metas.push({ id: uid('mt'), obraId: tab.po, inicio: ini, fim, qtds }); save(); closeModal(); render(); }
    else if (a === 'delMeta') { S.metas = S.metas.filter(z => z.id !== id); save(); render(); }
    else if (a === 'delCal') { S.calendario = S.calendario.filter(z => z.id !== id); save(); closeModal(); render(); }
    else if (a === 'newAtiv') modal(`<h2>Nova atividade</h2><label>Obra</label><select id="caO">${S.obras.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select><label>Data</label><input id="caD" type="date" value="${today()}"><label>Serviço</label><input id="caT" placeholder="1º Subsolo: Execução de primer"><label>Equipe (nomes separados por vírgula)</label><input id="caE"><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-pm="saveAtiv">Salvar</button></div>`);
    else if (a === 'saveAtiv') { const t = $('#caT').value.trim(); if (!t) return alert('Informe o serviço.'), true; S.calendario.push({ id: uid('k'), obraId: $('#caO').value, data: $('#caD').value, tipo: classTipo(t), tipos: [], texto: t, equipe: names_inList($('#caE').value), cond: '', fonte: 'Manual' }); save(); closeModal(); render(); }
    else if (a === 'impCal') modal(`<h2>Importar calendário de mensagem</h2><p class="sub">Formato: <code>16/09/2026 (Quarta-Feira)</code> e abaixo <code>1ºSubsolo: Execução de Primer - Wanderson, Samuel</code>.</p><label>Obra</label><select id="icO">${S.obras.map(x => `<option value="${x.id}" ${x.id === obraF ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select><label>Mensagem</label><textarea id="icT"></textarea><div class="row" style="margin-top:10px"><button class="btn" data-pm="icPrev">Interpretar</button></div><div id="icP"></div><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-pm="icGo">Importar</button></div>`);
    else if (a === 'icPrev' || a === 'icGo') { const es = parseCalTexto($('#icT').value, $('#icO').value); if (a === 'icPrev') { $('#icP').innerHTML = `<p class="sub">${es.length} atividades em ${new Set(es.map(x => x.data)).size} dias.</p><table>${es.slice(0, 12).map(x => `<tr><td>${fdate(x.data)}</td><td>${esc(x.tipo)}</td><td>${esc(x.texto)}</td><td>${esc(x.equipe.join(', '))}</td></tr>`).join('')}</table>`; } else { if (!es.length) return alert('Nada reconhecido.'), true; es.forEach(x => { x.id = uid('k'); S.calendario.push(x); }); save(); closeModal(); render(); } }
    else if (a === 'newAg') modal(`<h2>Novo lançamento da agenda</h2><label>Data</label><input id="agD" type="date" value="${today()}"><label>Equipe</label><input id="agE" list="dle" placeholder="SUPERA"><datalist id="dle">${[...new Set(S.agenda.map(x => x.equipe))].map(x => `<option>${esc(x)}</option>`).join('')}</datalist><label>Encarregado</label><input id="agC"><label>Serviço</label><textarea id="agT" style="min-height:70px"></textarea><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-pm="saveAg">Salvar</button></div>`);
    else if (a === 'saveAg') { const eq = $('#agE').value.trim(), t = $('#agT').value.trim(); if (!eq || !t) return alert('Informe equipe e serviço.'), true; const ref = S.agenda.find(x => x.equipe.toUpperCase() === eq.toUpperCase()); S.agenda.push({ data: $('#agD').value, equipe: ref ? ref.equipe : eq.toUpperCase(), encarregado: $('#agC').value || (ref ? ref.encarregado : ''), membros: ref ? ref.membros : [], texto: t }); save(); closeModal(); render(); }
    return true;
  }
  return false;
});
EXT.input.push(e => {
  const t = e.target;
  if (t.dataset.r || t.dataset.ra || t.dataset.oh) { rdSync(); const s = $('#rsum'); if (s && rd) s.innerHTML = rdoSummary(); return !t.dataset.struct; }
  if (t.dataset.obf) { const o = getObra(tab.po); o[t.dataset.obf] = t.dataset.obf === 'inicio' ? t.value : parseFloat(t.value) || 0; save(); return true; }
  if (t.dataset.fp) { const [id, k] = t.dataset.fp.split(':'), f = S.fases.find(z => z.id === id), o = getObra(tab.po); if (k === 'peso') f.peso = parseFloat(t.value) || 0; else if (k === 'preco') { o.fasePreco = o.fasePreco || {}; o.fasePreco[id] = parseFloat(t.value) || null; } else return false; save(); return true; }
  return false;
});
EXT.change.push(async e => {
  const t = e.target;
  if (t.dataset.struct && (t.dataset.r || t.dataset.ra)) { rdSync(); if (t.dataset.ra) { const [l, i, k] = t.dataset.ra.split(':'); if (l === 'fases' && k === 'faseId') { const f = S.fases.find(x => x.id === t.value); rd.fases[i].un = f ? f.un : 'm²'; } } render(); return true; }
  if (t.dataset.ra && t.dataset.ra.endsWith(':un')) { rdSync(); return true; }
  if (t.dataset.cvall) { tab.cvall = t.checked; render(); return true; }
  if (t.dataset.pobra) { tab.po = t.value; render(); return true; }
  if (t.dataset.cf !== undefined) { tab.cf = t.value; render(); return true; }
  if (t.dataset.aw) { tab.aw = t.value; render(); return true; }
  if (t.dataset.fp && t.type === 'checkbox') { const [id] = t.dataset.fp.split(':'); S.fases.find(z => z.id === id).ativa = t.checked; save(); render(); return true; }
  if (t.dataset.foto) { rdSync(); for (const f of t.files) rd.fotos.push(await putFile(f)); render(); return true; }
  return false;
});
