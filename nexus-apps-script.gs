// ════════════════════════════════════════════════════════════
//  NEXUS ACADEMY — Google Apps Script
//  Cole este código em: script.google.com → Novo projeto
//  Depois: Implantar → Nova implantação → Tipo: App da Web
//  Executar como: Eu mesmo | Acesso: Qualquer pessoa
//  Copie a URL gerada e cole em NEXUS_SHEET_URL nos HTMLs
// ════════════════════════════════════════════════════════════

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── Nomes das abas ──
const ABA_IKIGAI   = 'iKigai';
const ABA_XP       = 'XP';
const ABA_ALUNOS   = 'Alunos';
const ABA_RANKING  = 'Ranking';

// ════ PONTO DE ENTRADA ════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const tipo = data.tipo;

    if (tipo === 'ikigai')  return salvarIkigai(data);
    if (tipo === 'xp')      return salvarXP(data);
    if (tipo === 'aluno')   return salvarAluno(data);

    return resposta(false, 'Tipo desconhecido: ' + tipo);
  } catch(err) {
    return resposta(false, err.message);
  }
}

function doGet(e) {
  const acao = e.parameter.acao;
  if (acao === 'ranking') return getRanking();
  if (acao === 'aluno')   return getAluno(e.parameter.nome);
  return resposta(true, 'NEXUS API online');
}

// ════ SALVAR IKIGAI ════
function salvarIkigai(d) {
  const aba = getOrCreateAba(ABA_IKIGAI, [
    'Data','Nome','Turma','Idade','Arquétipo','Nicho',
    'XP iKigai','Paixão%','Talento%','Impacto%','Mercado%',
    'Ama','Faz Bem','Mundo Precisa','Pagariam'
  ]);
  
  // Verifica se já existe e atualiza
  const dados = aba.getDataRange().getValues();
  let linhaExistente = -1;
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][1] === d.nome) { linhaExistente = i + 1; break; }
  }
  
  const linha = [
    new Date().toLocaleDateString('pt-BR'),
    d.nome || '', d.turma || '', d.idade || '',
    d.archetype || '', d.niche || '', d.xp || 0,
    d.score_love || '', d.score_skill || '',
    d.score_world || '', d.score_paid || '',
    d.ama || '', d.fazBem || '', d.mundo || '', d.pagariam || ''
  ];
  
  if (linhaExistente > 0) {
    aba.getRange(linhaExistente, 1, 1, linha.length).setValues([linha]);
  } else {
    aba.appendRow(linha);
  }
  
  // Também garante o aluno na aba Alunos
  salvarAluno({ nome: d.nome, turma: d.turma, idade: d.idade, avatar: d.avatar || '🚀' });
  
  return resposta(true, 'iKigai salvo: ' + d.nome);
}

// ════ SALVAR XP ════
function salvarXP(d) {
  const aba = getOrCreateAba(ABA_XP, [
    'Data','Hora','Nome','Turma','Fase','Missão',
    'XP Ganho','XP Acumulado','Nível','Streak'
  ]);
  
  aba.appendRow([
    new Date().toLocaleDateString('pt-BR'),
    new Date().toLocaleTimeString('pt-BR'),
    d.nome || '', d.turma || '',
    'Fase ' + (d.fase || '?'),
    d.missao || '',
    d.xp || 0,
    d.xpTotal || 0,
    d.nivel || '',
    d.streak || 0
  ]);
  
  atualizarRanking();
  return resposta(true, 'XP registrado: ' + d.nome + ' +' + d.xp);
}

// ════ SALVAR ALUNO ════
function salvarAluno(d) {
  const aba = getOrCreateAba(ABA_ALUNOS, [
    'Nome','Turma','Idade','Avatar','Data Cadastro','Ativo'
  ]);
  
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === d.nome) return resposta(true, 'Aluno já existe');
  }
  
  aba.appendRow([
    d.nome || '', d.turma || '', d.idade || '',
    d.avatar || '🚀',
    new Date().toLocaleDateString('pt-BR'),
    'Sim'
  ]);
  
  return resposta(true, 'Aluno cadastrado: ' + d.nome);
}

// ════ RANKING ════
function atualizarRanking() {
  const abaXP = getOrCreateAba(ABA_XP, []);
  const abaR  = getOrCreateAba(ABA_RANKING, [
    'Posição','Nome','Turma','XP Total','Nível','Missões','Última Atividade'
  ]);
  
  const xpDados = abaXP.getDataRange().getValues().slice(1);
  const map = {};
  
  xpDados.forEach(row => {
    const nome = row[2];
    if (!nome) return;
    if (!map[nome]) map[nome] = { nome, turma: row[3], xp: 0, missoes: 0, nivel: '', ultima: '' };
    map[nome].xp = Math.max(map[nome].xp, row[7] || 0);
    map[nome].missoes++;
    map[nome].nivel = row[8] || '';
    map[nome].ultima = row[0];
  });
  
  const sorted = Object.values(map).sort((a, b) => b.xp - a.xp);
  
  // Limpa e reescreve ranking
  const dados = abaR.getDataRange().getValues();
  if (dados.length > 1) abaR.deleteRows(2, dados.length - 1);
  
  sorted.forEach((a, i) => {
    abaR.appendRow([i + 1, a.nome, a.turma, a.xp, a.nivel, a.missoes, a.ultima]);
  });
}

function getRanking() {
  const aba = getOrCreateAba(ABA_RANKING, []);
  const dados = aba.getDataRange().getValues();
  const headers = dados[0];
  const rows = dados.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ranking: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAluno(nome) {
  const abaXP = getOrCreateAba(ABA_XP, []);
  const dados = abaXP.getDataRange().getValues().slice(1);
  const registros = dados.filter(r => r[2] === nome);
  const xpTotal = registros.length ? Math.max(...registros.map(r => r[7] || 0)) : 0;
  const missoes = registros.length;
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, nome, xpTotal, missoes }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════ HELPERS ════
function getOrCreateAba(nome, headers) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let aba   = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    if (headers.length) {
      aba.appendRow(headers);
      aba.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#080E20')
         .setFontColor('#00D4FF');
      aba.setFrozenRows(1);
    }
  }
  return aba;
}

function resposta(ok, msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok, msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
