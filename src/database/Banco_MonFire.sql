DROP DATABASE IF EXISTS MonFire;
CREATE DATABASE MonFire;
USE MonFire;

CREATE TABLE empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(50) NOT NULL,
    cnpj CHAR(14) NOT NULL UNIQUE,
    dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    unidade VARCHAR(50) NOT NULL
);

CREATE TABLE usuario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    senha_hash VARCHAR(90) NOT NULL,
    fk_empresa INT NOT NULL,
    CONSTRAINT empresa_usuario FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
);

CREATE TABLE cargo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    funcao VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuario_cargo (
    fk_usuario INT NOT NULL,
    fk_cargo INT NOT NULL,
    ultimo_acesso DATETIME DEFAULT current_timestamp NOT NULL,
    saida DATETIME DEFAULT NULL,
    PRIMARY KEY (fk_usuario, fk_cargo),
    CONSTRAINT fk_usuario_cargo_usuario FOREIGN KEY (fk_usuario) REFERENCES usuario(id),
    CONSTRAINT fk_usuario_cargo_cargo FOREIGN KEY (fk_cargo) REFERENCES cargo(id)
);

CREATE TABLE maquina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    mac CHAR(17) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    sistema_operacional VARCHAR(50) NOT NULL,
    dtHr_cadastro DATETIME DEFAULT current_timestamp NOT NULL,
    fk_empresa INT NOT NULL,
    CONSTRAINT empresa_maquina FOREIGN KEY (fk_empresa) REFERENCES empresa(id),
    CONSTRAINT uk_empresa_mac UNIQUE (fk_empresa, mac)
);

CREATE TABLE nivel_alerta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    estado VARCHAR(40) NOT NULL,
    descricao VARCHAR(150)
);

CREATE TABLE metrica_alerta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    fk_nivel_alerta INT NOT NULL,
    limite DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_metrica_empresa FOREIGN KEY (fk_empresa) REFERENCES empresa(id),
    CONSTRAINT fk_metrica_nivel_alerta FOREIGN KEY (fk_nivel_alerta) REFERENCES nivel_alerta(id)
);

CREATE TABLE metrica_componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(20),
    unidade_medida VARCHAR(20) NOT NULL,
    especificacao VARCHAR(45)
);

CREATE TABLE tipo_componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(30) NOT NULL,
    fk_metrica_componente INT NOT NULL,
    CONSTRAINT fk_componente_metrica FOREIGN KEY (fk_metrica_componente) REFERENCES metrica_componente(id)
);

CREATE TABLE componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    status_atividade TINYINT(1) NOT NULL DEFAULT 1,
    fk_tipo_componente INT NOT NULL,
    fk_metrica_alerta INT,
    CONSTRAINT fk_componente_tipo FOREIGN KEY (fk_tipo_componente) REFERENCES tipo_componente(id),
    CONSTRAINT fk_componente_metrica_alerta FOREIGN KEY (fk_metrica_alerta) REFERENCES metrica_alerta(id)
);

CREATE TABLE configuracao_maquina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fk_maquina INT NOT NULL,
    fk_componente INT NOT NULL,
    CONSTRAINT fk_configuracao_maquina FOREIGN KEY (fk_maquina) REFERENCES maquina(id),
    CONSTRAINT fk_configuracao_componente FOREIGN KEY (fk_componente) REFERENCES componente(id)
);

CREATE TABLE captura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    valor DOUBLE,
    dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    fk_configuracao_maquina INT NOT NULL,
    CONSTRAINT fk_captura_configuracao FOREIGN KEY (fk_configuracao_maquina) REFERENCES configuracao_maquina(id)
);

CREATE TABLE alerta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fk_captura INT NOT NULL,
    fk_metrica_alerta INT NOT NULL,
    CONSTRAINT fk_captura_alerta FOREIGN KEY (fk_captura) REFERENCES captura(id),
    CONSTRAINT fk_alerta_metrica FOREIGN KEY (fk_metrica_alerta) REFERENCES metrica_alerta(id)
);

-- INSERTS:
INSERT INTO empresa (razao_social, cnpj, unidade) VALUES
    ('Monitoramento de Hardaware Bombeiro LTDA', '01234567891234', 'MonFire'),
    ('Sptech Educacao Executiva e Servicos Ltda', '26217610000135', 'São Paulo Tech School');

INSERT INTO cargo (funcao) VALUES
    ('Administrador'),
    ('Gerente'),
    ('Técnico'),
    ('Comum');

INSERT INTO usuario (nome, email, senha_hash, fk_empresa) VALUES
    ('Alexandre Tabacchi', 'alexandre@sptech.school', '$2b$10$KBMteNmthOSspRt3ri5QquIIk8jGYlCvgf.x.plubY5gYO/qdNKpW', 2),
    ('Felipe Amoroso', 'felipe@sptech.school', '$2b$10$KIiaFarAERlI1uJ47EXTneHvwhDCiSgtyyDwpRgb.catVd8dx6CCO', 2),
    ('Gabryel Moura', 'gabryel@sptech.school', '$2b$10$bKXS2JLQehn3LoB4f6D7oeC6kLAt8ef94DLQlLBjGBQJNIOfikq6q', 2),
    ('Helena Caporicci', 'helena@sptech.school', '$2b$10$h5jpQUCYkC9db5QinRgNtuua4HOgdzpwNOvOA9Rvbi9yXtGB4SLfG', 2),
    ('Maria Luiza Vieira', 'marialuiza@sptech.school', '$2b$10$wljkR8Wskq.0MpLfFocobu0NYhOyV166.Vy.4pPcA1ntxtIFIRZtm', 2),
    ('Pedro Caparroz', 'pedro@sptech.school', '$2b$10$TseNY21dVYkXYSztsOgJB.z0zs8TFvZ1EXPHvEZeNzqJTFSNclnQC', 2);

INSERT INTO usuario_cargo (fk_usuario, fk_cargo, ultimo_acesso, saida) VALUES
    (1, 1, '2026-10-09 09:12:00', NULL),
    (2, 1, '2026-10-09 08:47:00', NULL),
    (3, 1, '2026-10-09 07:30:00', NULL),
    (4, 1, '2026-10-08 22:05:00', NULL),
    (5, 1, '2026-09-25 14:20:00', '2026-09-25 14:20:00'),
    (6, 1, '2026-09-18 10:02:00', '2026-09-18 10:02:00');

INSERT INTO nivel_alerta (estado, descricao) VALUES
    ('Normal', 'Funcionamento dentro dos limites esperados'),
    ('Atenção', 'Métrica próxima do limite crítico'),
    ('Crítico', 'Métrica acima do limite permitido');

INSERT INTO metrica_componente (nome, unidade_medida, especificacao) VALUES
    ('Uso',        '%',   'Percentual de utilização'),
    ('Frequência', 'GHz', 'Frequência atual do processador'),
    ('Total',      'GB',  'Capacidade total'),
    ('Disponível', 'GB',  'Quantidade livre'),
    ('Em uso',     'GB',  'Quantidade utilizada'),
    ('Download',   'MB',  'Dados recebidos'),
    ('Rede',       'MB',  'Dados trafegados na rede'),
    ('Rede',       'MB',  'Dados trafegados na rede'),
    ('Upload',     'MB',  'Dados enviados');


INSERT INTO tipo_componente (nome, fk_metrica_componente) VALUES
    ('CPU',   1),
    ('CPU',   2),
    ('RAM',   1),
    ('RAM',   3),
    ('RAM',   4),
    ('RAM',   5),
    ('Disco', 1),
    ('Disco', 3),
    ('Disco', 4),
    ('Disco', 5),
    ('Rede - Recebidos', 6),
    ('Rede - Enviados', 8);


INSERT INTO componente (status_atividade, fk_tipo_componente)
SELECT 1, id FROM tipo_componente;

INSERT INTO maquina (nome, mac, ip, sistema_operacional, fk_empresa) VALUES
    ('SRV-193-CAD-01', '00:1A:2B:3C:4D:5E', '10.193.0.11', 'Ubuntu Server 22.04', 2);

INSERT INTO configuracao_maquina (fk_maquina, fk_componente) VALUES
    (1, 1),   -- id 1:  CPU Uso
    (1, 2),   -- id 2:  CPU Frequência
    (1, 3),   -- id 3:  RAM Uso
    (1, 4),   -- id 4:  RAM Total
    (1, 5),   -- id 5:  RAM Disponível
    (1, 6),   -- id 6:  RAM Em uso
    (1, 7),   -- id 7:  Disco Uso
    (1, 8),   -- id 8:  Disco Total
    (1, 9),   -- id 9:  Disco Disponível
    (1, 10),  -- id 10: Disco Em uso
    (1, 11),  -- id 11: Rede - Recebidos (Java)
    (1, 12);  -- id 12: Rede - Enviados  (Java)




SELECT c.id AS 'Número da Captura',
       m.nome AS 'Máquina',
       t.nome AS 'Componente',
       mc.nome AS 'Métrica',
       c.valor AS 'Valor',
       mc.unidade_medida AS 'Unidade',
       c.dtHr AS 'Data e Hora'
FROM captura c
JOIN configuracao_maquina cm ON cm.id = c.fk_configuracao_maquina
JOIN maquina m ON m.id = cm.fk_maquina
JOIN componente comp ON comp.id = cm.fk_componente
JOIN tipo_componente t ON t.id = comp.fk_tipo_componente
JOIN metrica_componente mc ON mc.id = t.fk_metrica_componente
ORDER BY c.dtHr;
