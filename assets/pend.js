/* Pendências automáticas (o que cobrar) e lembretes recorrentes, exibidos em "Hoje". */
'use strict';
function pendenciasAuto() {
  const out = [], hoje = today(), ini14 = addDays(hoje, -14);
  const add = (grupo, texto, nav) => out.push({ grupo, texto, nav });
  // campo / RDO
  const rs = S.rdos.filter(r => r.status === 'salvo' && r.obraId && r.data >= ini14);
  const semEq = rs.filter(r => !(r.maoObra || []).length && !(r.pessoas));
  if (semEq.length) add('Campo (RDO / apontamento)', `${semEq.length} RDO(s) dos últimos 14 dias sem equipe presente — sem isso não dá para calcular o custo do dia (${semEq.slice(0, 4).map(r => short(obraNome(r.obraId)) + ' ' + fdate(r.data).slice(0, 5)).join(', ')}${semEq.length > 4 ? '…' : ''})`, 'prod');
  const semHH = rs.filter(r => !r.hh);
  if (semHH.length) add('Campo (RDO / apontamento)', `${semHH.length} RDO(s) dos últimos 14 dias sem horas trabalhadas (HH) — o RUP fica sem cálculo`, 'prod');
  const semQtd = rs.filter(r => !rdoCalc(r).m2 && !(r.fases || []).length);
  if (semQtd.length) add('Campo (RDO / apontamento)', `${semQtd.length} RDO(s) sem quantitativo executado (m², m, un)`, 'prod');
  const w = dowIdx(hoje) === 0 ? addDays(hoje, -7) : addDays(hoje, -dowIdx(hoje));
  const faltantes = []; S.obras.filter(o => o.status === 'Em andamento' && obraWindow(o)).forEach(o => { const win = obraWindow(o); for (let d = w; d <= addDays(w, 5) && d < hoje; d = addDays(d, 1)) if (d >= win.ini && d <= win.fim && diaUtil(d) && !S.rdos.some(r => r.obraId === o.id && r.data === d && r.status === 'salvo')) faltantes.push(short(o.nome) + ' ' + fdate(d).slice(0, 5)); });
  if (faltantes.length) add('Campo (RDO / apontamento)', `${faltantes.length} dia(s) sem RDO na semana (${faltantes.slice(0, 6).join(', ')}${faltantes.length > 6 ? '…' : ''}) — ver Desempenho → Cobrança semanal`, 'prod');
  // cadastro e custos
  const semCusto = S.funcionarios.filter(f => f.status !== 'Desligado' && f.naLista !== false && custoDia(f) == null);
  if (semCusto.length) add('Pessoas e custos', `Sem custo/dia (salário, diária ou taxa): ${semCusto.map(f => f.nome).join(', ')}`, 'mao');
  const semFora = S.funcionarios.filter(f => f.naLista === false);
  if (semFora.length) add('Pessoas e custos', `Fora da planilha de cadastro (confirmar se ainda trabalham): ${semFora.map(f => f.nome).join(', ')}`, 'mao');
  const incompletos = S.funcionarios.filter(f => f.naLista !== false && f.status !== 'Desligado' && (!f.matricula || !f.admissao || !f.setor));
  if (incompletos.length) add('Pessoas e custos', `Cadastro incompleto (matrícula, admissão ou departamento): ${incompletos.map(f => f.nome).join(', ')}`, 'mao');
  // contratos
  (S.contratos || []).forEach(c => { if (!c.inicio || !c.fim) add('Contratos', `${c.nome}: faltam datas de início/fim e as medições (valor já faturado)`, 'contratos'); });
  // estoque / compras / financeiro
  const rp = S.retiradas.filter(r => r.pendente); if (rp.length) add('Estoque', `${rp.length} retirada(s) com pendência (destino ou material a identificar): ${rp.slice(0, 4).map(r => r.nomeOriginal).join(', ')}`, 'estoque');
  const rf = S.retiradas.filter(r => r.faltou); if (rf.length) add('Estoque', `${rf.length} retirada(s) maiores que o saldo (${[...new Set(rf.map(r => (S.materiais.find(m => m.id === r.materialId) || {}).nome))].join(', ')}) — fazer contagem`, 'estoque');
  const cx = (S.caixinha || []).filter(r => !r.docTipo || r.docTipo === 'Sem documento'); if (cx.length) add('Compras / Caixinha', `${cx.length} lançamento(s) da Caixinha sem nota/cupom (${brl(cx.reduce((a, r) => a + cxVal(r), 0))})`, 'compras');
  const venc = []; S.boletos.forEach(b => b.parcelas.forEach(p => { if (!p.pago && p.venc < hoje) venc.push(`${b.fornecedor} ${fdate(p.venc)} ${brl(p.valor)}`); })); if (venc.length) add('Compras / Caixinha', `Boleto(s) vencido(s): ${venc.join('; ')}`, 'compras');
  const sNF = S.boletos.filter(b => /informar/i.test(b.nf || '')); if (sNF.length) add('Compras / Caixinha', `Boleto sem nº da NF: ${sNF.map(b => b.fornecedor + ' ' + brl(b.totalNF)).join('; ')}`, 'compras');
  const semPreco = S.obras.filter(o => o.status === 'Em andamento' && !(o.precoPiso > 0) && !Object.keys(o.fasePreco || {}).length); if (semPreco.length) add('Receita', `Obras em andamento sem preço/contrato: ${semPreco.map(o => short(o.nome)).join(', ')}`, 'prod');
  return out;
}
function pendCard() {
  const lemb = (S.lembretes || []).filter(l => l.dow === dowIdx(today()));
  const q = S.perguntasAbertas || [], auto = pendenciasAuto(), grupos = {};
  auto.forEach(a => (grupos[a.grupo] = grupos[a.grupo] || []).push(a));
  const mon = lemb.map(l => `<div class="alert" style="margin-bottom:10px;background:var(--ambS);border-color:#ecd48a"><b class="amb">🔔 Lembrete de hoje</b><br>${esc(l.texto)} <button class="btn sm" data-nav="prod" data-goto="desemp">Abrir cobrança semanal</button></div>`).join('');
  const cnt = q.length + auto.length; if (!cnt && !mon) return '';
  return `${mon}<details class="card" style="margin-bottom:14px" ${cnt <= 8 ? 'open' : ''}><summary style="cursor:pointer"><b>${cnt} pendência(s) para cobrar</b> <small class="sub">— perguntas em aberto e dados que faltam</small></summary>
  ${q.length ? `<h2 style="margin:12px 0 6px;font-size:14px">Perguntas em aberto</h2><ul style="margin:0;padding-left:18px">${q.map(x => `<li>${esc(x.texto)} <button class="btn sm" data-q="${x.id}">Resolvida</button></li>`).join('')}</ul>` : ''}
  ${Object.entries(grupos).map(([g, l]) => `<h2 style="margin:12px 0 6px;font-size:14px">${esc(g)}</h2><ul style="margin:0;padding-left:18px">${l.map(a => `<li>${esc(a.texto)}${a.nav ? ` <button class="btn sm" data-nav="${a.nav}">Ver</button>` : ''}</li>`).join('')}</ul>`).join('')}</details>`;
}
