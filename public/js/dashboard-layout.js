document.addEventListener("DOMContentLoaded", function () {
    var nomeUsuario = sessionStorage.NOME_USUARIO || "Usuário administrador";

    document.querySelectorAll("[data-nome-usuario]").forEach(function (elemento) {
        elemento.textContent = nomeUsuario;
    });
});

function selo(texto) {
    var classes = {
        "Crítico": "critico",
        "Offline": "critico",
        "Atenção": "atencao",
        "Manutenção": "atencao"
    };
    var tipo = classes[texto] || "ok";

    return `<span class="selo ${tipo}">${texto}</span>`;
}

function tabela(id, cabecalho, linhas, obterClasse) {
    document.getElementById(id).innerHTML = `
        <table>
            <thead>
                <tr>${cabecalho.map(function (coluna) {
                    return `<th>${coluna}</th>`;
                }).join("")}</tr>
            </thead>
            <tbody>${linhas.map(function (linha) {
                var classe = obterClasse ? obterClasse(linha) : "";
                return `<tr class="${classe}">${linha.map(function (coluna) {
                    return `<td>${coluna}</td>`;
                }).join("")}</tr>`;
            }).join("")}</tbody>
        </table>`;
}

function kpis(id, lista) {
    document.getElementById(id).innerHTML = lista.map(function (item) {
        var destaque = item[2] ? " destaque" : "";
        return `
            <div class="kpi${destaque}">
                <div class="kpi-valor">${item[0]}</div>
                <div class="kpi-rotulo">${item[1]}</div>
            </div>`;
    }).join("");
}
