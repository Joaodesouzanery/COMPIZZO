/* Cadastros: funcionários, equipes e cargos (módulo Mão de Obra). */
'use strict';
const FUNC_STATUS = ['Ativo', 'Férias', 'Afastado', 'Desligado'];
const CONTRATOS = ['CLT', 'PJ', 'Terceirizado', 'Autônomo', 'Estágio', 'Aprendiz'];
const REGIMES = ['Padrão (5x2)', '6x1', '12x36', 'Escala 4x2', 'Sob demanda'];
const numOrNull = v => (v === '' || v == null || isNaN(parseBR(v)) ? null : parseBR(v));
const eff = (f, k) => (f[k] != null ? f[k] : ((S.cargos.find(c => c.nome === f.funcao) || {})[k] ?? null));

function formModal(title, fields, v, action) {
  const inp = f => {
    const val = v[f.k] ?? '';
    if (f.t === 'select') return `<select id="ff_${f.k}">${f.opts.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    if (f.t === 'textarea') return `<textarea id="ff_${f.k}" style="min-height:70px">${esc(val)}</textarea>`;
    return `<input id="ff_${f.k}" type="${f.t === 'date' ? 'date' : 'text'}" value="${esc(val)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`;
  };
  modal(`<h2>${title}</h2><div class="grid g2" style="grid-template-columns:1fr 1fr;gap:0 14px">${fields.map(f => `<div style="${f.w ? 'grid-column:1/-1' : ''}"><label>${f.l}${f.req ? ' *' : ''}${f.hint ? ` <small>(${f.hint})</small>` : ''}</label>${inp(f)}</div>`).join('')}</div><div class="row sp" style="margin-top:16px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-cad="${action}">Salvar</button></div>`);
}
const readForm = fields => { const o = {}; for (const f of fields) { const el = $('#ff_' + f.k); o[f.k] = f.t === 'num' ? numOrNull(el.value) : el.value.trim(); } return o; };

const FUNC_FIELDS = () => [
  { k: 'nome', l: 'Nome completo', req: 1, w: 1 },
  { k: 'funcao', l: 'Função / Cargo', req: 1, t: 'select', opts: ['', ...S.cargos.map(c => c.nome)] },
  { k: 'matricula', l: 'Matrícula', ph: 'MAT-0001' },
  { k: 'setor', l: 'Departamento / Setor', ph: 'Frente de Trabalho' },
  { k: 'obraId', l: 'Local / Obra', t: 'select', opts: [['', '— Selecione a obra —'], ...S.obras.map(o => [o.id, o.nome])] },
  { k: 'local', l: 'Local (texto livre)', hint: 'se não for uma obra cadastrada' },
  { k: 'admissao', l: 'Data de admissão', t: 'date' },
  { k: 'contrato', l: 'Tipo de contrato', t: 'select', opts: CONTRATOS },
  { k: 'regime', l: 'Regime de trabalho', t: 'select', opts: REGIMES },
  { k: 'equipeId', l: 'Equipe', t: 'select', opts: [['', '— Sem equipe (definir depois) —'], ...S.equipes.map(e => [e.id, e.nome])] },
  { k: 'status', l: 'Status', t: 'select', opts: FUNC_STATUS },
  { k: 'taxaHora', l: 'Taxa horária (R$)', t: 'num' },
  { k: 'salario', l: 'Salário bruto (R$)', t: 'num' },
  { k: 'heSab', l: 'HE sábado — exceção (R$)', t: 'num', hint: 'vazio = usa o cargo' },
  { k: 'heDom', l: 'HE domingo — exceção (R$)', t: 'num', hint: 'vazio = usa o cargo' }];

CAD.func = () => {
  const q = norm(tab.fq || ''), fs = tab.ffs || 'Ativo';
  const list = S.funcionarios.filter(f => (!q || norm(f.nome + ' ' + (f.funcao || '')).includes(q)) && (fs === 'all' || (f.status || 'Ativo') === fs) && (obraF === 'all' || f.obraId === obraF));
  const eq = id => (S.equipes.find(e => e.id === id) || {}).nome || '—';
  return `<div class="row sp" style="margin-bottom:12px"><div class="row"><input id="fq" placeholder="Buscar…" value="${esc(tab.fq || '')}"><div class="tabs" style="margin:0">${['Ativo', 'Férias', 'Afastado', 'Desligado', 'all'].map(k => `<button data-ffs="${k}" class="${fs === k ? 'on' : ''}">${k === 'all' ? 'Todos' : k}</button>`).join('')}</div></div><button class="btn pri" data-cad="newFunc">Novo funcionário</button></div>
  <div class="card tw"><table><tr><th>Nome</th><th>Cargo</th><th>Obra / Local</th><th>Equipe</th><th>Contrato</th><th>Regime</th><th>Status</th><th class="n">Taxa/h</th><th class="n">Salário</th><th class="n">HE sáb/dom</th><th></th></tr>${list.map(f => `<tr><td><b>${esc(f.nome)}</b><small style="display:block;color:var(--mut)">${esc(f.matricula || '')}${f.admissao ? ' · adm. ' + fdate(f.admissao) : ''}</small></td><td>${esc(f.funcao || '—')}</td><td>${esc(f.obraId ? obraNome(f.obraId) : f.local || '—')}</td><td>${esc(eq(f.equipeId))}</td><td>${esc(f.contrato || '')}</td><td>${esc(f.regime || '')}</td><td><span class="pill ${f.status === 'Ativo' || !f.status ? 'g' : f.status === 'Desligado' ? 'r' : 'a'}">${esc(f.status || 'Ativo')}</span></td><td class="n">${f.taxaHora != null ? brl(f.taxaHora) : '—'}</td><td class="n">${f.salario != null ? brl(f.salario) : '—'}</td><td class="n">${eff(f, 'heSab') != null ? brl(eff(f, 'heSab')) : '—'} / ${eff(f, 'heDom') != null ? brl(eff(f, 'heDom')) : '—'}</td><td><button class="btn sm" data-cad="editFunc:${f.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="11">Nenhum funcionário.</td></tr>'}</table></div>`;
};
CAD.equipes = () => `<div class="row sp" style="margin-bottom:12px"><p class="sub" style="margin:0">Equipes são formadas pelos funcionários vinculados a elas.</p><button class="btn pri" data-cad="newEq">Nova equipe</button></div>
  <div class="grid g3">${S.equipes.map(e => { const m = S.funcionarios.filter(f => f.equipeId === e.id && f.status !== 'Desligado'); return `<div class="card"><div class="row sp"><h2>${esc(e.nome)}</h2><button class="btn sm" data-cad="editEq:${e.id}">Editar</button></div><div class="mono" style="margin:6px 0">${esc(obraNome(e.obraId))} · líder ${esc(e.lider || '—')}</div>${m.map(f => `<div class="row sp" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(f.nome)}</span><small style="color:var(--mut)">${esc(f.funcao || '')}</small></div>`).join('') || '<small class="sub">Sem membros.</small>'}</div>`; }).join('')}</div>`;
CAD.cargos = () => `<div class="row sp" style="margin-bottom:12px"><p class="sub" style="margin:0">Taxas do cargo valem quando o funcionário não tem exceção própria.</p><button class="btn pri" data-cad="newCargo">Novo cargo</button></div>
  <div class="card tw"><table><tr><th>Cargo</th><th class="n">Taxa/h</th><th class="n">Salário base</th><th class="n">HE sábado</th><th class="n">HE domingo</th><th class="n">Pessoas</th><th></th></tr>${S.cargos.map(c => `<tr><td><b>${esc(c.nome)}</b></td><td class="n">${c.taxaHora != null ? brl(c.taxaHora) : '—'}</td><td class="n">${c.salario != null ? brl(c.salario) : '—'}</td><td class="n">${c.heSab != null ? brl(c.heSab) : '—'}</td><td class="n">${c.heDom != null ? brl(c.heDom) : '—'}</td><td class="n">${S.funcionarios.filter(f => f.funcao === c.nome).length}</td><td><button class="btn sm" data-cad="editCargo:${c.id}">Editar</button></td></tr>`).join('')}</table></div>`;

const EQ_FIELDS = () => [{ k: 'nome', l: 'Nome da equipe', req: 1, w: 1 }, { k: 'lider', l: 'Líder', t: 'select', opts: ['', ...S.funcionarios.map(f => f.nome)] }, { k: 'obraId', l: 'Obra', t: 'select', opts: [['', '—'], ...S.obras.map(o => [o.id, o.nome])] }];
const CARGO_FIELDS = [{ k: 'nome', l: 'Cargo', req: 1, w: 1 }, { k: 'taxaHora', l: 'Taxa horária (R$)', t: 'num' }, { k: 'salario', l: 'Salário base (R$)', t: 'num' }, { k: 'heSab', l: 'HE sábado (R$)', t: 'num' }, { k: 'heDom', l: 'HE domingo (R$)', t: 'num' }];
let editId = null;
const MON = v => (v == null ? '' : String(v).replace('.', ','));

EXT.click.push(async e => {
  const f = e.target.closest('[data-ffs]'); if (f) { tab.ffs = f.dataset.ffs; render(); return true; }
  const t = e.target.closest('[data-cad]'); if (!t) return false;
  const [a, id] = t.dataset.cad.split(':');
  if (a === 'newFunc') { editId = null; formModal('Novo funcionário', FUNC_FIELDS(), { status: 'Ativo', contrato: 'CLT', regime: 'Padrão (5x2)', setor: 'Frente de Trabalho', obraId: obraF !== 'all' ? obraF : '' }, 'saveFunc'); }
  else if (a === 'editFunc') { editId = id; const x = S.funcionarios.find(z => z.id === id); formModal('Editar funcionário', FUNC_FIELDS(), { ...x, taxaHora: MON(x.taxaHora), salario: MON(x.salario), heSab: MON(x.heSab), heDom: MON(x.heDom) }, 'saveFunc'); }
  else if (a === 'saveFunc') {
    const fl = FUNC_FIELDS(), o = readForm(fl); if (!o.nome || !o.funcao) return alert('Informe nome e função/cargo.'), true;
    if (editId) Object.assign(S.funcionarios.find(z => z.id === editId), o); else S.funcionarios.push({ id: uid('f'), ...o });
    save(); closeModal(); render();
  }
  else if (a === 'newEq') { editId = null; formModal('Nova equipe', EQ_FIELDS(), {}, 'saveEq'); }
  else if (a === 'editEq') { editId = id; formModal('Editar equipe', EQ_FIELDS(), S.equipes.find(z => z.id === id), 'saveEq'); }
  else if (a === 'saveEq') { const o = readForm(EQ_FIELDS()); if (!o.nome) return alert('Informe o nome.'), true; if (editId) Object.assign(S.equipes.find(z => z.id === editId), o); else S.equipes.push({ id: uid('e'), ...o }); save(); closeModal(); render(); }
  else if (a === 'newCargo') { editId = null; formModal('Novo cargo', CARGO_FIELDS, {}, 'saveCargo'); }
  else if (a === 'editCargo') { editId = id; const x = S.cargos.find(z => z.id === id); formModal('Editar cargo', CARGO_FIELDS, { ...x, taxaHora: MON(x.taxaHora), salario: MON(x.salario), heSab: MON(x.heSab), heDom: MON(x.heDom) }, 'saveCargo'); }
  else if (a === 'saveCargo') { const o = readForm(CARGO_FIELDS); if (!o.nome) return alert('Informe o cargo.'), true; if (editId) { const c = S.cargos.find(z => z.id === editId); S.funcionarios.forEach(f => { if (f.funcao === c.nome) f.funcao = o.nome; }); Object.assign(c, o); } else S.cargos.push({ id: uid('cg'), ...o }); save(); closeModal(); render(); }
  else return false;
  return true;
});
EXT.input.push(e => { if (e.target.id === 'fq') { tab.fq = e.target.value; const p = e.target.selectionStart; render(); const n = $('#fq'); n.focus(); n.setSelectionRange(p, p); return true; } return false; });
