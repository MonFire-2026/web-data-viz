/*
 * Dashboard de disco do MonFire (dashboardFelipe.html).
 *
 * Dados vêm de GET /dashboardFelipe/disco/:idMaquina?idEmpresa=&periodo=24h|7d|30d
 * Servidores ativos vêm de GET /dashboardFelipe/maquinas/:idEmpresa
 * Códigos de métrica esperados (tipo_componente.codigo):
 *   DISCO_USO (%), DISCO_TOTAL / DISCO_DISPONIVEL / DISCO_EM_USO (GB)  -> já coletados hoje
 *   DISCO_LEITURA / DISCO_ESCRITA (MB/s), DISCO_LATENCIA (ms),
 *   DISCO_TEMPERATURA (°C), DISCO_SMART (1 = saudável, 0 = falha)      -> ainda a coletar
 * Quando uma métrica não existe, o card/gráfico correspondente mostra "sem coleta".
 *
 * Parâmetros de URL: ?maquina=ID&periodo=7d  (links do Slack abrem já filtrados)
 */
(function () {
    'use strict';

    var COR = { azul: '#1a2438', vermelho: '#d62222', ambar: '#e0a100', verde: '#1b7a43' };
    var HORA = 3600 * 1000;
    var DIA = 24 * HORA;
    var INTERVALO_ATUALIZACAO_MS = 30000;

    // Regras de status (ajuste aqui se a equipe definir outros limites)
    var LIMITES = {
        usoAtencao: 75, usoCritico: 90,          // sobrescritos pelos limites da máquina no banco
        diasAtencao: 30, diasCritico: 7,
        latenciaAtencao: 20, latenciaCritico: 50, // ms
        temperaturaAtencao: 50, temperaturaCritico: 60 // °C
    };
    var PERIODOS = {
        '24h': 'Últimas 24 horas',
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias'
    };

    var params = new URLSearchParams(window.location.search);
    var ID_EMPRESA = Number(sessionStorage.ID_EMPRESA);

    var estado = {
        maquina: null,
        periodo: PERIODOS[params.get('periodo')] ? params.get('periodo') : '7d',
        versao: 0,
        timer: null,
        chaveGrafico: '',
        graficoUso: null,
        graficoRW: null
    };

    var $ = function (id) { return document.getElementById(id); };

    // ---------- formatação ----------
    function numero(valor, casas) {
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(valor);
    }

    function armazenamento(gb) {
        if (!Number.isFinite(gb)) return '—';
        return gb >= 1024 ? numero(gb / 1024, 2) + ' TB' : numero(gb, 1) + ' GB';
    }

    function doisDigitos(n) { return String(n).padStart(2, '0'); }

    function dataHora(ms) {
        var d = new Date(ms);
        return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + ' '
            + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
    }

    function tempoRelativo(ms) {
        var diferenca = Math.max(0, Date.now() - ms);
        var minutos = Math.floor(diferenca / 60000);
        if (minutos < 1) return 'agora há pouco';
        if (minutos < 60) return 'há ' + minutos + ' min';
        var horas = Math.floor(minutos / 60);
        if (horas < 24) return 'há ' + horas + ' h';
        var dias = Math.floor(horas / 24);
        return 'há ' + dias + (dias == 1 ? ' dia' : ' dias');
    }

    // ---------- dados ----------
    function pontos(lista) {
        return (lista || []).map(function (p) {
            return { x: new Date(p.momento).getTime(), y: Number(p.valor) };
        }).filter(function (p) {
            return Number.isFinite(p.x) && Number.isFinite(p.y);
        });
    }

    function ultimo(dados, codigo) {
        var item = dados.ultimas && dados.ultimas[codigo];
        if (!item) return null;
        var valor = Number(item.valor);
        return Number.isFinite(valor) ? valor : null;
    }

    function media(lista) {
        if (lista.length == 0) return null;
        return lista.reduce(function (soma, p) { return soma + p.y; }, 0) / lista.length;
    }

    function statusPorLimites(valor, atencao, critico) {
        if (valor >= critico) return 'critico';
        if (valor >= atencao) return 'atencao';
        return 'ok';
    }

    // Regressão linear (mínimos quadrados) do uso (%) ao longo do tempo
    function calcularPrevisao(serieUso, usoAtual, totalGb) {
        var n = serieUso.length;
        if (n < 3 || serieUso[n - 1].x - serieUso[0].x < 6 * HORA || usoAtual == null) {
            return { tipo: 'coletando' };
        }

        var t0 = serieUso[0].x;
        var somaX = 0, somaY = 0, somaXY = 0, somaXX = 0;
        serieUso.forEach(function (p) {
            var x = (p.x - t0) / DIA;
            somaX += x; somaY += p.y; somaXY += x * p.y; somaXX += x * x;
        });
        var divisor = n * somaXX - somaX * somaX;
        if (divisor == 0) return { tipo: 'coletando' };

        var pctPorDia = (n * somaXY - somaX * somaY) / divisor;
        if (!Number.isFinite(pctPorDia)) return { tipo: 'coletando' };
        if (pctPorDia < 0.01) return { tipo: 'estavel' };

        return {
            tipo: 'crescendo',
            pctPorDia: pctPorDia,
            gbPorDia: totalGb ? pctPorDia / 100 * totalGb : null,
            dias: Math.max(0, (100 - usoAtual) / pctPorDia)
        };
    }

    // Eventos de mudança de nível (com histerese para não "piscar" perto do limite)
    function eventosDaSerie(serie, atencao, critico, histerese, textos) {
        var eventos = [];
        if (serie.length < 2) return eventos;

        function nivelDe(v) { return v >= critico ? 2 : (v >= atencao ? 1 : 0); }
        var nivel = nivelDe(serie[0].y);

        for (var i = 1; i < serie.length; i++) {
            var v = serie[i].y;
            var candidato = nivelDe(v);
            var novo = nivel;

            if (candidato > nivel) {
                novo = candidato;
            } else if (candidato < nivel) {
                var limiteAtual = nivel == 2 ? critico : atencao;
                if (v < limiteAtual - histerese) novo = candidato;
            }

            if (novo != nivel) {
                if (novo == 2) eventos.push({ x: serie[i].x, nivel: 'critico', texto: textos.critico });
                else if (novo == 1 && nivel == 0) eventos.push({ x: serie[i].x, nivel: 'atencao', texto: textos.atencao });
                else if (novo == 0) eventos.push({ x: serie[i].x, nivel: 'ok', texto: textos.normal });
                nivel = novo;
            }
        }
        return eventos;
    }

    // ---------- cards ----------
    function definirStatus(idCard, status) {
        var card = $(idCard);
        card.classList.remove('status-ok', 'status-atencao', 'status-critico', 'status-neutro');
        card.classList.add('status-' + status);
    }

    function atualizarCards(dados, ctx) {
        // Uso
        if (ctx.uso != null) {
            $('kpiUso').textContent = numero(ctx.uso, 1) + '%';
            $('kpiUsoDetalhe').textContent = 'Atenção a partir de ' + numero(ctx.limAtencao, 0) + '%';
            definirStatus('cardUso', ctx.statusUso);
        } else {
            $('kpiUso').textContent = '—';
            $('kpiUsoDetalhe').textContent = 'Sem capturas';
            definirStatus('cardUso', 'neutro');
        }

        // Dias até encher
        var p = ctx.previsao;
        if (p.tipo == 'crescendo') {
            var dias = p.dias;
            var textoDias = dias < 1 ? 'Menos de 1 dia'
                : dias > 365 ? 'Mais de 1 ano'
                : Math.round(dias) + (Math.round(dias) == 1 ? ' dia' : ' dias');
            $('kpiDias').textContent = textoDias;
            $('kpiDiasDetalhe').textContent = p.gbPorDia != null
                ? '+' + numero(p.gbPorDia, 1) + ' GB/dia'
                : '+' + numero(p.pctPorDia, 2) + '% ao dia';
            definirStatus('cardDias', statusPorLimites(-dias, -LIMITES.diasAtencao, -LIMITES.diasCritico));
        } else if (p.tipo == 'estavel') {
            $('kpiDias').textContent = 'Estável';
            $('kpiDiasDetalhe').textContent = 'Sem crescimento no período';
            definirStatus('cardDias', 'ok');
        } else {
            $('kpiDias').textContent = '—';
            $('kpiDiasDetalhe').textContent = 'Coletando dados';
            definirStatus('cardDias', 'neutro');
        }

        // Latência
        if (ctx.latencia != null) {
            $('kpiLatencia').textContent = numero(ctx.latencia, 1) + ' ms';
            $('kpiLatenciaDetalhe').textContent = 'Média no período';
            definirStatus('cardLatencia', statusPorLimites(ctx.latencia, LIMITES.latenciaAtencao, LIMITES.latenciaCritico));
        } else {
            $('kpiLatencia').textContent = '—';
            $('kpiLatenciaDetalhe').textContent = 'Sem coleta neste servidor';
            definirStatus('cardLatencia', 'neutro');
        }

        // Saúde (S.M.A.R.T. + temperatura)
        var smart = ultimo(dados, 'DISCO_SMART');
        var temperatura = ultimo(dados, 'DISCO_TEMPERATURA');
        var selo = $('seloSaude');
        var status = 'neutro';
        var rotulo = 'Sem coleta';
        var detalhe = 'S.M.A.R.T. ainda não coletado';

        if (smart != null || temperatura != null) {
            status = 'ok';
            rotulo = 'Saudável';
            detalhe = temperatura != null ? numero(temperatura, 0) + ' °C' : '';

            if (temperatura != null && temperatura >= LIMITES.temperaturaAtencao) {
                status = temperatura >= LIMITES.temperaturaCritico ? 'critico' : 'atencao';
                detalhe = 'Temperatura alta: ' + numero(temperatura, 0) + ' °C';
            }
            if (smart != null && smart < 1) {
                status = 'critico';
                detalhe = 'Falha reportada pelo S.M.A.R.T.';
            }
            if (status == 'atencao') rotulo = 'Atenção';
            if (status == 'critico') rotulo = 'Em risco';
        }

        selo.textContent = rotulo;
        selo.className = 'selo ' + (status == 'neutro' ? 'inativo' : status == 'ok' ? 'ok' : status);
        $('kpiSaudeDetalhe').textContent = detalhe;
        definirStatus('cardSaude', status);
    }

    function atualizarResumo(dados, ctx) {
        var total = ultimo(dados, 'DISCO_TOTAL');
        var usado = ultimo(dados, 'DISCO_EM_USO');
        var livre = ultimo(dados, 'DISCO_DISPONIVEL');

        if (total != null && ctx.uso != null) {
            if (usado == null) usado = total * ctx.uso / 100;
            if (livre == null) livre = total - usado;
        }

        $('valUtilizado').textContent = armazenamento(usado);
        $('valLivre').textContent = armazenamento(livre);
        $('valTotal').textContent = armazenamento(total);

        var barra = $('barraArmazenamento');
        if (ctx.uso != null) {
            var pct = Math.min(100, Math.max(0, ctx.uso));
            $('barraPreenchimento').style.width = pct + '%';
            $('armazenamentoPercentual').textContent = numero(ctx.uso, 0) + '%';
            barra.dataset.status = ctx.statusUso;
            barra.setAttribute('aria-valuenow', String(Math.round(pct)));
        } else {
            $('barraPreenchimento').style.width = '0';
            $('armazenamentoPercentual').textContent = '—';
            barra.dataset.status = 'neutro';
            barra.removeAttribute('aria-valuenow');
        }
    }

    var ICONES = {
        atencao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
        critico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5h.01"/></svg>',
        ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16 9.5"/></svg>'
    };

    function atualizarAlertas(eventos) {
        var lista = $('listaAlertas');
        lista.innerHTML = '';

        if (eventos.length == 0) {
            var vazio = document.createElement('li');
            vazio.className = 'alerta-vazio';
            vazio.textContent = 'Nenhum alerta no período selecionado.';
            lista.appendChild(vazio);
            return;
        }

        eventos.sort(function (a, b) { return b.x - a.x; }).slice(0, 4).forEach(function (evento) {
            var item = document.createElement('li');
            item.className = 'alerta-item alerta-' + evento.nivel;
            item.innerHTML = ICONES[evento.nivel];

            var texto = document.createElement('span');
            texto.textContent = evento.texto;
            var tempo = document.createElement('time');
            tempo.className = 'alerta-tempo';
            tempo.dateTime = new Date(evento.x).toISOString();
            tempo.title = dataHora(evento.x);
            tempo.textContent = tempoRelativo(evento.x);

            item.appendChild(texto);
            item.appendChild(tempo);
            lista.appendChild(item);
        });
    }

    // ---------- gráficos ----------
    function gerarTicks(min, max) {
        var passosHoras = [1, 2, 3, 6, 12, 24, 48, 120, 168, 336];
        var span = max - min;
        var passo = passosHoras[passosHoras.length - 1];
        for (var i = 0; i < passosHoras.length; i++) {
            if (span / (passosHoras[i] * HORA) <= 8) { passo = passosHoras[i]; break; }
        }

        var ticks = [];
        var d = new Date(min);
        if (passo >= 24) {
            d.setHours(0, 0, 0, 0);
            while (d.getTime() < min) d.setDate(d.getDate() + 1);
            while (d.getTime() <= max) {
                ticks.push(d.getTime());
                d.setDate(d.getDate() + passo / 24);
            }
        } else {
            d.setMinutes(0, 0, 0);
            while (d.getTime() < min || d.getHours() % passo !== 0) d = new Date(d.getTime() + HORA);
            for (var t = d.getTime(); t <= max; t += passo * HORA) ticks.push(t);
        }
        return ticks;
    }

    function eixoX(min, max) {
        var curto = (max - min) <= 36 * HORA;
        return {
            type: 'linear',
            min: min,
            max: max,
            grid: { display: false },
            afterBuildTicks: function (escala) {
                escala.ticks = gerarTicks(escala.min, escala.max).map(function (v) { return { value: v }; });
            },
            ticks: {
                maxRotation: 0,
                callback: function (valor) {
                    var d = new Date(valor);
                    return curto
                        ? doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes())
                        : doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1);
                }
            }
        };
    }

    // Escreve "Atenção 75%" / "Crítico 90%" sobre as linhas de limite
    var pluginRotulosLimite = {
        id: 'rotulosLimite',
        afterDatasetsDraw: function (grafico) {
            var ctx = grafico.ctx;
            var area = grafico.chartArea;
            ctx.save();
            ctx.font = '700 11px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            grafico.data.datasets.forEach(function (ds) {
                if (!ds.rotulo) return;
                ctx.fillStyle = ds.borderColor;
                ctx.fillText(ds.rotulo, area.right - 4, grafico.scales.y.getPixelForValue(ds.data[0].y) - 4);
            });
            ctx.restore();
        }
    };

    function configuracaoBase(animar) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            animation: animar ? { duration: 500 } : false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        };
    }

    function plotarUso(serie, ctx, animar) {
        var vazio = $('vazioUso');
        vazio.hidden = serie.length > 0;
        if (estado.graficoUso) { estado.graficoUso.destroy(); estado.graficoUso = null; }
        if (serie.length == 0) return;

        var ultimoX = serie[serie.length - 1].x;
        var primeiroX = serie[0].x;
        var projecao = [];
        var xMax = ultimoX + Math.max((ultimoX - primeiroX) * 0.04, HORA);

        if (ctx.previsao.tipo == 'crescendo') {
            // mostra a projeção até cruzar o limite crítico (ou 100%, se já passou dele), com folga
            var alvo = ctx.uso < ctx.limCritico ? ctx.limCritico : 100;
            var diasAteAlvo = Math.max(0, (alvo - ctx.uso) / ctx.previsao.pctPorDia);
            var horizonte = Math.min(Math.max(diasAteAlvo * 1.25, 3), 60);
            var fim = Math.min(ctx.previsao.dias, horizonte);
            projecao = [
                { x: ultimoX, y: serie[serie.length - 1].y },
                { x: ultimoX + fim * DIA, y: Math.min(100, ctx.uso + ctx.previsao.pctPorDia * fim) }
            ];
            xMax = ultimoX + Math.max(horizonte, 0.1) * DIA;
        }

        function linhaLimite(valor, cor, rotulo) {
            return {
                label: rotulo, rotulo: rotulo, data: [{ x: primeiroX, y: valor }, { x: xMax, y: valor }],
                borderColor: cor, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, fill: false
            };
        }

        estado.graficoUso = new Chart($('graficoUso'), {
            type: 'line',
            plugins: [pluginRotulosLimite],
            data: {
                datasets: [
                    {
                        label: 'Uso atual', data: serie, borderColor: COR.vermelho,
                        backgroundColor: 'rgba(214, 34, 34, 0.12)', fill: 'origin',
                        borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointStyle: 'line'
                    },
                    {
                        label: 'Projeção', data: projecao, borderColor: COR.vermelho,
                        borderDash: [3, 5], borderWidth: 2, pointRadius: 0, pointStyle: 'line', fill: false
                    },
                    linhaLimite(ctx.limAtencao, COR.ambar, 'Atenção ' + numero(ctx.limAtencao, 0) + '%'),
                    linhaLimite(ctx.limCritico, COR.vermelho, 'Crítico ' + numero(ctx.limCritico, 0) + '%')
                ]
            },
            options: Object.assign(configuracaoBase(animar), {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true, padding: 20,
                            filter: function (item, dados) { return !dados.datasets[item.datasetIndex].rotulo; }
                        }
                    },
                    tooltip: {
                        filter: function (item) { return !item.dataset.rotulo; },
                        callbacks: {
                            title: function (itens) { return itens.length ? dataHora(itens[0].parsed.x) : ''; },
                            label: function (item) { return item.dataset.label + ': ' + numero(item.parsed.y, 1) + '%'; }
                        }
                    }
                },
                scales: {
                    x: eixoX(primeiroX, xMax),
                    y: {
                        min: 0, max: 100,
                        grid: { color: '#e2e5ea' },
                        ticks: { callback: function (v) { return v + '%'; } }
                    }
                }
            })
        });
    }

    function plotarLeituraEscrita(leitura, escrita, animar) {
        var temDados = leitura.length > 0 || escrita.length > 0;
        $('vazioRW').hidden = temDados;
        if (estado.graficoRW) { estado.graficoRW.destroy(); estado.graficoRW = null; }
        if (!temDados) return;

        var todos = leitura.concat(escrita);
        var min = Math.min.apply(null, todos.map(function (p) { return p.x; }));
        var max = Math.max.apply(null, todos.map(function (p) { return p.x; }));

        function conjunto(rotulo, dados, cor, preenchimento) {
            return {
                label: rotulo, data: dados, borderColor: cor, backgroundColor: preenchimento,
                fill: preenchimento ? 'origin' : false, borderWidth: 2, tension: 0.3,
                pointRadius: 0, pointHoverRadius: 4, pointStyle: 'line'
            };
        }

        estado.graficoRW = new Chart($('graficoRW'), {
            type: 'line',
            data: {
                datasets: [
                    conjunto('Leitura', leitura, COR.vermelho, 'rgba(214, 34, 34, 0.08)'),
                    conjunto('Escrita', escrita, COR.azul, null)
                ]
            },
            options: Object.assign(configuracaoBase(animar), {
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    tooltip: {
                        callbacks: {
                            title: function (itens) { return itens.length ? dataHora(itens[0].parsed.x) : ''; },
                            label: function (item) { return item.dataset.label + ': ' + numero(item.parsed.y, 1) + ' MB/s'; }
                        }
                    }
                },
                scales: {
                    x: eixoX(min, Math.max(max, min + HORA)),
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e2e5ea' },
                        title: { display: true, text: 'MB/s' }
                    }
                }
            })
        });
    }

    // ---------- renderização ----------
    function renderizar(dados) {
        var serieUso = pontos(dados.series && dados.series.DISCO_USO);
        var serieLatencia = pontos(dados.series && dados.series.DISCO_LATENCIA);
        var limites = dados.limites || {};

        var limAtencao = Number.isFinite(Number(limites.usoAtencao)) && limites.usoAtencao != null
            ? Number(limites.usoAtencao) : LIMITES.usoAtencao;
        var limCritico = Number.isFinite(Number(limites.usoCritico)) && limites.usoCritico != null
            ? Number(limites.usoCritico) : LIMITES.usoCritico;

        var uso = ultimo(dados, 'DISCO_USO');
        if (uso == null && serieUso.length) uso = serieUso[serieUso.length - 1].y;
        var total = ultimo(dados, 'DISCO_TOTAL');

        var latencia = media(serieLatencia);
        if (latencia == null) latencia = ultimo(dados, 'DISCO_LATENCIA');

        var ctx = {
            uso: uso,
            limAtencao: limAtencao,
            limCritico: limCritico,
            statusUso: uso != null ? statusPorLimites(uso, limAtencao, limCritico) : 'neutro',
            previsao: calcularPrevisao(serieUso, uso, total),
            latencia: latencia
        };

        var chave = estado.maquina + '|' + estado.periodo;
        var animar = chave !== estado.chaveGrafico;
        estado.chaveGrafico = chave;

        $('periodoUso').textContent = PERIODOS[estado.periodo];
        atualizarCards(dados, ctx);
        atualizarResumo(dados, ctx);
        plotarUso(serieUso, ctx, animar);
        plotarLeituraEscrita(
            pontos(dados.series && dados.series.DISCO_LEITURA),
            pontos(dados.series && dados.series.DISCO_ESCRITA),
            animar
        );

        var eventos = eventosDaSerie(serieUso, limAtencao, limCritico, 1, {
            atencao: 'Uso acima de ' + numero(limAtencao, 0) + '%',
            critico: 'Uso acima de ' + numero(limCritico, 0) + '%',
            normal: 'Uso normalizado'
        }).concat(eventosDaSerie(serieLatencia, LIMITES.latenciaAtencao, LIMITES.latenciaCritico, 2, {
            atencao: 'Latência acima de ' + LIMITES.latenciaAtencao + ' ms',
            critico: 'Latência acima de ' + LIMITES.latenciaCritico + ' ms',
            normal: 'Latência normalizada'
        }));
        atualizarAlertas(eventos);
    }

    // ---------- carregamento ----------
    function mensagem(texto) { $('statusDisco').textContent = texto || ''; }

    async function buscarDados(versao) {
        var url = '/dashboardFelipe/disco/' + encodeURIComponent(estado.maquina)
            + '?idEmpresa=' + ID_EMPRESA + '&periodo=' + estado.periodo;
        var resposta = await fetch(url, { cache: 'no-store' });
        if (!resposta.ok) throw new Error(await resposta.text());
        var dados = await resposta.json();
        if (versao != estado.versao) return;

        renderizar(dados);
        mensagem('');
    }

    function carregar() {
        clearTimeout(estado.timer);
        var versao = ++estado.versao;

        buscarDados(versao).catch(function (erro) {
            if (versao != estado.versao) return;
            mensagem(erro.message || 'Não foi possível carregar os dados do disco.');
        }).then(function () {
            if (versao == estado.versao) {
                estado.timer = setTimeout(carregar, INTERVALO_ATUALIZACAO_MS);
            }
        });
    }

    function sincronizarUrl() {
        var p = new URLSearchParams();
        if (estado.maquina != null) p.set('maquina', estado.maquina);
        p.set('periodo', estado.periodo);
        history.replaceState(null, '', '?' + p.toString());
    }

    function marcarPeriodo() {
        document.querySelectorAll('[data-periodo]').forEach(function (botao) {
            var ativo = botao.dataset.periodo == estado.periodo;
            botao.classList.toggle('ativo', ativo);
            botao.setAttribute('aria-pressed', String(ativo));
        });
    }

    async function carregarMaquinas() {
        var seletor = $('selServidor');

        if (!Number.isInteger(ID_EMPRESA) || ID_EMPRESA <= 0) {
            throw new Error('Não foi possível identificar a empresa do usuário.');
        }
        var resposta = await fetch('/dashboardFelipe/maquinas/' + ID_EMPRESA, { cache: 'no-store' });
        if (!resposta.ok) throw new Error(await resposta.text());
        var maquinas = await resposta.json();

        seletor.innerHTML = '';
        if (maquinas.length == 0) {
            seletor.innerHTML = '<option>Nenhum servidor ativo</option>';
            throw new Error('Não há servidores ativos para exibir.');
        }

        maquinas.forEach(function (m) {
            var opcao = document.createElement('option');
            opcao.value = m.id;
            opcao.textContent = m.nome;
            seletor.appendChild(opcao);
        });

        var pedida = params.get('maquina');
        var existe = maquinas.some(function (m) { return String(m.id) == pedida; });
        estado.maquina = existe ? pedida : String(maquinas[0].id);
        seletor.value = estado.maquina;
        seletor.disabled = false;
    }

    async function iniciar() {
        if (typeof Chart != 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            Chart.defaults.color = '#5a6b85';
        }

        marcarPeriodo();
        document.querySelectorAll('[data-periodo]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                estado.periodo = botao.dataset.periodo;
                marcarPeriodo();
                sincronizarUrl();
                if (estado.maquina != null) carregar();
            });
        });
        $('selServidor').addEventListener('change', function (evento) {
            estado.maquina = evento.target.value;
            sincronizarUrl();
            carregar();
        });

        try {
            await carregarMaquinas();
            sincronizarUrl();
            carregar();
        } catch (erro) {
            mensagem(erro.message || 'Não foi possível iniciar a página.');
            $('listaAlertas').innerHTML = '<li class="alerta-vazio">Sem dados para exibir.</li>';
        }
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();