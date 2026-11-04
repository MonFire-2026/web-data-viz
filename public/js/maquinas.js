var maquinasMonFire = [];
var catalogoComponentesMaquina = [];

var COMPONENTES_CADASTRO_MAQUINA = [
    {
        chave: "cpu",
        titulo: "CPU",
        descricao: "Percentual de utilização do processador",
        unidade: "%",
        metricas: [
            { chave: "cpu", codigo: "CPU_USO" }
        ]
    },
    {
        chave: "ram",
        titulo: "RAM",
        descricao: "Percentual de utilização da memória",
        unidade: "%",
        metricas: [
            { chave: "ram", codigo: "RAM_USO" }
        ]
    },
    {
        chave: "disco",
        titulo: "Disco",
        descricao: "Percentual de utilização do armazenamento",
        unidade: "%",
        metricas: [
            { chave: "disco", codigo: "DISCO_USO" }
        ]
    },
    {
        chave: "rede",
        titulo: "Rede",
        descricao: "Recebimento e envio: quanto menor o tráfego, maior a severidade",
        unidade: "MB",
        menorEhPior: true,
        metricas: [
            { chave: "rede_recebida", codigo: "REDE_RECEBIDA", titulo: "Recebimento" },
            { chave: "rede_enviada", codigo: "REDE_ENVIADA", titulo: "Envio" }
        ]
    }
];

function usuarioPodeCadastrarMaquina() {
    var nivel = normalizarNivelUsuario(sessionStorage.CARGO_USUARIO);
    return nivel != undefined && (nivel.valor == "administrador" || nivel.valor == "gerente");
}

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

    if (Number.isNaN(data.getTime())) return "Não informada";

    return data.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function formatarDadoColetor(valor) {
    if (valor === null || valor === undefined || String(valor).trim() == "") {
        return "Aguardando coletor";
    }

    return String(valor);
}

function montarKpisMaquinas() {
    var sistemasOperacionais = new Set(
        maquinasMonFire.map(function (maquina) {
            return maquina.sistemaOperacional
                ? String(maquina.sistemaOperacional).trim().toLowerCase()
                : "";
        }).filter(Boolean)
    );
    var aguardandoColetor = maquinasMonFire.filter(function (maquina) {
        return maquina.situacao == "PENDENTE";
    }).length;

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
            <div class="kpi-valor">${aguardandoColetor}</div>
            <div class="kpi-rotulo">Aguardando ativação</div>
        </div>`;
}

function montarTabelaMaquinas() {
    var tabela = document.getElementById("tabela_maquinas");

    if (maquinasMonFire.length == 0) {
        tabela.innerHTML = '<div class="estado-vazio-maquinas">Nenhuma máquina foi encontrada para esta empresa.</div>';
        return;
    }

    var linhas = maquinasMonFire.map(function (maquina) {
        var situacao = maquina.situacao == "PENDENTE" ? "Aguardando ativação" : maquina.situacao;

        return `
            <tr>
                <td><b>${escaparHtml(maquina.nome)}</b></td>
                <td>${escaparHtml(formatarDadoColetor(maquina.mac))}</td>
                <td>${escaparHtml(formatarDadoColetor(maquina.ip))}</td>
                <td>${escaparHtml(formatarDadoColetor(maquina.sistemaOperacional))}</td>
                <td>${escaparHtml(formatarDataCadastro(maquina.dataCadastro))}</td>
                <td>Aguardando métricas</td>
                <td><span class="selo manutencao">${escaparHtml(situacao)}</span></td>
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

function exibirMensagemCadastroMaquina(texto, tipo, campo) {
    var mensagem = document.getElementById("mensagem_cadastro_maquina");

    mensagem.textContent = texto;
    mensagem.className = "cadastro-maquina-mensagem " + tipo;
    mensagem.hidden = false;

    if (campo) campo.focus();
}

function alternarCadastroMaquina() {
    var botao = document.getElementById("botao_abrir_cadastro_maquina");
    var conteudo = document.getElementById("conteudo_cadastro_maquina");
    var expandido = botao.getAttribute("aria-expanded") == "true";

    botao.setAttribute("aria-expanded", String(!expandido));
    botao.querySelector(".cadastro-maquina-icone").textContent = expandido ? "+" : "−";
    conteudo.hidden = expandido;

    if (!expandido) document.getElementById("nome_maquina_input").focus();
}

function metricasDoComponente(definicao) {
    return catalogoComponentesMaquina.filter(function (metrica) {
        return definicao.metricas.some(function (metricaEsperada) {
            return metricaEsperada.codigo == metrica.codigo;
        });
    });
}

function montarCamposLimites(definicao) {
    var possuiMaisDeUmaMetrica = definicao.metricas.length > 1;

    return definicao.metricas.map(function (metrica) {
        var titulo = possuiMaisDeUmaMetrica
            ? `<strong class="cadastro-maquina-limite-titulo">${escaparHtml(metrica.titulo)}</strong>`
            : "";

        return `
            ${titulo}
            <label for="limite_atencao_${metrica.chave}">
                <span>Limite de atenção (${escaparHtml(definicao.unidade)})</span>
                <span class="cadastro-maquina-input-unidade">
                    <input id="limite_atencao_${metrica.chave}" type="number" min="0" step="0.01"
                        ${definicao.unidade == "%" ? 'max="100"' : ''} inputmode="decimal">
                </span>
            </label>
            <label for="limite_critico_${metrica.chave}">
                <span>Limite crítico (${escaparHtml(definicao.unidade)})</span>
                <span class="cadastro-maquina-input-unidade">
                    <input id="limite_critico_${metrica.chave}" type="number" min="0" step="0.01"
                        ${definicao.unidade == "%" ? 'max="100"' : ''} inputmode="decimal">
                </span>
            </label>`;
    }).join("");
}

function montarComponentesCadastro() {
    var lista = document.getElementById("lista_componentes_maquina");
    var status = document.getElementById("status_componentes_maquina");
    var componentesDisponiveis = COMPONENTES_CADASTRO_MAQUINA.filter(function (definicao) {
        return metricasDoComponente(definicao).length == definicao.metricas.length;
    });

    lista.innerHTML = componentesDisponiveis.map(function (definicao) {
        var chave = definicao.chave;

        return `
            <article class="cadastro-maquina-componente" data-componente="${chave}">
                <label class="cadastro-maquina-componente-cabecalho" for="monitorar_${chave}">
                    <input class="cadastro-maquina-componente-check" id="monitorar_${chave}"
                        type="checkbox" data-chave-componente="${chave}">
                    <span class="cadastro-maquina-componente-marca" aria-hidden="true"></span>
                    <span>
                        <strong>${escaparHtml(definicao.titulo)}</strong>
                        <small>${escaparHtml(definicao.descricao)}</small>
                    </span>
                </label>
                <div class="cadastro-maquina-limites" id="limites_${chave}" hidden>
                    ${montarCamposLimites(definicao)}
                </div>
            </article>`;
    }).join("");

    status.textContent = componentesDisponiveis.length > 0
        ? ""
        : "Nenhum componente de monitoramento está disponível.";
    document.getElementById("botao_cadastrar_maquina").disabled = componentesDisponiveis.length == 0;
}

function alternarLimitesComponente(checkbox) {
    var chave = checkbox.dataset.chaveComponente;
    var limites = document.getElementById("limites_" + chave);
    var inputs = limites.querySelectorAll("input");

    limites.hidden = !checkbox.checked;
    checkbox.closest(".cadastro-maquina-componente").classList.toggle("selecionado", checkbox.checked);

    inputs.forEach(function (input) {
        input.required = checkbox.checked;
        if (!checkbox.checked) input.value = "";
    });
}

function sincronizarComponentesCadastro() {
    document.querySelectorAll("[data-chave-componente]").forEach(function (checkbox) {
        alternarLimitesComponente(checkbox);
    });
}

async function carregarComponentesCadastro() {
    var status = document.getElementById("status_componentes_maquina");
    var botao = document.getElementById("botao_cadastrar_maquina");

    status.textContent = "Carregando componentes...";
    botao.disabled = true;

    try {
        var resposta = await fetch("/maquinas/metricas");
        if (!resposta.ok) throw new Error(await resposta.text());

        catalogoComponentesMaquina = await resposta.json();
        montarComponentesCadastro();
    } catch (erro) {
        catalogoComponentesMaquina = [];
        status.textContent = erro.message || "Não foi possível carregar os componentes.";
    }
}

function prepararMetricasCadastro() {
    var selecionados = Array.from(document.querySelectorAll("[data-chave-componente]:checked"));

    if (selecionados.length == 0) {
        return { erro: "Selecione pelo menos um componente para monitorar." };
    }

    var metricas = [];

    for (var checkbox of selecionados) {
        var definicao = COMPONENTES_CADASTRO_MAQUINA.find(function (item) {
            return item.chave == checkbox.dataset.chaveComponente;
        });
        for (var metricaDefinida of definicao.metricas) {
            var metrica = catalogoComponentesMaquina.find(function (item) {
                return item.codigo == metricaDefinida.codigo;
            });
            var atencaoInput = document.getElementById("limite_atencao_" + metricaDefinida.chave);
            var criticoInput = document.getElementById("limite_critico_" + metricaDefinida.chave);
            var limiteAtencao = Number(atencaoInput.value);
            var limiteCritico = Number(criticoInput.value);
            var nomeMetrica = definicao.titulo
                + (metricaDefinida.titulo ? " - " + metricaDefinida.titulo : "");

            if (
                atencaoInput.value.trim() == "" || criticoInput.value.trim() == ""
                || !Number.isFinite(limiteAtencao) || !Number.isFinite(limiteCritico)
                || limiteAtencao < 0 || limiteCritico < 0
            ) {
                return { erro: "Informe limites válidos para " + nomeMetrica + ".", campo: atencaoInput };
            }

            if (definicao.unidade == "%" && (limiteAtencao > 100 || limiteCritico > 100)) {
                return { erro: "Os limites percentuais devem estar entre 0 e 100.", campo: atencaoInput };
            }

            if (definicao.menorEhPior && limiteCritico >= limiteAtencao) {
                return {
                    erro: "O limite crítico de " + nomeMetrica + " deve ser menor que o limite de atenção.",
                    campo: criticoInput
                };
            }

            if (!definicao.menorEhPior && limiteCritico <= limiteAtencao) {
                return {
                    erro: "O limite crítico de " + nomeMetrica + " deve ser maior que o limite de atenção.",
                    campo: criticoInput
                };
            }

            metricas.push({
                idMetrica: metrica.id,
                limiteAtencao,
                limiteCritico
            });
        }
    }

    return { metricas };
}

function abrirModalCodigo(codigo, expiraEm) {
    var modal = document.getElementById("modal_codigo_ativacao");
    document.getElementById("codigo_ativacao_gerado").textContent = codigo;
    document.getElementById("validade_codigo_ativacao").textContent =
        "Válido até " + formatarDataCadastro(expiraEm) + ".";
    document.getElementById("botao_copiar_codigo").textContent = "Copiar";
    modal.hidden = false;
    document.body.classList.add("cadastro-maquina-modal-aberto");
    document.getElementById("botao_copiar_codigo").focus();
}

function fecharModalCodigo() {
    document.getElementById("modal_codigo_ativacao").hidden = true;
    document.body.classList.remove("cadastro-maquina-modal-aberto");
    document.getElementById("botao_abrir_cadastro_maquina").focus();
}

async function copiarCodigoAtivacao() {
    var codigo = document.getElementById("codigo_ativacao_gerado").textContent;
    var botao = document.getElementById("botao_copiar_codigo");

    try {
        await navigator.clipboard.writeText(codigo);
        botao.textContent = "Copiado!";
    } catch (erro) {
        var selecao = window.getSelection();
        var intervalo = document.createRange();
        intervalo.selectNodeContents(document.getElementById("codigo_ativacao_gerado"));
        selecao.removeAllRanges();
        selecao.addRange(intervalo);
        botao.textContent = "Selecione e copie";
    }
}

async function cadastrarMaquina(evento) {
    evento.preventDefault();

    if (!usuarioPodeCadastrarMaquina()) {
        return exibirMensagemCadastroMaquina("Seu cargo não permite cadastrar máquinas.", "erro");
    }

    var formulario = evento.currentTarget;
    var botaoCadastrar = document.getElementById("botao_cadastrar_maquina");
    var nomeInput = document.getElementById("nome_maquina_input");
    var nome = nomeInput.value.trim();
    var idEmpresa = Number(sessionStorage.ID_EMPRESA);
    var idSolicitante = Number(sessionStorage.ID_USUARIO);
    var configuracao = prepararMetricasCadastro();

    if (nome.length < 2 || nome.length > 50) {
        return exibirMensagemCadastroMaquina(
            "O nome da máquina deve possuir entre 2 e 50 caracteres.",
            "erro",
            nomeInput
        );
    }

    if (configuracao.erro) {
        return exibirMensagemCadastroMaquina(configuracao.erro, "erro", configuracao.campo);
    }

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0 || !Number.isInteger(idSolicitante) || idSolicitante <= 0) {
        return exibirMensagemCadastroMaquina(
            "Não foi possível identificar o usuário e a empresa.",
            "erro"
        );
    }

    botaoCadastrar.disabled = true;
    botaoCadastrar.textContent = "Cadastrando...";

    try {
        var resposta = await fetch("/maquinas/cadastrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nome,
                idEmpresa,
                idSolicitante,
                metricas: configuracao.metricas
            })
        });

        if (!resposta.ok) throw new Error(await resposta.text());

        var maquinaCadastrada = await resposta.json();
        formulario.reset();
        sincronizarComponentesCadastro();
        exibirMensagemCadastroMaquina("Máquina cadastrada e aguardando ativação.", "sucesso");
        abrirModalCodigo(maquinaCadastrada.codigoAtivacao, maquinaCadastrada.codigoExpiraEm);
        await carregarMaquinas();
    } catch (erro) {
        exibirMensagemCadastroMaquina(
            erro.message || "Não foi possível cadastrar a máquina.",
            "erro"
        );
    } finally {
        botaoCadastrar.disabled = catalogoComponentesMaquina.length == 0;
        botaoCadastrar.textContent = "Cadastrar máquina";
    }
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
        if (!resposta.ok) throw new Error(await resposta.text());

        maquinasMonFire = await resposta.json();
        mensagem.textContent = "";
    } catch (erro) {
        maquinasMonFire = [];
        mensagem.textContent = erro.message || "Não foi possível carregar as máquinas.";
    }

    atualizarTelaMaquinas();
}

document.addEventListener("DOMContentLoaded", function () {
    var secaoCadastro = document.getElementById("cadastro-maquina");
    var formulario = document.getElementById("form_cadastro_maquina");
    var listaComponentes = document.getElementById("lista_componentes_maquina");

    if (usuarioPodeCadastrarMaquina()) {
        secaoCadastro.hidden = false;
        formulario.addEventListener("submit", cadastrarMaquina);
        document.getElementById("botao_abrir_cadastro_maquina").addEventListener("click", alternarCadastroMaquina);
        document.getElementById("botao_cancelar_cadastro_maquina").addEventListener("click", function () {
            formulario.reset();
            sincronizarComponentesCadastro();
            document.getElementById("mensagem_cadastro_maquina").hidden = true;
            alternarCadastroMaquina();
        });
        listaComponentes.addEventListener("change", function (evento) {
            if (evento.target.matches("[data-chave-componente]")) {
                alternarLimitesComponente(evento.target);
            }
        });
        carregarComponentesCadastro();
    }

    document.querySelectorAll("[data-fechar-modal-codigo]").forEach(function (elemento) {
        elemento.addEventListener("click", fecharModalCodigo);
    });
    document.getElementById("botao_copiar_codigo").addEventListener("click", copiarCodigoAtivacao);
    document.addEventListener("keydown", function (evento) {
        if (evento.key == "Escape" && !document.getElementById("modal_codigo_ativacao").hidden) {
            fecharModalCodigo();
        }
    });

    atualizarTelaMaquinas();
    carregarMaquinas();
});
