	CREATE DATABASE monitoramento24h;
    USE monitoramento24h;
    
    CREATE TABLE empresa (
    idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(50) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    nome_fantasia VARCHAR(50) NOT NULL
    );
    
    CREATE TABLE usuario (
    idUsuario INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL,
    senha VARCHAR(50) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    fk_empresa INT NOT NULL, 
	CONSTRAINT empresa_usuario FOREIGN KEY (fk_empresa) REFERENCES empresa(idEmpresa)
    );
    
    CREATE TABLE maquina (
    idMaquina INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    fk_empresa INT NOT NULL,
    CONSTRAINT empresa_maquina FOREIGN KEY maquina(fk_empresa) REFERENCES empresa(idEmpresa)
    );
    
    CREATE TABLE componentes (
    idComponente INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL, 
	dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    fk_maquina INT NOT NULL,
    CONSTRAINT maquina_componente FOREIGN KEY componentes(fk_maquina) REFERENCES maquina(idMaquina)
    );
    
    CREATE TABLE medicao (
    idMedicao INT PRIMARY KEY AUTO_INCREMENT,
    valor DOUBLE, 
    uni_media CHAR(2),
    situacao VARCHAR(15),
    dtHr DATETIME DEFAULT current_timestamp NOT NULL, 
    fk_componentes INT NOT NULL,
    CONSTRAINT componentes_medicao FOREIGN KEY medicao(fk_componentes) REFERENCES componentes(idComponente)
    );
    
    