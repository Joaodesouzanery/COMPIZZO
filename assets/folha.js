/* Mão de obra › Folha e 13º: planejamento de pagamentos (13º em duas parcelas × parcela única) e vencimentos. */
'use strict';
CAD.folha = function () {
  const p = S.plano13; if (!p) return '<div class="card"><p class="sub">Nenhum planejamento de pagamento cadastrado.</p></div>';
  const cen = tab.f13 || 'duas', T = p.totais, L = p.linhas;
  const k = (t, v, s) => `<div class="card kpi" style="margin:0;padding:16px"><div class="mono">${t}</div><div class="v" style="font-size:24px">${v}</div><small class="sub">${s}</small></div>`;
  const cad = S.funcionarios.filter(f => f.contrato === 'CLT' && f.naLista !== false && !L.some(l => l.func === f.id)).map(f => f.nome);
  const hoje = today(), dd = v => Math.round((new Date(v) - new Date(hoje)) / 864e5);
  const pg = (S.pagamentos || []).map(x => `<tr><td>${esc(x.tipo)}</td><td>${fdate(x.venc)}</td><td class="n">${brl(x.valor)}</td><td>${x.status === 'pago' ? '<span class="pill g">pago</span>' : `<span class="pill ${dd(x.venc) < 0 ? 'r' : dd(x.venc) <= 14 ? 'a' : ''}">${dd(x.venc) < 0 ? 'vencido' : 'em ' + dd(x.venc) + ' dias'}</span>`}</td><td><select data-pgs="${x.id}"><option value="a pagar" ${x.status !== 'pago' ? 'selected' : ''}>a pagar</option><option value="pago" ${x.status === 'pago' ? 'selected' : ''}>pago</option></select></td></tr>`).join('');
  const cols = cen === 'duas' ? ['1ª parcela', '2ª parcela (líquida)'] : ['Líquido (parcela única)'];
  const rows = L.map(l => { const f = S.funcionarios.find(x => x.id === l.func); return `<tr><td><b>${esc(l.nome)}</b><small>${f ? esc(f.funcao || '') : 'fora do cadastro'}</small></td><td class="n">${brl(l.bruto)}</td><td class="n">${brl(l.inss)}</td>${cen === 'duas' ? `<td class="n">${brl(l.p1)}</td><td class="n">${brl(l.p2)}</td>` : `<td class="n">${brl(l.unico)}</td>`}</tr>`; }).join('');
  const tr = `<tr style="font-weight:600"><td>Total</td><td class="n">${brl(T.bruto)}</td><td class="n">${brl(T.inss)}</td>${cen === 'duas' ? `<td class="n">${brl(T.p1)}</td><td class="n">${brl(T.p2)}</td>` : `<td class="n">${brl(T.unico)}</td>`}</tr>`;
  return `<div class="grid g4" style="margin-bottom:14px">${k('13º bruto (simulação)', brl(T.bruto), `${L.length} colaboradores · ${esc(p.vinculo)}`)}${k('INSS sobre o 13º', brl(T.inss), 'IRRF R$ 0,00')}${k('1ª parcela (até 30/11)', brl(T.p1), 'metade do bruto, sem descontos')}${k('2ª parcela líquida', brl(T.p2), 'prazo legal 20/12 (domingo) → pagar em 18/12')}</div>
  <div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Planejamento do 13º salário 2026</h2><div class="tabs" style="margin:0"><button data-f13="duas" class="${cen === 'duas' ? 'on' : ''}">Duas parcelas</button><button data-f13="unica" class="${cen === 'unica' ? 'on' : ''}">Parcela única em dezembro</button></div></div>
  <table class="zebra"><tr><th>Colaborador</th><th class="n">13º bruto</th><th class="n">INSS</th>${cols.map(c => `<th class="n">${c}</th>`).join('')}</tr>${rows}${tr}</table>
  <p class="sub" style="margin:8px 0 0">${cen === 'duas' ? 'Primeira parcela até 30/11; segunda até 20/12 (programar 18/12, pois 20 é domingo).' : '<b class="bad">Atenção:</b> pagar tudo só em dezembro ultrapassa o prazo de 30/11 da 1ª parcela (conforme a própria simulação). Total líquido ' + brl(T.unico) + '.'} Adiantamentos anteriores não foram considerados. Preparado em ${fdate(p.preparado)}.</p>
  ${cad.length ? `<div class="alert" style="margin-top:10px;background:var(--ambS);border-color:var(--line)"><b class="amb">Fora da simulação</b>: ${cad.map(esc).join(', ')} constam como CLT no cadastro mas não aparecem no 13º — conferir se foi omissão.</div>` : ''}</div>
  <div class="card tw"><h2>Vencimentos de folha</h2><table class="zebra"><tr><th>Pagamento</th><th>Vencimento</th><th class="n">Valor</th><th>Prazo</th><th>Situação</th></tr>${pg}</table></div>`;
};
EXT.click.push(async e => { const t = e.target.closest('[data-f13]'); if (!t) return false; tab.f13 = t.dataset.f13; render(); return true; });
EXT.change.push(async e => { const t = e.target; if (!t.dataset || !t.dataset.pgs) return false; S.pagamentos.find(x => x.id === t.dataset.pgs).status = t.value; save(); render(); return true; });
