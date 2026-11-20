
document.addEventListener("DOMContentLoaded", function () {
    // Códigos dos componentes de rede no banco
    const REDE_RECEBIDA = 11;
    const REDE_ENVIADA = 12;

    // Identificação da empresa já utilizada pelo projeto
    const idEmpresa = window.ID_EMPRESA_ATUAL;

    let dadosRecebidos = [];
    let dadosEnviados = [];

    let graficoTransferencia = null;
    let graficoComparativo = null;
    let graficoHistorico = null;

    // Busca os dados de um componente na API
    async function buscarCapturas(codigoComponente) {
        try {
            const resposta = await fetch(
                `/medidas/componente/${codigoComponente}?idEmpresa=${idEmpresa}`
            );

            if (!resposta.ok) {
                throw new Error("Erro ao consultar as capturas.");
            }

            const dados = await resposta.json();

            return Array.isArray(dados) ? dados : [];
        } catch (erro) {
            console.error("Erro ao buscar dados de rede:", erro);
            return [];
        }
    }

    // Converte a data recebida da API
    function obterData(captura) {
        return new Date(captura.momento);
    }

    // Aplica o período selecionado
    function filtrarPorPeriodo(dados) {
        const periodo = document.getElementById("filtroPeriodo").value;

        if (periodo === "todos") {
            return dados;
        }

        const horas = Number(periodo);
        const limite = new Date();

        limite.setHours(limite.getHours() - horas);

        return dados.filter(function (captura) {
            return obterData(captura) >= limite;
        });
    }

    // Aplica o filtro de máquina
    function filtrarPorMaquina(dadosRecebidos, dadosEnviados) {
        const maquinaSelecionada =
            document.getElementById("filtroMaquina").value;

        if (maquinaSelecionada === "todas") {
            return {
                recebidos: dadosRecebidos,
                enviados: dadosEnviados
            };
        }

        return {
            recebidos: dadosRecebidos.filter(
                item => String(item.idMaquina) === maquinaSelecionada
            ),
            enviados: dadosEnviados.filter(
                item => String(item.idMaquina) === maquinaSelecionada
            )
        };
    }

    // Formata os valores apresentados nos indicadores
    function formatarVolume(valor) {
        if (!Number.isFinite(valor)) return "--";

        if (valor >= 1024 ** 3) {
            return (valor / 1024 ** 3).toFixed(2) + " GB";
        }

        if (valor >= 1024 ** 2) {
            return (valor / 1024 ** 2).toFixed(2) + " MB";
        }

        return (valor / 1024).toFixed(2) + " KB";
    }

    function formatarVelocidade(valor) {
        if (!Number.isFinite(valor)) return "-- Mbps";
        return valor.toFixed(1) + " Mbps";
    }

    // Atualiza os indicadores da tela
    function atualizarIndicadores(recebidos, enviados) {
        const totalRecebido = calcularTotal(recebidos);
        const totalEnviado = calcularTotal(enviados);

        document.getElementById("totalRecebido").textContent =
            formatarVolume(totalRecebido);

        document.getElementById("totalEnviado").textContent =
            formatarVolume(totalEnviado);

        document.getElementById("mediaDownload").textContent =
            formatarVelocidade(calcularMedia(recebidos));

        document.getElementById("mediaUpload").textContent =
            formatarVelocidade(calcularMedia(enviados));
    }

    // Calcula o total dos valores recebidos
    function calcularTotal(dados) {
        if (dados.length === 0) return 0;

        return dados.reduce(function (total, item) {
            return total + Number(item.valor || 0);
        }, 0);
    }

    // Calcula a média dos valores
    function calcularMedia(dados) {
        if (dados.length === 0) return 0;

        const total = dados.reduce(function (soma, item) {
            return soma + Number(item.valor || 0);
        }, 0);

        return total / dados.length;
    }

    // Cria ou atualiza o gráfico de transferência
    function atualizarGraficoTransferencia(recebidos, enviados) {
        const contexto = document
            .getElementById("graficoTransferencia")
            .getContext("2d");

        const dados = organizarPorHorario(recebidos, enviados);

        if (graficoTransferencia) {
            graficoTransferencia.destroy();
        }

        graficoTransferencia = new Chart(contexto, {
            type: "line",
            data: {
                labels: dados.labels,
                datasets: [
                    {
                        label: "Download (Recebimento)",
                        data: dados.recebidos,
                        borderColor: "#3995ff",
                        backgroundColor: "rgba(57,149,255,0.12)",
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: "Upload (Envio)",
                        data: dados.enviados,
                        borderColor: "#a34cff",
                        backgroundColor: "rgba(163,76,255,0.12)",
                        fill: true,
                        tension: 0.35
                    }
                ]
            },
            options: opcoesGrafico("Mbps")
        });
    }

    // Organiza as capturas pelo horário
    function organizarPorHorario(recebidos, enviados) {
        const horarios = [
            ...new Set(
                recebidos.concat(enviados).map(item =>
                    obterData(item).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                )
            )
        ].sort();

        return {
            labels: horarios,
            recebidos: horarios.map(horario => {
                const item = recebidos.find(c =>
                    obterData(c).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    }) === horario
                );

                return item ? Number(item.valor) : 0;
            }),
            enviados: horarios.map(horario => {
                const item = enviados.find(c =>
                    obterData(c).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    }) === horario
                );

                return item ? Number(item.valor) : 0;
            })
        };
    }

    // Gráfico de rosca: recebido x enviado
    function atualizarGraficoComparativo(recebidos, enviados) {
        const contexto = document
            .getElementById("graficoComparativo")
            .getContext("2d");

        if (graficoComparativo) {
            graficoComparativo.destroy();
        }

        const totalRecebido = calcularTotal(recebidos);
        const totalEnviado = calcularTotal(enviados);

        const total = totalRecebido + totalEnviado;

        const porcentagem = total > 0
            ? Math.round((totalRecebido / total) * 100)
            : 0;

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

        const centro = document.getElementById("graficoComparativo");

        centro.setAttribute("aria-label",
            porcentagem + "% do tráfego foi recebido."
        );
    }

    // Histórico diário de recebimento e envio
    function atualizarGraficoHistorico(recebidos, enviados) {
        const contexto = document
            .getElementById("graficoHistorico")
            .getContext("2d");

        const historico = organizarPorDia(recebidos, enviados);

        if (graficoHistorico) {
            graficoHistorico.destroy();
        }

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
            options: opcoesGrafico("Volume")
        });
    }

    function organizarPorDia(recebidos, enviados) {
        const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

        const labels = dias.slice(1).concat(dias[0]);

        function somarDia(dados, dia) {
            return dados
                .filter(item => obterData(item).getDay() === dia)
                .reduce((total, item) => total + Number(item.valor || 0), 0);
        }

        return {
            labels,
            recebidos: [1, 2, 3, 4, 5, 6, 0].map(dia =>
                somarDia(recebidos, dia)
            ),
            enviados: [1, 2, 3, 4, 5, 6, 0].map(dia =>
                somarDia(enviados, dia)
            )
        };
    }

    // Configurações visuais comuns dos gráficos
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

    // Atualiza os picos e o comportamento da rede
    function atualizarPicos(recebidos, enviados) {
        const picoDownload = Math.max(
            0,
            ...recebidos.map(item => Number(item.valor || 0))
        );

        const picoUpload = Math.max(
            0,
            ...enviados.map(item => Number(item.valor || 0))
        );

        document.getElementById("picoDownload").textContent =
            formatarVelocidade(picoDownload);

        document.getElementById("picoUpload").textContent =
            formatarVelocidade(picoUpload);

        const media = calcularMedia(recebidos);

        const variacao = media > 0
            ? ((picoDownload - media) / media) * 100
            : 0;

        document.getElementById("variacaoRede").textContent =
            "+" + variacao.toFixed(0) + "%";

        atualizarStatus(picoDownload, media);
    }

    // Atualiza a mensagem de situação da rede
    function atualizarStatus(pico, media) {
        const status = document.getElementById("statusRede");
        const alerta = document.getElementById("alerta");

        if (media === 0) {
            status.textContent = "Sem dados suficientes";
            alerta.textContent =
                "Não existem capturas de rede para o período selecionado.";
            return;
        }

        const variacao = ((pico - media) / media) * 100;

        if (variacao > 100) {
            status.textContent = "Atenção";
            alerta.textContent =
                "Foram identificados picos elevados de tráfego no período.";
        } else {
            status.textContent = "Dentro do esperado";
            alerta.textContent =
                "Não foram identificados picos anormais no período.";
        }
    }

    // Preenche o filtro com as máquinas encontradas
    function preencherFiltroMaquinas(dados) {
        const filtro = document.getElementById("filtroMaquina");

        const maquinaAtual = filtro.value;

        const maquinas = {};

        dados.forEach(function (item) {
            maquinas[item.idMaquina] = item.nomeMaquina;
        });

        filtro.innerHTML = '<option value="todas">Todas as máquinas</option>';

        Object.entries(maquinas).forEach(function ([id, nome]) {
            const opcao = document.createElement("option");

            opcao.value = id;
            opcao.textContent = nome;

            filtro.appendChild(opcao);
        });

        filtro.value = maquinas[maquinaAtual] ? maquinaAtual : "todas";
    }

    // Atualiza toda a dashboard
    function atualizarDashboard() {
        const filtrados = filtrarPorMaquina(
            filtrarPorPeriodo(dadosRecebidos),
            filtrarPorPeriodo(dadosEnviados)
        );

        atualizarIndicadores(filtrados.recebidos, filtrados.enviados);

        atualizarGraficoTransferencia(
            filtrados.recebidos,
            filtrados.enviados
        );

        atualizarGraficoComparativo(
            filtrados.recebidos,
            filtrados.enviados
        );

        atualizarGraficoHistorico(
            filtrados.recebidos,
            filtrados.enviados
        );

        atualizarPicos(filtrados.recebidos, filtrados.enviados);
    }

    // Carrega os dados da API
    async function carregarDashboard() {
        if (!idEmpresa) {
            console.error("ID da empresa não encontrado.");
            return;
        }

        dadosRecebidos = await buscarCapturas(REDE_RECEBIDA);
        dadosEnviados = await buscarCapturas(REDE_ENVIADA);

        preencherFiltroMaquinas(
            dadosRecebidos.concat(dadosEnviados)
        );

        atualizarDashboard();
    }

    // Atualiza quando os filtros forem alterados
    document.getElementById("filtroMaquina")
        .addEventListener("change", atualizarDashboard);

    document.getElementById("filtroPeriodo")
        .addEventListener("change", atualizarDashboard);

    carregarDashboard();
});
