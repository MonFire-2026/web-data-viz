const CONFIG_DASH = {
    INTERVALO_ATUALIZACAO_MS: 10000,
    LIMITE_HISTORICO_GRAFICO: 10,
    LIMITE_TABELA_APLICATIVOS: 10,
    LIMIAR_RISCO_ALTO: 60.0,
    LIMIAR_RISCO_MODERADO: 45.0,
    IDS: {
        kpiTotalProcessos: "kpiTotalProcessos",
        kpiMaiorConsumo: "kpiMaiorConsumo",
        cardRisco: "kpiRisco",
        kpiRiscoNivel: "kpiRiscoNivel",
        limiteRisco: "limiteRisco",
        canvasGrafico: "graficoCorrelacao",
        avisoProcessos: "avisoProcessos",
        tbodyProcessos: "tabelaProcessos",
        faixaAlerta: "faixaAlerta",
        textoAlerta: "textoAlerta"
    }
};

let graficoCorrelacao = null;
let timerAtualizacao = null;

window.addEventListener("DOMContentLoaded", () => {
    definirTexto(CONFIG_DASH.IDS.limiteRisco, CONFIG_DASH.LIMIAR_RISCO_ALTO);
    atualizarDashboardProcessos();

    timerAtualizacao = setInterval(
        atualizarDashboardProcessos,
        CONFIG_DASH.INTERVALO_ATUALIZACAO_MS
    );
});

function obterIdMaquinaAtual() {
    const params = new URLSearchParams(window.location.search);
    const idUrl = params.get("idMaquina");
    if (idUrl) return idUrl;

    return sessionStorage.ID_MAQUINA || 1;
}

async function atualizarDashboardProcessos() {
    const idMaquina = obterIdMaquinaAtual();

    try {
        const [respAtual, respCorrelacao] = await Promise.all([
            fetch(`/medidas/processos/atual/${idMaquina}`),
            fetch(`/medidas/processos/correlacao/${idMaquina}?limite=${CONFIG_DASH.LIMITE_HISTORICO_GRAFICO}`)
        ]);

        if (respAtual.status === 200) {
            const aplicativos = await respAtual.json();
            if (Array.isArray(aplicativos) && aplicativos.length > 0) {
                renderizarKpisETabela(aplicativos);
            }
        } else if (respAtual.status === 204) {
            renderizarEstadoVazio();
        }

        if (respCorrelacao.status === 200) {
            const historico = await respCorrelacao.json();
            if (Array.isArray(historico) && historico.length > 0) {
                renderizarGraficoCorrelacao([...historico].reverse());
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar dados da Dashboard de Processos:", erro);
    }
}

function aplicarEstiloCardRisco(cardRisco, elRiscoNivel, dataNivel) {
    if (!cardRisco) return;

    cardRisco.setAttribute("data-nivel", dataNivel);
    const rotulo = cardRisco.querySelector(".kpi-rotulo");

    if (dataNivel === "alto") {
        cardRisco.style.backgroundColor = "#b91c1c";
        cardRisco.style.borderColor = "#991b1b";
        if (elRiscoNivel) elRiscoNivel.style.color = "#ffffff";
        if (rotulo) rotulo.style.color = "#fee2e2";
    } else {
        cardRisco.style.backgroundColor = "";
        cardRisco.style.borderColor = "";
        if (elRiscoNivel) elRiscoNivel.style.color = "";
        if (rotulo) rotulo.style.color = "";
    }
}

function renderizarKpisETabela(aplicativos) {
    const listaOrdenada = [...aplicativos].sort(
        (a, b) => Number(b.memoriaMb) - Number(a.memoriaMb)
    );

    const totalProcessos = listaOrdenada.reduce(
        (acumulador, item) => acumulador + Number(item.qtdInstancias || 1),
        0
    );
    const maiorConsumidor = listaOrdenada[0];
    const usoRamTotalPct = Number(maiorConsumidor.usoRamPct || 0);

    const ramTotalProcessosMb = listaOrdenada.reduce(
        (acumulador, item) => acumulador + Number(item.memoriaMb || 0),
        0
    );
    const ramTop3Mb = listaOrdenada
        .slice(0, 3)
        .reduce((acumulador, item) => acumulador + Number(item.memoriaMb || 0), 0);

    const pctTop3SobreUso = ramTotalProcessosMb > 0
        ? (ramTop3Mb / ramTotalProcessosMb) * usoRamTotalPct
        : 0;

    definirTexto(CONFIG_DASH.IDS.kpiTotalProcessos, totalProcessos);
    definirTexto(CONFIG_DASH.IDS.kpiMaiorConsumo, maiorConsumidor.nome);

    const cardRisco = document.getElementById(CONFIG_DASH.IDS.cardRisco);
    const elRiscoNivel = document.getElementById(CONFIG_DASH.IDS.kpiRiscoNivel);

    let nivelRisco = "Baixo";
    let dataNivel = "baixo";

    if (usoRamTotalPct >= CONFIG_DASH.LIMIAR_RISCO_ALTO || pctTop3SobreUso >= CONFIG_DASH.LIMIAR_RISCO_ALTO) {
        nivelRisco = "Alto";
        dataNivel = "alto";
    } else if (usoRamTotalPct >= CONFIG_DASH.LIMIAR_RISCO_MODERADO) {
        nivelRisco = "Moderado";
        dataNivel = "moderado";
    }

    if (elRiscoNivel) elRiscoNivel.textContent = nivelRisco;
    aplicarEstiloCardRisco(cardRisco, elRiscoNivel, dataNivel);

    if (maiorConsumidor.dataHora) {
        definirTexto(
            CONFIG_DASH.IDS.avisoProcessos,
            `Última captura registrada em ${maiorConsumidor.dataHora} (Uso total de RAM: ${usoRamTotalPct.toFixed(1)}%).`
        );
    }

    const alertaAtivo = nivelRisco === "Alto";
    const tbody = document.getElementById(CONFIG_DASH.IDS.tbodyProcessos);
    const top10Aplicativos = listaOrdenada.slice(0, CONFIG_DASH.LIMITE_TABELA_APLICATIVOS);

    if (tbody) {
        tbody.innerHTML = top10Aplicativos
            .map((app, index) => {
                const destacarLinha = alertaAtivo && index < 3;
                const qtd = Number(app.qtdInstancias || 1);
                const nomeFormatado = qtd > 1
                    ? `${escaparHtml(app.nome)} (${qtd})`
                    : escaparHtml(app.nome);

                return `
                    <tr class="${destacarLinha ? "proc-destaque linha-alerta-top3" : ""}">
                        <td>${nomeFormatado}</td>
                        <td>${escaparHtml(app.status || "Ativo")}</td>
                        <td>${Number(app.usoCpu || 0).toFixed(1)}%</td>
                        <td>${Number(app.memoriaMb || 0).toFixed(1)} MB</td>
                        <td>${Number(app.redeMbps || 0).toFixed(2)} Mbps</td>
                        <td>${Number(app.discoMbS || 0).toFixed(2)} MB/s</td>
                    </tr>
                `;
            })
            .join("");
    }

    const faixaAlerta = document.getElementById(CONFIG_DASH.IDS.faixaAlerta);
    const textoAlerta = document.getElementById(CONFIG_DASH.IDS.textoAlerta);

    if (faixaAlerta) {
        faixaAlerta.hidden = !alertaAtivo;
    }
    if (textoAlerta && alertaAtivo) {
        const percentualExibido = Math.round(pctTop3SobreUso || usoRamTotalPct);
        textoAlerta.textContent =
            `ALERTA: Os top 3 processos em execução ocupam ${percentualExibido}% do uso total de Memória RAM. ` +
            `Elevado risco de queda ou lentidão do servidor.`;
    }
}

function renderizarEstadoVazio() {
    definirTexto(CONFIG_DASH.IDS.kpiTotalProcessos, "0");
    definirTexto(CONFIG_DASH.IDS.kpiMaiorConsumo, "—");
    definirTexto(CONFIG_DASH.IDS.kpiRiscoNivel, "Baixo");

    const cardRisco = document.getElementById(CONFIG_DASH.IDS.cardRisco);
    const elRiscoNivel = document.getElementById(CONFIG_DASH.IDS.kpiRiscoNivel);
    aplicarEstiloCardRisco(cardRisco, elRiscoNivel, "baixo");

    const tbody = document.getElementById(CONFIG_DASH.IDS.tbodyProcessos);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td class="proc-vazio" colspan="6">
                    Aguardando coleta de processos da instância...
                </td>
            </tr>
        `;
    }

    const faixaAlerta = document.getElementById(CONFIG_DASH.IDS.faixaAlerta);
    if (faixaAlerta) faixaAlerta.hidden = true;
}

function renderizarGraficoCorrelacao(historico) {
    const canvas = document.getElementById(CONFIG_DASH.IDS.canvasGrafico);
    if (!canvas) return;

    const labels = historico.map((item) => item.horario);
    const dadosProcessos = historico.map((item) => Number(item.totalProcessos || 0));
    const dadosRam = historico.map((item) => Number(item.usoRamPct || 0));

    if (graficoCorrelacao) {
        graficoCorrelacao.data.labels = labels;
        graficoCorrelacao.data.datasets[0].data = dadosProcessos;
        graficoCorrelacao.data.datasets[1].data = dadosRam;
        graficoCorrelacao.update("none");
        return;
    }

    const ctx = canvas.getContext("2d");
    graficoCorrelacao = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Quantidade de Apps / Processos",
                    data: dadosProcessos,
                    borderColor: "#2b5b84",
                    backgroundColor: "rgba(43, 91, 132, 0.12)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    pointRadius: 3,
                    yAxisID: "yProcessos"
                },
                {
                    label: "Uso de RAM (%)",
                    data: dadosRam,
                    borderColor: "#b91c1c",
                    backgroundColor: "rgba(185, 28, 28, 0.12)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    pointRadius: 3,
                    yAxisID: "yRam"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "top",
                    align: "start"
                }
            },
            scales: {
                yProcessos: {
                    type: "linear",
                    position: "left",
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Processos Ativos"
                    }
                },
                yRam: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: "Uso de RAM (%)"
                    }
                }
            }
        }
    });
}

function definirTexto(idElemento, valor) {
    const elemento = document.getElementById(idElemento);
    if (elemento) {
        elemento.textContent = valor;
    }
}

function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}