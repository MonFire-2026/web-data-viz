
document.addEventListener("DOMContentLoaded", function () {

    // Identificação da máquina e da empresa
    const idMaquina = 1;
    const idEmpresa = window.ID_EMPRESA_ATUAL || 2;

    let dadosRede = null;

    let graficoTransferencia = null;
    let graficoComparativo = null;
    let graficoHistorico = null;

    // Consulta a nova API de rede
    async function buscarCapturas() {
        try {
            const resposta = await fetch(
                `/rede/capturas/${idMaquina}/${idEmpresa}`
            );

            if (!resposta.ok) {
                throw new Error("Erro ao consultar a API de rede.");
            }

            return await resposta.json();

        } catch (erro) {
            console.error("Erro ao buscar dados de rede:", erro);

            document.getElementById("alerta").textContent =
                "Não foi possível carregar os dados da rede.";

            return null;
        }
    }

    // Converte o horário da captura
    function obterData(item) {
        return new Date(item.momento);
    }

    // Converte MB/s para Mbps
    function converterParaMbps(valor) {
        return valor * 8;
    }

    // Formata os volumes em MB e GB
    function formatarVolume(valor) {
        if (!Number.isFinite(valor)) return "--";

        if (valor >= 1024) {
            return (valor / 1024).toFixed(2) + " GB";
        }

        return valor.toFixed(2) + " MB";
    }

    // Formata velocidades em Mbps
    function formatarVelocidade(valor) {
        if (!Number.isFinite(valor)) return "--";

        return valor.toFixed(2) + " Mbps";
    }

    // Aplica o filtro de período
    function filtrarPorPeriodo(dados) {
        const periodo = document.getElementById("filtroPeriodo").value;

        let horas;

        if (periodo === "7") {
            horas = 7 * 24;
        } else if (periodo === "30") {
            horas = 30 * 24;
        } else {
            horas = Number(periodo);
        }

        const limite = new Date();

        limite.setHours(limite.getHours() - horas);

        return dados.filter(function (item) {
            return obterData(item) >= limite;
        });
    }

    // Soma as variações válidas do período
    function calcularTotal(dados) {
        return dados.reduce(function (total, item) {
            return total + Number(item.variacao || 0);
        }, 0);
    }

    // Calcula a velocidade média
    function calcularMedia(dados) {
        if (dados.length === 0) return 0;

        const total = dados.reduce(function (soma, item) {
            return soma + Number(item.porSegundo || 0);
        }, 0);

        return total / dados.length;
    }

    // Encontra a maior velocidade registrada
    function calcularPico(dados) {
        if (dados.length === 0) return 0;

        return Math.max(
            ...dados.map(item => Number(item.porSegundo || 0))
        );
    }

    // Atualiza os cards principais
    function atualizarIndicadores(recebidos, enviados) {

        document.getElementById("totalRecebido").textContent =
            formatarVolume(calcularTotal(recebidos));

        document.getElementById("totalEnviado").textContent =
            formatarVolume(calcularTotal(enviados));

        document.getElementById("mediaDownload").textContent =
            formatarVelocidade(
                converterParaMbps(calcularMedia(recebidos))
            );

        document.getElementById("mediaUpload").textContent =
            formatarVelocidade(
                converterParaMbps(calcularMedia(enviados))
            );
    }

    // Configurações comuns dos gráficos
    function opcoesGrafico(tituloEixo) {
        return {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    labels: {
                        color: "#d5d7e0"
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        color: "#b9bdca"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    }
                },

                y: {
                    title: {
                        display: true,
                        text: tituloEixo,
                        color: "#b9bdca"
                    },

                    ticks: {
                        color: "#b9bdca"
                    },

                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    }
                }
            }
        };
    }

    // Gráfico de velocidade de transferência
    function atualizarGraficoTransferencia(recebidos, enviados) {

        const contexto = document
            .getElementById("graficoTransferencia")
            .getContext("2d");

        if (graficoTransferencia) {
            graficoTransferencia.destroy();
        }

        graficoTransferencia = new Chart(contexto, {
            type: "line",

            data: {
                labels: recebidos.map(item =>
                    obterData(item).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    })
                ),

                datasets: [
                    {
                        label: "Download",
                        data: recebidos.map(item =>
                            converterParaMbps(Number(item.porSegundo))
                        ),
                        borderColor: "#3995ff",
                        backgroundColor: "rgba(57,149,255,0.12)",
                        fill: true,
                        tension: 0.35
                    },

                    {
                        label: "Upload",
                        data: enviados.map(item =>
                            converterParaMbps(Number(item.porSegundo))
                        ),
                        borderColor: "#a34cff",
                        backgroundColor: "rgba(163,76,255,0.12)",
                        fill: true,
                        tension: 0.35
                    }
                ]
            },

            options: opcoesGrafico("Velocidade (Mbps)")
        });
    }

    // Gráfico comparativo de volume recebido e enviado
    function atualizarGraficoComparativo(recebidos, enviados) {

        const contexto = document
            .getElementById("graficoComparativo")
            .getContext("2d");

        if (graficoComparativo) {
            graficoComparativo.destroy();
        }

        const totalRecebido = calcularTotal(recebidos);
        const totalEnviado = calcularTotal(enviados);

        graficoComparativo = new Chart(contexto, {
            type: "doughnut",

            data: {
                labels: ["Recebido", "Enviado"],

                datasets: [{
                    data: [totalRecebido, totalEnviado],
                    backgroundColor: ["#3995ff", "#a34cff"],
                    borderWidth: 0
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",

                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#d5d7e0"
                        }
                    }
                }
            }
        });
    }

    // Agrupa o volume por dia
    function organizarPorDia(recebidos, enviados) {

        const dias = {};

        function adicionarDados(dados, tipo) {
            dados.forEach(function (item) {

                const data = obterData(item);

                const dia = data.toLocaleDateString("pt-BR");

                if (!dias[dia]) {
                    dias[dia] = {
                        recebidos: 0,
                        enviados: 0
                    };
                }

                dias[dia][tipo] += Number(item.variacao || 0);
            });
        }

        adicionarDados(recebidos, "recebidos");
        adicionarDados(enviados, "enviados");

        const labels = Object.keys(dias);

        return {
            labels: labels,

            recebidos: labels.map(dia => dias[dia].recebidos),

            enviados: labels.map(dia => dias[dia].enviados)
        };
    }

    // Gráfico de histórico diário
    function atualizarGraficoHistorico(recebidos, enviados) {

        const contexto = document
            .getElementById("graficoHistorico")
            .getContext("2d");

        if (graficoHistorico) {
            graficoHistorico.destroy();
        }

        const historico = organizarPorDia(recebidos, enviados);

        graficoHistorico = new Chart(contexto, {
            type: "bar",

            data: {
                labels: historico.labels,

                datasets: [
                    {
                        label: "Recebido",
                        data: historico.recebidos,
                        backgroundColor: "#3995ff",
                        borderRadius: 4
                    },

                    {
                        label: "Enviado",
                        data: historico.enviados,
                        backgroundColor: "#a34cff",
                        borderRadius: 4
                    }
                ]
            },

            options: opcoesGrafico("Volume (MB)")
        });
    }

    // Atualiza os picos e a variação
    function atualizarPicos(recebidos, enviados) {

        const mediaDownload = calcularMedia(recebidos);
        const mediaUpload = calcularMedia(enviados);

        const picoDownload = calcularPico(recebidos);
        const picoUpload = calcularPico(enviados);

        document.getElementById("picoDownload").textContent =
            formatarVelocidade(converterParaMbps(picoDownload));

        document.getElementById("picoUpload").textContent =
            formatarVelocidade(converterParaMbps(picoUpload));

        const variacao = mediaDownload > 0
            ? ((picoDownload - mediaDownload) / mediaDownload) * 100
            : 0;

        document.getElementById("variacaoRede").textContent =
            variacao.toFixed(1) + "%";

        atualizarStatus(recebidos, enviados);
    }

    // Atualiza o status da rede
    function atualizarStatus(recebidos, enviados) {

        const status = document.getElementById("statusRede");
        const alerta = document.getElementById("alerta");

        const errosRecebidos = calcularTotal(
            dadosRede.historico.errosRecebidos
        );

        const errosEnviados = calcularTotal(
            dadosRede.historico.errosEnviados
        );

        const descartes = calcularTotal(
            dadosRede.historico.descartesRecebidos
        );

        const colisoes = calcularTotal(
            dadosRede.historico.colisoes
        );

        const totalProblemas =
            errosRecebidos + errosEnviados + descartes + colisoes;

        if (recebidos.length === 0 && enviados.length === 0) {

            status.querySelector("strong").textContent =
                "Sem dados suficientes";

            status.querySelector("p").textContent =
                "Não existem capturas para o período selecionado.";

            alerta.textContent = "";

        } else if (totalProblemas > 0) {

            status.querySelector("strong").textContent =
                "Atenção";

            status.querySelector("p").textContent =
                "Foram registrados erros, descartes ou colisões.";

            alerta.textContent =
                "Verifique os indicadores de integridade da rede.";

        } else {

            status.querySelector("strong").textContent =
                "Sem erros registrados";

            status.querySelector("p").textContent =
                "Não foram registrados erros, descartes ou colisões.";

            alerta.textContent = "";
        }
    }

    // Atualiza todos os elementos da dashboard
    function atualizarDashboard() {

        if (!dadosRede || !dadosRede.historico) {
            return;
        }

        const recebidos = filtrarPorPeriodo(
            dadosRede.historico.recebimento || []
        );

        const enviados = filtrarPorPeriodo(
            dadosRede.historico.envio || []
        );

        const errosRecebidos = filtrarPorPeriodo(
            dadosRede.historico.errosRecebidos || []
        );

        const errosEnviados = filtrarPorPeriodo(
            dadosRede.historico.errosEnviados || []
        );

        const descartes = filtrarPorPeriodo(
            dadosRede.historico.descartesRecebidos || []
        );

        const colisoes = filtrarPorPeriodo(
            dadosRede.historico.colisoes || []
        );

        // Atualiza os dados filtrados para o status
        dadosRede.historico.errosRecebidos = errosRecebidos;
        dadosRede.historico.errosEnviados = errosEnviados;
        dadosRede.historico.descartesRecebidos = descartes;
        dadosRede.historico.colisoes = colisoes;

        atualizarIndicadores(recebidos, enviados);

        atualizarGraficoTransferencia(recebidos, enviados);

        atualizarGraficoComparativo(recebidos, enviados);

        atualizarGraficoHistorico(recebidos, enviados);

        atualizarPicos(recebidos, enviados);
    }

    // Carrega os dados da API
    async function carregarDashboard() {

        if (!idEmpresa) {
            console.error("ID da empresa não encontrado.");
            return;
        }

        dadosRede = await buscarCapturas();

        if (!dadosRede || !dadosRede.historico) {
            return;
        }

        const filtroMaquina = document.getElementById("filtroMaquina");

        filtroMaquina.innerHTML =
            '<option value="1">Máquina 1</option>';

        atualizarDashboard();
    }

    // Eventos dos filtros
    document.getElementById("filtroPeriodo")
        .addEventListener("change", atualizarDashboard);

    carregarDashboard();
});
