/* Mão de obra → aba "Pessoas": cartões por funcionário, filtros, mapa de presença e detalhe. */
'use strict';
const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// presença de cada pessoa a partir dos RDOs salvos: { funcId: { 'YYYY-MM-DD': obraId } }
function pesPresenca() {
  const m = {};
  S.rdos.filter(r => r.status === 'salvo' && r.obraId).forEach(r => (r.maoObra || []).forEach(nm => { const f = findFunc(nm); if (f) (m[f.id] = m[f.id] || {})[r.data] = r.obraId; }));
  return m;
}
const pesMes = () => tab.pm || today().slice(0, 7);
const pesDias = ym => { const out = []; for (let d = 1; d <= 31; d++) { const iso = `${ym}-${String(d).padStart(2, '0')}`; if (new Date(iso + 'T12:00:00').getMonth() + 1 !== +ym.slice(5)) break; out.push(iso); } return out; };

function pessoasView() {
  const ym = pesMes(), dias = pesDias(ym), pres = pesPresenca(), q = norm(tab.pq || ''), fs = tab.pfs || 'Ativo', cargo = tab.pcg || 'all';
  const cargos = [...new Set(S.funcionarios.map(f => f.funcao).filter(Boolean))].sort();
  const list = S.funcionarios.filter(f => (!q || norm(f.nome + ' ' + (f.nomeCompleto || '') + ' ' + (f.funcao || '')).includes(q)) && (fs === 'all' || (f.status || 'Ativo') === fs) && (cargo === 'all' || f.funcao === cargo)
    && (obraF === 'all' || f.obraId === obraF || Object.values(pres[f.id] || {}).includes(obraF)));
  const doMes = f => Object.keys(pres[f.id] || {}).filter(d => d.startsWith(ym)).length;
  const faltasMes = f => (S.faltas || []).filter(x => x.funcId === f.id && x.data.startsWith(ym)).length;
  const info = f => custoDiaInfo(f);
  const cards = list.map(f => {
    const pr = pres[f.id] || {}, ds = Object.keys(pr).sort(), ult = ds[ds.length - 1], obraAt = ult ? pr[ult] : f.obraId, ci = info(f), dm = doMes(f), fm = faltasMes(f);
    const av = S.avaliacoes.filter(a => a.funcId === f.id).sort((a, b) => a.periodo.localeCompare(b.periodo)), la = av[av.length - 1];
    const strip = dias.filter(d => d <= today()).slice(-21).map(d => `<i title="${fdate(d)}" style="background:${pr[d] ? obraCor(pr[d]) : (S.faltas || []).some(x => x.funcId === f.id && x.data === d) ? 'var(--red)' : 'var(--line)'}"></i>`).join('');
    return `<div class="pc" data-pdet="${f.id}"><div class="row" style="flex-wrap:nowrap;gap:12px"><div class="av" style="background:${obraAt ? obraCor(obraAt) : 'var(--mut)'}">${esc(iniciais(f.nome))}</div><div style="min-width:0;flex:1"><b>${esc(f.nome)}</b><small style="display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.funcao || 'função a informar')}${f.naLista === false ? ' · fora da lista' : ''}</small></div><span class="pill ${(f.status || 'Ativo') === 'Ativo' ? 'g' : 'a'}">${esc(f.status || 'Ativo')}</span></div>
      <div class="row" style="margin-top:8px;gap:6px"><span class="pill b">${obraAt ? esc(short(obraNome(obraAt))) : 'sem obra'}</span>${la ? `<span class="pill ${classCss(la.cls)}">${esc(la.cls)}</span>` : '<span class="pill">sem avaliação</span>'}</div>
      <div class="pm"><div><span class="mono">Dias</span><b>${dm}</b></div><div><span class="mono">Faltas</span><b class="${fm ? 'red' : ''}">${fm}</b></div><div><span class="mono">Custo/dia</span><b>${ci.v == null ? '<span class="pill a">informar</span>' : brl(ci.v) + (ci.est ? ' <small>est.</small>' : '')}</b></div></div>
      <div class="pst">${strip}</div></div>`;
  }).join('');
  const folha = list.reduce((a, f) => { const c = info(f).v; return a + (c || 0) * doMes(f); }, 0), semCusto = list.filter(f => info(f).v == null).length;
  const k = (t, v, sub) => `<div class="card kpi" style="margin:0"><div class="mono">${t}</div><div class="v" style="font-size:26px">${v}</div><small class="sub">${sub}</small></div>`;
  const hoje = today(), presHoje = list.filter(f => (pres[f.id] || {})[hoje]).length;
  const kpis = `<div class="grid g4" style="margin-bottom:14px">${k('Pessoas no filtro', list.length, `${S.funcionarios.length} cadastradas`)}${k('Presentes hoje', presHoje, 'pelos RDOs de ' + fdate(hoje))}${k('Custo de MO no mês', brl(folha), `${MESES[+ym.slice(5) - 1]} · presença × custo/dia`)}${k('Sem custo/dia', semCusto, semCusto ? 'cadastre salário ou diária' : 'tudo coberto')}</div>`;
  const bar = `<div class="row sp" style="margin-bottom:12px"><div class="row"><input id="pq" placeholder="Buscar pessoa ou cargo…" value="${esc(tab.pq || '')}"><select data-pf="pcg"><option value="all">Todos os cargos</option>${cargos.map(c => `<option ${c === cargo ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><div class="tabs" style="margin:0">${['Ativo', 'Férias', 'Afastado', 'Desligado', 'all'].map(k => `<button data-pfs="${k}" class="${fs === k ? 'on' : ''}">${k === 'all' ? 'Todos' : k}</button>`).join('')}</div></div><div class="row"><button class="btn sm" data-pmo="-1">◀</button><b>${MESES[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</b><button class="btn sm" data-pmo="1">▶</button><button class="btn pri sm" data-cad="newFunc">Novo funcionário</button></div></div>`;
  // mapa de presença
  const rows = list.map(f => { const pr = pres[f.id] || {}; return `<tr><td style="white-space:nowrap"><b>${esc(f.nome)}</b></td>${dias.map(d => { const ob = pr[d], fa = (S.faltas || []).some(x => x.funcId === f.id && x.data === d), dom = dowIdx(d) === 6, fer = S.feriados[d];
    return `<td class="pmc ${dom || fer ? 'off' : ''}" title="${fdate(d)}${ob ? ' · ' + esc(obraNome(ob)) : ''}">${ob ? `<i style="background:${obraCor(ob)}"></i>` : fa ? '<b class="red">F</b>' : ''}</td>`; }).join('')}<td class="n">${doMes(f)}</td></tr>`; }).join('');
  const mapa = `<div class="card tw"><div class="row sp"><h2>Mapa de presença</h2><span class="mono">cor = obra do RDO · F = falta · cinza = domingo/feriado</span></div><table class="pmap"><tr><th>Pessoa</th>${dias.map(d => `<th class="pmc">${+d.slice(8)}</th>`).join('')}<th class="n">Dias</th></tr>${rows || `<tr><td colspan="${dias.length + 2}">Ninguém no filtro.</td></tr>`}</table>
    <div class="legend">${S.obras.filter(o => Object.values(pres).some(p => Object.values(p).includes(o.id))).map(o => `<span><i class="sw" style="border-color:${obraCor(o.id)};background:${obraCor(o.id)}"></i>${esc(short(o.nome))}</span>`).join('')}</div></div>`;
  return `${kpis}${bar}<div class="pgrid">${cards || '<div class="card">Ninguém encontrado neste filtro.</div>'}</div>${mapa}`;
}

function pessoaDetalhe(id) {
  const f = S.funcionarios.find(x => x.id === id); if (!f) return;
  const pres = pesPresenca()[id] || {}, ds = Object.keys(pres).sort(), ci = custoDiaInfo(f), porObra = {};
  ds.forEach(d => (porObra[pres[d]] = porObra[pres[d]] || []).push(d));
  const rdos = S.rdos.filter(r => r.status === 'salvo' && (r.maoObra || []).some(n => { const x = findFunc(n); return x && x.id === id; }));
  let m2 = 0, rec = 0; rdos.forEach(r => { const k = rdoCalc(r), n = (r.maoObra || []).length || 1; m2 += k.m2 / n; rec += k.receita / n; });
  const fl = (S.faltas || []).filter(x => x.funcId === id).sort((a, b) => b.data.localeCompare(a.data)), av = S.avaliacoes.filter(a => a.funcId === id).sort((a, b) => b.periodo.localeCompare(a.periodo));
  const eq = S.equipes.find(e => (e.membros || []).includes(id) || e.lider === f.nome);
  const kv = (l, v) => `<div><span class="mono">${l}</span><br><b>${v}</b></div>`;
  modal(`<div class="row sp"><div class="row" style="flex-wrap:nowrap;gap:12px"><div class="av" style="width:48px;height:48px;font-size:18px;background:${ds.length ? obraCor(pres[ds[ds.length - 1]]) : 'var(--mut)'}">${esc(iniciais(f.nome))}</div><div><h2 style="font-size:20px">${esc(f.nomeCompleto || f.nome)}</h2><small class="sub">${esc(f.funcao || '—')} · ${esc(f.contrato || '—')}${f.matricula ? ' · mat. ' + esc(f.matricula) : ''}</small></div></div><button class="btn sm" data-cad="editFunc:${f.id}">Editar</button></div>
  <div class="grid g3" style="margin:14px 0;gap:10px">${kv('Custo/dia', ci.v == null ? 'informar' : brl(ci.v) + (ci.est ? ' (estimado)' : ''))}${kv('Dias com RDO', ds.length)}${kv('Custo acumulado', ci.v == null ? '—' : brl(ci.v * ds.length))}${kv('m² atribuídos', nfmt(m2))}${kv('Rendimento (média)', rec ? brl(rec) : '—')}${kv('Faltas', fl.length)}</div>
  <h3 style="margin:10px 0 4px">Por obra</h3>${Object.entries(porObra).map(([o, d]) => `<div class="row" style="padding:4px 0;border-bottom:1px solid var(--line)"><i class="sw" style="border-color:${obraCor(o)};background:${obraCor(o)}"></i><b>${esc(short(obraNome(o)))}</b><span class="sub" style="margin:0">${d.length} dia(s) · ${fdate(d[0])} → ${fdate(d[d.length - 1])}</span></div>`).join('') || '<p class="sub">Sem presença nos RDOs.</p>'}
  <h3 style="margin:14px 0 4px">Equipe</h3><p class="sub" style="margin:0">${eq ? esc(eq.nome) + ' · líder ' + esc(eq.lider || '—') : 'sem equipe vinculada'}</p>
  <h3 style="margin:14px 0 4px">Faltas</h3>${fl.map(x => `<div class="sub" style="margin:0">${fdate(x.data)} · ${esc(x.motivo || '')}</div>`).join('') || '<p class="sub" style="margin:0">Nenhuma falta registrada.</p>'}
  <h3 style="margin:14px 0 4px">Avaliações</h3>${av.map(a => `<div class="row"><span class="pill ${classCss(a.cls)}">${esc(a.cls)}</span> ${esc(a.periodo)} · nota ${nfmt(a.nota)}</div>`).join('') || '<p class="sub" style="margin:0">Sem avaliações ainda.</p>'}
  <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-act="close">Fechar</button></div>`);
}

EXT.click.push(async e => {
  const d = e.target.closest('[data-pdet]'); if (d) { pessoaDetalhe(d.dataset.pdet); return true; }
  const s = e.target.closest('[data-pfs]'); if (s) { tab.pfs = s.dataset.pfs; render(); return true; }
  const m = e.target.closest('[data-pmo]'); if (m) { const [y, mo] = pesMes().split('-').map(Number), t = new Date(y, mo - 1 + +m.dataset.pmo, 1); tab.pm = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; render(); return true; }
  return false;
});
EXT.change.push(async e => { const t = e.target; if (t.dataset && t.dataset.pf) { tab[t.dataset.pf] = t.value; render(); return true; } return false; });
EXT.input.push(async e => { const t = e.target; if (t.id !== 'pq') return false; tab.pq = t.value; const pos = t.selectionStart; render(); const n = document.getElementById('pq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return true; });
