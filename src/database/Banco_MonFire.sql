DROP DATABASE MonFire;
CREATE DATABASE MonFire;
USE MonFire;

CREATE TABLE empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(50) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    dtHr DATETIME DEFAULT current_timestamp NOT NULL,
    nome_fantasia VARCHAR(50) NOT NULL
);
    
    CREATE TABLE cargo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    funcao VARCHAR(50) NOT NULL
);
    
    CREATE TABLE usuario(
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL,
    senha VARCHAR(50) NOT NULL,
    fk_empresa INT NOT NULL,
    fk_cargo INT NOT NULL, 
	CONSTRAINT empresa_usuario FOREIGN KEY (fk_empresa) REFERENCES empresa(id),
    CONSTRAINT cargo_usuario FOREIGN KEY (fk_cargo) REFERENCES cargo(id)
);
    
    CREATE TABLE maquina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(50) NOT NULL,
    fk_empresa INT NOT NULL,
    CONSTRAINT empresa_maquina FOREIGN KEY maquina(fk_empresa) REFERENCES empresa(id)
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
insert into empresa (razao_social, cnpj, nome_fantasia) values
	('Monitoramento de Hardaware Bombeiro LTDA','01234567891234','MonFire'),
    ('Sptech Educacao Executiva e Servicos Ltda','26217610000135','São Paulo Tech School');
    
    
INSERT INTO maquina (nome, fk_empresa) VALUES 
	('Matheus Rocha', 2),
    ('Mickaela Rodrigues', 2),
    ('Raphael Oliveira', 2),
    ('Felipe Dias', 2),
    ('Enzo Valin', 2),
    ('Beatriz Sarro', 2);
    
INSERT INTO nivel_alerta (estado, descricao)
VALUES
('Normal', 'Funcionamento dentro dos limites esperados'),
('Atenção', 'Métrica próxima do limite crítico'),
('Crítico', 'Métrica acima do limite permitido');


INSERT INTO metrica_componente (unidade_medida, especificacao)
VALUES
('%', 'Percentual de utilização'),
('GHz', 'Frequência atual do processador'),
('GB', 'Quantidade de memória');
    
INSERT INTO tipo_componente (nome, fk_metrica_componente)
VALUES
('CPU', 1),
('Memória RAM', 1),
('Disco', 1),
('CPU', 2),
('Memória RAM', 3);
    
INSERT INTO componente
(status_atividade, fk_tipo_componente)
VALUES
(1, 1), 
(1, 2), 
(1, 3), 
(1, 4);


-- SELECT: 
/*SELECT c.id AS 'Número De Captura',
	m.nome AS 'Nome da Maquina', 
    tipo AS 'Tipo de Captura',
    comp.nome AS 'Nome Do Componentes',
	valor AS 'Valor Da Captura', 
    uni_medida AS 'Unidade De Medida',
    situacao AS 'Situação Da Captura',
	c.dtHr AS 'Data e Hora'
FROM captura as c JOIN maquina as m on fk_maquina = m.id JOIN componente AS comp ON comp.id = fk_componente;

select * from componente as c JOIN maquina AS m on c.fk_maquina = m.id;


create view ViewDisco as select nome, tipo, concat(valor, " " ,uni_medida) as valor, captura.dtHr from captura join componente on fk_componente = componente.id where nome ='DISCO' and tipo = 'Uso';
create view ViewCPU as select nome, tipo, concat(valor, " " ,uni_medida) as valor, captura.dtHr from captura join componente on fk_componente = componente.id where nome ='CPU' and tipo = 'Uso';
create view ViewRAM as select nome, tipo, concat(valor, " " ,uni_medida) as valor, captura.dtHr from captura join componente on fk_componente = componente.id where nome ='RAM' and tipo = 'Uso';7
*/
