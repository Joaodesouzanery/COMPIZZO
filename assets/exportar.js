/* Exportar período: Excel (.xlsx) com uma aba por assunto; sem a biblioteca, cai para CSV. */
'use strict';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const EXP_ASSUNTOS = [['rdos', 'RDOs'], ['apont', 'Apontamentos'], ['pres', 'Presença e faltas'], ['ret', 'Retiradas'], ['cx', 'Caixinha'], ['ace', 'Acertos com funcionários'], ['nfse', 'NFS-e e recebimento'], ['area', 'Classificação mensal (área × contrato)'], ['cal', 'Calendário / agenda'], ['dre', 'DRE do período'], ['folha', '13º e vencimentos']];
const inP = (d, p) => !!d && d >= p.ini && d <= p.fim;
const obraTxt = id => (id ? obraNome(id) : '');
function expDados(k, p) {
  const num = v => (v == null || v === '' ? '' : +v);
  switch (k) {
    case 'rdos': return [['Data', 'Obra', 'Local', 'Responsável', 'Presentes', 'Serviços', 'Quantidades por serviço', 'm² (total)', 'HH', 'Ocorrências', 'Observações', 'Origem', 'Receita ganha (itens)']].concat(S.rdos.filter(r => r.status === 'salvo' && inP(r.data, p)).sort((a, b) => a.data.localeCompare(b.data)).map(r => { const c = rdoCalc(r); return [r.data, obraTxt(r.obraId), r.local || '', r.respNome || r.responsavel || '', (r.maoObra || []).join(', '), (r.servicos || []).join(' · ') || r.descricao || '', (r.fases || []).filter(l => +l.qtd).map(l => `${(S.fases.find(f => f.id === l.faseId) || {}).nome || l.nome || 'serviço'}: ${l.qtd} ${l.un || ''}`).join(' | '), c.m2, num(r.hh), (r.ocorrencias || []).join(', '), r.obs || '', r.origem || 'importado', Math.round(c.receita * 100) / 100]; }));
    case 'apont': return [['Obra', 'Início', 'Fim', 'Local', 'Enviado em', 'Obra parada', 'RDOs gerados', 'Texto original']].concat((S.apontamentos || []).filter(a => a.fim >= p.ini && a.ini <= p.fim).map(a => [obraTxt(a.obraId), a.ini, a.fim, a.local || '', a.enviadoEm || '', a.parada ? 'sim' : '', (a.rdoIds || []).length, a.texto]));
    case 'pres': { const L = [['Data', 'Pessoa', 'Função', 'Obra', 'Situação', 'Custo/dia (R$)']]; S.rdos.filter(r => r.status === 'salvo' && inP(r.data, p)).forEach(r => (r.maoObra || []).forEach(n => { const f = findFunc(n), c = f ? custoDiaInfo(f) : { v: null }; L.push([r.data, n, f ? f.funcao || '' : '', obraTxt(r.obraId), 'presente (RDO)', c.v == null ? '' : Math.round(c.v * 100) / 100]); })); (S.faltas || []).filter(x => inP(x.data, p)).forEach(x => { const f = S.funcionarios.find(y => y.id === x.funcId); L.push([x.data, f ? f.nome : x.funcId, f ? f.funcao || '' : '', obraTxt(x.obraId), 'falta: ' + (x.motivo || ''), '']); }); return L.slice(0, 1).concat(L.slice(1).sort((a, b) => a[0].localeCompare(b[0]))); }
    case 'ret': return [['Data', 'Material', 'Qtd', 'Obra / destino', 'Em posse de', 'Responsável', 'Pendência', 'Faltou no estoque', 'Obs']].concat(S.retiradas.filter(r => inP(r.data, p)).sort((a, b) => a.data.localeCompare(b.data)).map(r => [r.data, (S.materiais.find(m => m.id === r.materialId) || {}).nome || r.nomeOriginal || '', r.qtd, r.obraId ? obraNome(r.obraId) : r.destinoTxt || '', r.posse || '', r.responsavel || '', r.pendente || '', r.faltou || '', r.obs || '']));
    case 'cx': return [['Data', 'Tipo', 'Fornecedor', 'Descrição', 'Obra(s)', 'Valor considerado (R$)', 'Valor no texto', 'Valor no documento', 'Documento', 'Nº', 'Série', 'Chave de acesso', 'ID Pix', 'Forma de pagamento', 'Quem pagou / pessoa', 'Acerto', 'Situação do acerto', 'Observações']].concat(S.caixinha.filter(c => inP(c.data, p)).sort((a, b) => a.data.localeCompare(b.data)).map(c => [c.data, c.tipo, c.fornecedor, c.descricao, (c.obras || []).map(o => cxNomeObra(o.obraId)).join(' + ') || 'Geral / Frota', cxVal(c), num(c.valorTexto), num(c.valorDoc), c.docTipo || '', c.docNumero || '', c.docSerie || '', c.docChave || '', c.pixId || '', c.formaPgto || '', c.pessoa || '', c.acerto || '', c.acertoStatus || '', c.obs || '']));
    case 'ace': return [['Data', 'Lançamento', 'Pessoa', 'Tipo de acerto', 'Valor (R$)', 'Situação']].concat(S.caixinha.filter(c => c.acerto && inP(c.data, p)).map(c => [c.data, c.descricao, c.pessoa || '', c.acerto, cxVal(c), c.acertoStatus || 'pendente']));
    case 'nfse': return [['NFS-e', 'Emissão', 'Tomador', 'Obra', 'Contrato', 'Descrição', 'Bruto', 'Retenção federal', 'ISS', 'Líquido', 'Substitui', 'Recebimento', 'Data do recebimento']].concat((S.notasEmitidas || []).filter(n => inP(n.data, p)).sort((a, b) => a.data.localeCompare(b.data)).map(n => [n.numero, n.data, n.tomador, obraTxt(n.obraId), (S.contratos.find(c => c.id === n.contratoId) || {}).nome || 'fora da carteira', n.descricao, n.bruto, n.retFederal, n.iss, n.liquido, n.substitui || '', (n.recebimento || {}).status || 'a confirmar', (n.recebimento || {}).data || '']));
    case 'area': { const X = areasMatriz(p), L = [['Área', ...X.cols, 'Total']]; AREAS.filter(a => X.cel[a]).forEach(a => L.push([a, ...X.cols.map(c => Math.round(((X.cel[a] || {})[c] || 0) * 100) / 100), Math.round(Object.values(X.cel[a]).reduce((x, y) => x + y, 0) * 100) / 100])); return L; }
    case 'cal': return [['Data', 'Obra', 'Atividade', 'Equipe', 'Fonte', 'Parado', 'Substituído por']].concat(S.calendario.filter(e => inP(e.data, p)).sort((a, b) => a.data.localeCompare(b.data)).map(e => [e.data, obraTxt(e.obraId), e.texto, (e.equipe || []).join(', '), e.fonte || '', e.parado ? 'sim' : '', e.substituidoPor || '']));
    case 'dre': { const D = dreCalc(p); return [['Contrato / obra', 'Faturado bruto', 'Retenções', 'Receita líquida', 'Mão de obra', 'Provisão', 'Material', 'Caixinha', 'Indiretos', 'Custo total', 'Resultado', 'Margem s/ líquido (%)', 'Receita ganha (RDOs)', 'Confiança', 'Cobertura de RDO (%)']].concat(D.rows.map(x => [x.R.c.nome, x.R.fat, x.ret, x.R.liq, x.mo, x.prov, x.mat, x.cx, x.ind, x.custo, x.res, x.marg == null ? '' : Math.round(x.marg * 10) / 10, x.R.rec, x.conf, x.cob == null ? '' : Math.round(x.cob)])); }
    case 'folha': { const L = [['Pagamento', 'Vencimento', 'Valor', 'Situação'], ...(S.pagamentos || []).map(x => [x.tipo, x.venc, x.valor, x.status])]; if (S.plano13) { L.push([], ['13º — colaborador', '13º bruto', 'INSS', '1ª parcela', '2ª parcela líquida', 'Parcela única líquida']); S.plano13.linhas.forEach(l => L.push([l.nome, l.bruto, l.inss, l.p1, l.p2, l.unico])); } return L; }
  }
  return [];
}
function expNome(p) { return `compizzo_${p.ini}_a_${p.fim}`; }
function expBaixar(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const csvTxt = rows => '﻿' + rows.map(r => r.map(v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\n');
function expCarregar() { return new Promise((res, rej) => { if (window.XLSX) return res(window.XLSX); const s = document.createElement('script'); s.src = XLSX_URL; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('xlsx')); document.head.appendChild(s); }); }
async function expGerar(ini, fim, sel) {
  const p = { ini, fim, rot: `${fdate(ini)} a ${fdate(fim)}` }, abas = sel.map(k => [k, (EXP_ASSUNTOS.find(a => a[0] === k) || [k, k])[1], expDados(k, p)]);
  try {
    const X = await expCarregar(), wb = X.utils.book_new();
    abas.forEach(([, nome, rows]) => { const ws = X.utils.aoa_to_sheet(rows.length ? rows : [['(sem registros no período)']]); ws['!cols'] = (rows[0] || []).map((_, i) => ({ wch: Math.min(60, Math.max(10, ...rows.slice(0, 60).map(r => String((r[i] == null ? '' : r[i])).length)) + 2) })); X.utils.book_append_sheet(wb, ws, nome.slice(0, 31).replace(/[\\/?*[\]:]/g, '-')); });
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' }); expBaixar(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), expNome(p) + '.xlsx');
    return abas.map(a => `${a[1]}: ${Math.max(0, a[2].length - 1)}`).join(' · ');
  } catch (e) {
    abas.forEach(([k, , rows], i) => setTimeout(() => expBaixar(new Blob([csvTxt(rows)], { type: 'text/csv;charset=utf-8' }), `${expNome(p)}_${k}.csv`), i * 400));
    return 'Biblioteca do Excel indisponível: baixei um CSV por assunto. ' + abas.map(a => `${a[1]}: ${Math.max(0, a[2].length - 1)}`).join(' · ');
  }
}
function expAbrir() {
  const p = (tab.dd && tab.da) ? { ini: tab.dd, fim: tab.da } : { ini: addDays(today(), -30), fim: today() };
  modal(`<h2>Exportar período</h2><p class="sub">Escolha as datas e o que entra. Gera um arquivo Excel (.xlsx) com uma aba por assunto.</p><div class="grid g2" style="gap:10px"><div><label>De</label><input type="date" id="expI" value="${p.ini}"></div><div><label>Até</label><input type="date" id="expF" value="${p.fim}"></div></div>
  <div class="row" style="margin:10px 0 4px;gap:8px"><button class="btn sm" data-exp="r7">últimos 7 dias</button><button class="btn sm" data-exp="r30">últimos 30 dias</button><button class="btn sm" data-exp="mes">mês atual</button><button class="btn sm" data-exp="tudo">tudo</button></div>
  <div style="margin-top:10px">${EXP_ASSUNTOS.map(([k, l]) => `<label style="display:block;margin:6px 0"><input type="checkbox" data-expk="${k}" checked> ${l}</label>`).join('')}</div><p id="expMsg" class="sub"></p>
  <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" data-act="close">Cancelar</button><button class="btn blue" data-exp="go">Baixar Excel</button></div>`);
}
EXT.click.push(async e => {
  const t = e.target.closest('[data-exp]'); if (!t) return false; const k = t.dataset.exp, I = () => $('#expI'), F = () => $('#expF');
  if (k === 'open') { expAbrir(); return true; }
  if (k === 'r7') { I().value = addDays(today(), -7); F().value = today(); return true; }
  if (k === 'r30') { I().value = addDays(today(), -30); F().value = today(); return true; }
  if (k === 'mes') { I().value = today().slice(0, 7) + '-01'; F().value = today(); return true; }
  if (k === 'tudo') { I().value = '2026-06-01'; F().value = today(); return true; }
  if (k === 'go') { const ini = I().value, fim = F().value, sel = [...document.querySelectorAll('[data-expk]:checked')].map(x => x.dataset.expk);
    if (!ini || !fim || ini > fim) { $('#expMsg').textContent = 'Informe um período válido.'; return true; } if (!sel.length) { $('#expMsg').textContent = 'Marque ao menos um assunto.'; return true; }
    $('#expMsg').textContent = 'Gerando…'; $('#expMsg').textContent = await expGerar(ini, fim, sel); return true; }
  return false;
});
