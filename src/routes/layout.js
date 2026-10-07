// Bloqueio de acesso + menu + funções comuns (usado por todas as páginas do painel)
// Enquanto estiver false, as páginas abrem sem login. Quando o login estiver pronto, troque para true.
const REQUER_LOGIN = false;
if (REQUER_LOGIN && !sessionStorage.ID_USUARIO) { window.location.replace("../login.html"); }

const MENU = [
  ['visao-especifica.html', 'Visão Específica'],
  ['dashboard2.html', 'Visão Geral'],
  ['usuarios.html', 'Usuários'],
  ['maquinas.html', 'Máquinas'],
  ['alertas.html', 'Alertas']
];

const fa = document.createElement('script');
fa.src = 'https://kit.fontawesome.com/9f7414eb10.js';
fa.crossOrigin = 'anonymous';
document.head.append(fa);

document.addEventListener('DOMContentLoaded', function () {
  const atual = location.pathname.split('/').pop();
  document.getElementById('menu').innerHTML =
    '<div class="brand"><div class="brand-logo"><i class="fa-solid fa-fire"></i></div><span class="brand-name">Mon<span>Fire</span></span></div>' +
    '<nav class="nav">' + MENU.map(m => `<a href="${m[0]}"${m[0] == atual ? ' class="ativo"' : ''}>${m[1]}</a>`).join('') + '</nav>' +
    '<div class="user-box">Olá, <strong id="nome_menu"></strong></div>' +
    '<button class="btn-sair" type="button" onclick="sair()">Sair</button>';
  document.getElementById('nome_menu').textContent = sessionStorage.NOME_USUARIO || 'visitante';
});

function sair() {
  sessionStorage.clear();
  window.location.replace("../login.html");
}

function selo(t) {
  const tipo = { 'Crítico': 'critico', 'Offline': 'critico', 'Atenção': 'atencao', 'Manutenção': 'atencao' }[t] || 'ok';
  return `<span class="selo ${tipo}">${t}</span>`;
}

function tabela(id, cab, linhas, classe) {
  document.getElementById(id).innerHTML = '<table><thead><tr>' + cab.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
    linhas.map(l => `<tr class="${classe ? classe(l) : ''}">` + l.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
}

function kpis(id, lista) {
  document.getElementById(id).innerHTML = lista.map(k =>
    `<div class="kpi${k[2] ? ' destaque' : ''}"><div class="kpi-valor">${k[0]}</div><div class="kpi-rotulo">${k[1]}</div></div>`).join('');
}