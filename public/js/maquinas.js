var maquinasMonFire = [];

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatarDataCadastro(dataCadastro) {
    var data = new Date(dataCadastro);

    if (Number.isNaN(data.getTime())) {
        return "Não informada";
    }

    return data.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function montarKpisMaquinas() {
    var sistemasOperacionais = new Set(
        maquinasMonFire.map(function (maquina) {
            return String(maquina.sistemaOperacional).trim().toLowerCase();
        }).filter(Boolean)
    );

    document.getElementById("kpis_maquinas").innerHTML = `
        <div class="kpi">
            <div class="kpi-valor">${maquinasMonFire.length}</div>
            <div class="kpi-rotulo">Total de máquinas</div>
        </div>
        <div class="kpi">
            <div class="kpi-valor">${sistemasOperacionais.size}</div>
            <div class="kpi-rotulo">Sistemas operacionais</div>
        </div>
        <div class="kpi destaque">
            <div class="kpi-valor">${maquinasMonFire.length}</div>
            <div class="kpi-rotulo">Aguardando métricas</div>
        </div>`;
}

function montarTabelaMaquinas() {
    var tabela = document.getElementById("tabela_maquinas");

    if (maquinasMonFire.length == 0) {
        tabela.innerHTML = '<div class="estado-vazio-maquinas">Nenhuma máquina foi encontrada para esta empresa.</div>';
        return;
    }

    var linhas = maquinasMonFire.map(function (maquina) {
        return `
            <tr>
                <td><b>${escaparHtml(maquina.nome)}</b></td>
                <td>${escaparHtml(maquina.mac)}</td>
                <td>${escaparHtml(maquina.ip)}</td>
                <td>${escaparHtml(maquina.sistemaOperacional)}</td>
                <td>${escaparHtml(formatarDataCadastro(maquina.dataCadastro))}</td>
                <td>Aguardando métricas</td>
                <td><span class="selo manutencao">Aguardando métricas</span></td>
            </tr>`;
    }).join("");

    tabela.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Servidor</th>
                    <th>MAC</th>
                    <th>IP</th>
                    <th>Sistema operacional</th>
                    <th>Cadastro</th>
                    <th>Uptime</th>
                    <th>Situação</th>
                </tr>
            </thead>
            <tbody>${linhas}</tbody>
        </table>`;
}

function atualizarTelaMaquinas() {
    montarKpisMaquinas();
    montarTabelaMaquinas();
}

async function carregarMaquinas() {
    var idEmpresa = Number(sessionStorage.ID_EMPRESA);
    var mensagem = document.getElementById("mensagem_maquinas");

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        mensagem.textContent = "Não foi possível identificar a empresa do usuário conectado.";
        atualizarTelaMaquinas();
        return;
    }

    mensagem.textContent = "Carregando máquinas...";

    try {
        var resposta = await fetch("/maquinas/listar/" + idEmpresa);

        if (!resposta.ok) {
            throw new Error(await resposta.text());
        }

        maquinasMonFire = await resposta.json();
        mensagem.textContent = "";
    } catch (erro) {
        maquinasMonFire = [];
        mensagem.textContent = erro.message || "Não foi possível carregar as máquinas.";
    }

    atualizarTelaMaquinas();
}

document.addEventListener("DOMContentLoaded", function () {
    atualizarTelaMaquinas();
    carregarMaquinas();
});
