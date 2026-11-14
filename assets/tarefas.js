/* Dashboard › Tarefas: rotinas por funcionário (diárias, semanais, quinzenais, mensais, trimestrais) com check do ciclo e auto-verificação. */
'use strict';
const FREQ = { diaria: 'Diária (dias úteis)', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', trimestral: 'Trimestral', pontual: 'Pontual' };
function tkCiclo(t, ref = today()) {
  const y = ref.slice(0, 4), m = ref.slice(5, 7), d = +ref.slice(8);
  switch (t.frequencia) {
    case 'diaria': return { k: ref, rot: fdate(ref) };
    case 'semanal': { const w = mondayOf(ref); return { k: w, rot: 'semana de ' + fdate(w).slice(0, 5) }; }
    case 'quinzenal': return { k: `${y}-${m}-${d <= 15 ? 1 : 2}`, rot: `${d <= 15 ? '1ª' : '2ª'} quinzena de ${MESES[+m - 1]}` };
    case 'mensal': return { k: `${y}-${m}`, rot: MESES[+m - 1] };
    case 'trimestral': { const q = Math.floor((+m - 1) / 3) + 1; return { k: `${y}-T${q}`, rot: `${q}º trimestre de ${y}` }; }
    default: return { k: 'unica', rot: 'única vez' };
  }
}
// auto-verificação: devolve { feito, info } ou null (sem auto)
function tkAuto(t, c) {
  const hoje = today();
  if (t.auto === 'apontamento') {
    const alvo = S.obras.filter(o => !o.paiId && o.status === 'Em andamento' && obraWindow(o) && diaUtil(hoje) && !(S.paradas || []).some(p => p.obraId === o.id && hoje >= p.ini && hoje <= p.fim));
    const com = alvo.filter(o => S.rdos.some(r => r.status === 'salvo' && r.data === hoje && obraFamilia(o.id).includes(r.obraId)));
    return { feito: alvo.length ? com.length === alvo.length : true, info: `${com.length} de ${alvo.length} obras com apontamento hoje` };
  }
  if (t.auto === 'retiradas') { const w = mondayOf(hoje), n = S.retiradas.filter(r => r.data >= w).length; return { feito: n > 0, info: `${n} retirada(s) registrada(s) na semana` }; }
  if (t.auto === 'avaliacao') { const [y, m, q] = c.k.split('-'), ini = `${y}-${m}-${q === '1' ? '01' : '16'}`, fim = `${y}-${m}-${q === '1' ? '15' : '31'}`, n = S.avaliacoes.filter(a => (a.data || a.criado || '') >= ini && (a.data || a.criado || '') <= fim).length; return { feito: n > 0, info: `${n} avaliação(ões) na quinzena` }; }
  return null;
}
const tkFeito = (t, c) => (S.tarefasLog || []).some(l => l.tarefaId === t.id && l.ciclo === c.k && l.feito);
function tarefasView() {
  const ts = (S.tarefas || []).filter(t => t.ativa !== false), pess = [...new Set(ts.map(t => t.funcId))].map(id => S.funcionarios.find(f => f.id === id)).filter(Boolean);
  let tot = 0, ok = 0;
  const cards = pess.map(f => {
    const mine = ts.filter(t => t.funcId === f.id), itens = mine.map(t => { const c = tkCiclo(t), a = tkAuto(t, c), feito = tkFeito(t, c) || (a && a.feito); tot++; if (feito) ok++; return { t, c, a, feito }; }), n = itens.filter(i => i.feito).length;
    return `<div class="card" style="margin:0"><div class="row sp"><div class="row" style="flex-wrap:nowrap;gap:12px"><div class="av" style="background:var(--blue)">${esc(iniciais(f.nome))}</div><div><b style="font-size:16px">${esc(f.nome)}</b><small style="display:block;color:var(--mut)">${esc(f.funcao || '')}</small></div></div><div style="text-align:right"><b style="font-size:20px">${mine.length ? Math.round(n / mine.length * 100) : 0}%</b><small style="display:block;color:var(--mut)">${n} de ${mine.length} no ciclo</small></div></div>${ticksBar(mine.length ? n / mine.length * 100 : 0, 'var(--grn)', 30)}
    <div class="list" style="margin-top:6px">${itens.map(({ t, c, a, feito }) => `<div class="it" style="align-items:flex-start"><input type="checkbox" data-tk="${t.id}" ${feito ? 'checked' : ''} ${a ? 'disabled title="verificado automaticamente pelo sistema"' : ''} style="margin-top:4px"><div class="t"><b style="${feito ? 'text-decoration:line-through;color:var(--mut)' : ''}">${esc(t.titulo)}</b><small>${esc(FREQ[t.frequencia] || t.frequencia)} · ${esc(c.rot)}${a ? ` · <span class="${a.feito ? 'ok' : 'bad'}">${esc(a.info)}</span>` : ''}</small></div><button class="btn sm" data-tke="${t.id}">Editar</button></div>`).join('') || '<p class="sub">Sem tarefas.</p>'}</div></div>`;
  }).join('');
  const k = (t, v, s) => `<div class="card kpi" style="margin:0;padding:16px"><div class="mono">${t}</div><div class="v" style="font-size:26px">${v}</div><small class="sub">${s}</small></div>`;
  return `<div class="grid g4" style="margin-bottom:14px">${k('Responsáveis', pess.length, 'com rotinas cadastradas')}${k('Tarefas no ciclo atual', tot, 'diária, semanal, quinzenal, mensal…')}${k('Cumpridas', ok, 'marcadas ou verificadas pelo sistema')}${k('Cumprimento', tot ? Math.round(ok / tot * 100) + '%' : '—', 'média de todos os responsáveis')}</div>
  <div class="dgrid" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">${cards || '<div class="card">Nenhuma tarefa cadastrada.</div>'}</div>`;
}
const dbTabs = () => `<div class="tabs" style="margin:0">${[['geral', 'Visão geral'], ['tarefas', 'Tarefas']].map(([k, l]) => `<button data-dbt="${k}" class="${(tab.dbt || 'geral') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const _dash = VIEWS.today;
VIEWS.today = () => {
  if ((tab.dbt || 'geral') !== 'tarefas') return _dash().replace('<div class="top">', `<div class="top">`).replace(/(<div class="row">)(<div class="tabs" style="margin:0"><button data-rp)/, `$1${dbTabs()}$2`);
  return `${head('Dashboard', 'Tarefas por responsável', `${dbTabs()}<button class="btn pri" data-tke="new">Nova tarefa</button>`)}${tarefasView()}`;
};
function tkForm(id) {
  const t = id === 'new' ? { id: '', funcId: '', titulo: '', frequencia: 'semanal', auto: '', ativa: true } : S.tarefas.find(x => x.id === id);
  modal(`<h2>${id === 'new' ? 'Nova tarefa' : 'Editar tarefa'}</h2><label>Responsável</label><select id="tkF">${S.funcionarios.map(f => `<option value="${f.id}" ${f.id === t.funcId ? 'selected' : ''}>${esc(f.nome)} — ${esc(f.funcao || '')}</option>`).join('')}</select><label>Tarefa</label><input id="tkT" value="${esc(t.titulo)}"><label>Frequência</label><select id="tkQ">${Object.entries(FREQ).map(([k, l]) => `<option value="${k}" ${k === t.frequencia ? 'selected' : ''}>${l}</option>`).join('')}</select><label>Verificação automática</label><select id="tkA"><option value="">nenhuma (marcar à mão)</option><option value="apontamento" ${t.auto === 'apontamento' ? 'selected' : ''}>apontamento do dia (RDO lançado)</option><option value="retiradas" ${t.auto === 'retiradas' ? 'selected' : ''}>retiradas registradas na semana</option><option value="avaliacao" ${t.auto === 'avaliacao' ? 'selected' : ''}>avaliação da quinzena</option></select>
  <div class="row" style="margin-top:14px;justify-content:space-between"><div>${id === 'new' ? '' : `<button class="btn" data-tkdel="${id}">Excluir</button>`}</div><div class="row"><button class="btn" data-act="close">Cancelar</button><button class="btn blue" data-tksave="${id}">Salvar</button></div></div>`);
}
EXT.click.push(async e => {
  let t;
  if ((t = e.target.closest('[data-dbt]'))) { tab.dbt = t.dataset.dbt; render(); return true; }
  if ((t = e.target.closest('[data-tke]'))) { tkForm(t.dataset.tke); return true; }
  if ((t = e.target.closest('[data-tksave]'))) { const id = t.dataset.tksave, o = { funcId: $('#tkF').value, titulo: $('#tkT').value.trim(), frequencia: $('#tkQ').value, auto: $('#tkA').value, ativa: true };
    if (!o.titulo) return alert('Informe a tarefa.'), true; S.tarefas = S.tarefas || []; if (id === 'new') S.tarefas.push({ id: uid('t'), ...o }); else Object.assign(S.tarefas.find(x => x.id === id), o); save(); closeModal(); render(); return true; }
  if ((t = e.target.closest('[data-tkdel]'))) { if (confirm('Excluir esta tarefa?')) { S.tarefas = S.tarefas.filter(x => x.id !== t.dataset.tkdel); save(); closeModal(); render(); } return true; }
  return false;
});
EXT.change.push(async e => { const t = e.target; if (!t.dataset || !t.dataset.tk) return false; const tk = S.tarefas.find(x => x.id === t.dataset.tk), c = tkCiclo(tk); S.tarefasLog = (S.tarefasLog || []).filter(l => !(l.tarefaId === tk.id && l.ciclo === c.k)); if (t.checked) S.tarefasLog.push({ tarefaId: tk.id, ciclo: c.k, feito: true, data: today() }); save(); render(); return true; });
