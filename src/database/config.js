var mysql = require("mysql2");

// CONEXÃO DO BANCO MYSQL SERVER
var mySqlConfig = {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
};

function executar(instrucao, valores = []) {

    if (process.env.AMBIENTE_PROCESSO !== "producao" && process.env.AMBIENTE_PROCESSO !== "desenvolvimento") {
        console.log("\nO AMBIENTE (produção OU desenvolvimento) NÃO FOI DEFINIDO EM .env OU dev.env OU app.js\n");
        return Promise.reject("AMBIENTE NÃO CONFIGURADO EM .env");
    }

    return new Promise(function (resolve, reject) {
        var conexao = mysql.createConnection(mySqlConfig);

        conexao.connect(function (erroConexao) {
            if (erroConexao) {
                conexao.destroy();
                return reject(erroConexao);
            }

            conexao.execute(instrucao, valores, function (erro, resultados) {
                conexao.end();

                if (erro) {
                    return reject(erro);
                }

                resolve(resultados);
            });
        });
    });
}

function executarTransacao(operacao) {
    if (process.env.AMBIENTE_PROCESSO !== "producao" && process.env.AMBIENTE_PROCESSO !== "desenvolvimento") {
        return Promise.reject("AMBIENTE NÃO CONFIGURADO EM .env");
    }

    return new Promise(function (resolve, reject) {
        var conexao = mysql.createConnection(mySqlConfig);

        conexao.connect(function (erroConexao) {
            if (erroConexao) {
                conexao.destroy();
                return reject(erroConexao);
            }

            conexao.beginTransaction(function (erroTransacao) {
                if (erroTransacao) {
                    conexao.end();
                    return reject(erroTransacao);
                }

                var bancoDaTransacao = {
                    executar: function (instrucao, valores = []) {
                        return new Promise(function (resolveExecucao, rejectExecucao) {
                            conexao.execute(instrucao, valores, function (erro, resultados) {
                                if (erro) {
                                    return rejectExecucao(erro);
                                }

                                resolveExecucao(resultados);
                            });
                        });
                    }
                };

                Promise.resolve(operacao(bancoDaTransacao))
                    .then(function (resultado) {
                        conexao.commit(function (erroCommit) {
                            if (erroCommit) {
                                return conexao.rollback(function () {
                                    conexao.end();
                                    reject(erroCommit);
                                });
                            }

                            conexao.end();
                            resolve(resultado);
                        });
                    })
                    .catch(function (erro) {
                        conexao.rollback(function () {
                            conexao.end();
                            reject(erro);
                        });
                    });
            });
        });
    });
}

module.exports = {
    executar,
    executarTransacao
};
