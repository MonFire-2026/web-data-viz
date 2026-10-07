# Guia de homologação: EC2, MySQL com Docker, volume EBS e coletor Python

Este guia monta uma versão acadêmica do MonFire com duas máquinas Ubuntu na AWS:

~~~text
EC2 monfire-coletor
Container Python
CPU, RAM e disco do host
          |
          | TCP 3306 pelo IP privado
          v
EC2 monfire-banco
Container MySQL
          |
          v
Volume EBS montado em /dados/mysql
~~~

O coletor acessará diretamente o MySQL nesta etapa. Essa abordagem é adequada para a homologação proposta, mas não deve ser interpretada como a arquitetura final de produção.

## 1. O que será criado

| Recurso | Configuração sugerida | Função |
|---|---|---|
| EC2 `monfire-banco` | Ubuntu 24.04, `t3.small` | Executar o container MySQL |
| EC2 `monfire-coletor` | Ubuntu 24.04, `t3.micro` | Executar o container Python |
| EBS de dados | `gp3`, 20 GiB | Persistir `/var/lib/mysql` |
| `sg-monfire-banco` | Entrada 3306 somente do coletor | Proteger o MySQL |
| `sg-monfire-coletor` | SSH somente do IP dos desenvolvedores | Proteger o coletor |

Para simplificar a homologação, as duas EC2 podem ficar na mesma VPC e subnet pública, com IPv4 público usado apenas para SSH. A comunicação entre coletor e banco sempre usará os endereços IPv4 privados.

> Nunca configure a porta 3306 com origem `0.0.0.0/0`.

## 2. Pré-requisitos

Antes de começar, tenha:

- uma conta AWS com permissão para criar EC2, EBS e Security Groups;
- um par de chaves EC2 no formato `.pem`;
- seu IPv4 público atual;
- o repositório do MonFire disponível no GitHub;
- um terminal com o comando `ssh`.

No console da AWS, confirme a região selecionada. Todos os recursos deste guia devem ser criados na mesma região e, quando indicado, na mesma zona de disponibilidade.

## 3. Criar os Security Groups

Crie primeiro o Security Group do coletor, pois ele será selecionado como origem na regra do banco.

### 3.1 `sg-monfire-coletor`

No console da AWS:

1. Acesse **EC2 > Network & Security > Security Groups**.
2. Clique em **Create security group**.
3. Informe:
   - nome: `sg-monfire-coletor`;
   - descrição: `Acesso da maquina coletora MonFire`;
   - VPC: selecione a VPC que será usada pelas duas EC2.
4. Adicione a entrada:

| Tipo | Porta | Origem |
|---|---:|---|
| SSH | 22 | `SEU_IP_PUBLICO/32` |

O botão **My IP** da AWS preenche o IP atual automaticamente.

### 3.2 `sg-monfire-banco`

Crie outro Security Group na mesma VPC:

| Tipo | Porta | Origem |
|---|---:|---|
| SSH | 22 | `SEU_IP_PUBLICO/32` |
| MySQL/Aurora | 3306 | Security Group `sg-monfire-coletor` |

Na origem da regra MySQL, pesquise pelo nome ou pelo ID `sg-...` do Security Group do coletor. Não informe o IP público do coletor.

Referência: [regras recomendadas para servidores de banco na AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).

## 4. Criar as duas instâncias EC2

### 4.1 EC2 do banco

Em **EC2 > Instances > Launch instances**, configure:

- nome: `monfire-banco`;
- AMI: **Ubuntu Server 24.04 LTS**, arquitetura x86_64;
- tipo: `t3.small`;
- key pair: selecione sua chave `.pem`;
- VPC e subnet: anote as escolhas para repeti-las no coletor;
- Auto-assign public IP: habilitado apenas para facilitar o SSH nesta homologação;
- Security Group: `sg-monfire-banco`;
- volume raiz: aproximadamente 12 GiB `gp3`.

Anote após a criação:

~~~text
IP público do banco: usado somente para SSH
IP privado do banco: usado pelo coletor e pelo Docker
Zona de disponibilidade: usada para criar o EBS de dados
~~~

### 4.2 EC2 do coletor

Repita o processo com:

- nome: `monfire-coletor`;
- AMI: Ubuntu Server 24.04 LTS x86_64;
- tipo: `t3.micro`;
- a mesma VPC e subnet do banco;
- Security Group: `sg-monfire-coletor`;
- volume raiz: aproximadamente 12 GiB `gp3`.

Anote os IPs público e privado.

## 5. Conectar por SSH

No PowerShell do Windows:

~~~powershell
ssh -i "C:\caminho\para\monfire-chave.pem" ubuntu@IP_PUBLICO_DA_EC2
~~~

Em Linux ou macOS:

~~~bash
chmod 400 monfire-chave.pem
ssh -i ./monfire-chave.pem ubuntu@IP_PUBLICO_DA_EC2
~~~

Abra um terminal para a EC2 do banco e outro para a EC2 do coletor.

## 6. Instalar Docker nas duas EC2

Execute os comandos desta seção nas duas máquinas.

### 6.1 Preparar o repositório oficial

~~~bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
~~~

Adicione o repositório do Docker:

~~~bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
~~~

Instale o Docker Engine e o plugin do Compose:

~~~bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
~~~

Os comandos do restante do guia usam `sudo docker`. Isso evita acrescentar permissões extras ao usuário `ubuntu`.

Referência: [instalação oficial do Docker Engine no Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

## 7. Criar e montar o volume EBS

Esta seção deve ser executada somente para a EC2 `monfire-banco`.

### 7.1 Criar e anexar o volume

No console da AWS:

1. Acesse **EC2 > Elastic Block Store > Volumes**.
2. Clique em **Create volume**.
3. Configure:
   - tipo: `gp3`;
   - tamanho: 20 GiB;
   - zona de disponibilidade: exatamente a mesma da EC2 `monfire-banco`.
4. Crie o volume.
5. Selecione-o e escolha **Actions > Attach volume**.
6. Selecione a instância `monfire-banco`.
7. Aceite o nome de dispositivo sugerido e confirme.

### 7.2 Identificar o dispositivo correto

Na EC2 do banco:

~~~bash
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS,SERIAL
sudo lsblk -f
~~~

Em instâncias atuais, o novo EBS geralmente aparece como `/dev/nvme1n1`, mas o nome pode ser diferente. Identifique o disco de 20 GiB que esteja sem filesystem e sem ponto de montagem.

> Atenção: o próximo comando de formatação destrói qualquer dado existente no dispositivo. Não copie o nome do exemplo sem confirmar o resultado do `lsblk`.

Substitua `/dev/nvme1n1` pelo dispositivo confirmado:

~~~bash
sudo file -s /dev/nvme1n1
~~~

Somente se a saída indicar que o volume está vazio, formate-o:

~~~bash
sudo mkfs.ext4 /dev/nvme1n1
~~~

### 7.3 Montar o EBS

~~~bash
sudo mkdir -p /dados/mysql
sudo mount /dev/nvme1n1 /dados/mysql
findmnt /dados/mysql
~~~

Descubra o UUID:

~~~bash
sudo blkid /dev/nvme1n1
~~~

Faça backup da configuração de montagem:

~~~bash
sudo cp /etc/fstab /etc/fstab.backup
sudo nano /etc/fstab
~~~

Adicione uma linha no final, substituindo `UUID_DO_VOLUME`:

~~~text
UUID=UUID_DO_VOLUME /dados/mysql ext4 defaults,nofail 0 2
~~~

Salve o arquivo e valide antes de reiniciar:

~~~bash
sudo umount /dados/mysql
sudo mount -a
findmnt /dados/mysql
df -h /dados/mysql
~~~

Se `sudo mount -a` mostrar erro, corrija o `/etc/fstab` antes de reiniciar a EC2. Se necessário, restaure o backup:

~~~bash
sudo cp /etc/fstab.backup /etc/fstab
~~~

Referência: [como disponibilizar e montar um volume EBS](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-using-volumes.html).

## 8. Preparar o container MySQL

Na EC2 do banco, crie a seguinte estrutura:

~~~text
monfire-banco/
├── .env
├── compose.yml
├── Dockerfile
└── init/
    └── 001-schema.sql
~~~

Os conteúdos completos estão nas próximas subseções.

### 8.1 `monfire-banco/Dockerfile`

~~~dockerfile
FROM mysql:8.4

COPY init/001-schema.sql /docker-entrypoint-initdb.d/001-schema.sql
~~~

Arquivos `.sql` copiados para `/docker-entrypoint-initdb.d` são executados pelo container oficial somente quando o diretório de dados está vazio.

Referência: [imagem oficial do MySQL no Docker Hub](https://hub.docker.com/_/mysql/).

### 8.2 `monfire-banco/.env`

~~~dotenv
MYSQL_ROOT_PASSWORD=troque-por-uma-senha-root-forte
MYSQL_DATABASE=MonFire
DB_BIND_IP=10.0.0.10
~~~

Substitua `DB_BIND_IP` pelo IPv4 privado da EC2 do banco.

Não envie esse arquivo ao Git. Se a pasta estiver dentro de um repositório, confirme que `.env` está no `.gitignore`.

### 8.3 `monfire-banco/compose.yml`

O Compose lerá `DB_BIND_IP` do arquivo `.env` e publicará o MySQL somente nesse endereço privado.

~~~yaml
services:
  mysql:
    build:
      context: .
    container_name: monfire-mysql
    env_file:
      - .env
    ports:
      - "${DB_BIND_IP}:3306:3306"
    volumes:
      - /dados/mysql:/var/lib/mysql
    healthcheck:
      test:
        - CMD-SHELL
        - mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    restart: unless-stopped
~~~

O MySQL escuta dentro do container, mas a publicação da porta ocorre apenas no IP privado da EC2. O Security Group continua sendo a barreira que define quais máquinas podem chegar à porta 3306.

### 8.4 `monfire-banco/init/001-schema.sql`

O script não contém `DROP DATABASE`. Ele cria somente as tabelas necessárias para demonstrar a coleta de CPU, RAM e disco.

~~~sql
CREATE DATABASE IF NOT EXISTS MonFire
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE MonFire;

CREATE TABLE IF NOT EXISTS empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(80) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    nome_fantasia VARCHAR(80) NOT NULL,
    dtHr DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS maquina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(80) NOT NULL,
    fk_empresa INT NOT NULL,
    CONSTRAINT fk_maquina_empresa
        FOREIGN KEY (fk_empresa) REFERENCES empresa(id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS metrica_componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(40) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL,
    especificacao VARCHAR(80)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS tipo_componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(40) NOT NULL,
    fk_metrica_componente INT NOT NULL,
    CONSTRAINT fk_tipo_metrica
        FOREIGN KEY (fk_metrica_componente)
        REFERENCES metrica_componente(id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    status_atividade TINYINT(1) NOT NULL DEFAULT 1,
    fk_tipo_componente INT NOT NULL,
    CONSTRAINT fk_componente_tipo
        FOREIGN KEY (fk_tipo_componente)
        REFERENCES tipo_componente(id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS configuracao_maquina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fk_maquina INT NOT NULL,
    fk_componente INT NOT NULL,
    CONSTRAINT uq_maquina_componente
        UNIQUE (fk_maquina, fk_componente),
    CONSTRAINT fk_configuracao_maquina
        FOREIGN KEY (fk_maquina) REFERENCES maquina(id),
    CONSTRAINT fk_configuracao_componente
        FOREIGN KEY (fk_componente) REFERENCES componente(id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS captura (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    valor DOUBLE NOT NULL,
    dtHr DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    fk_configuracao_maquina INT NOT NULL,
    CONSTRAINT fk_captura_configuracao
        FOREIGN KEY (fk_configuracao_maquina)
        REFERENCES configuracao_maquina(id),
    INDEX idx_captura_configuracao_data
        (fk_configuracao_maquina, dtHr)
) ENGINE = InnoDB;

INSERT IGNORE INTO empresa
    (id, razao_social, cnpj, nome_fantasia)
VALUES
    (1, 'MonFire Homologacao LTDA', '00000000000000', 'MonFire');

INSERT IGNORE INTO maquina
    (id, nome, fk_empresa)
VALUES
    (1, 'EC2 Coletor MonFire', 1);

INSERT IGNORE INTO metrica_componente
    (id, nome, unidade_medida, especificacao)
VALUES
    (1, 'Uso de CPU', '%', 'Percentual de utilizacao'),
    (2, 'Uso de memoria RAM', '%', 'Percentual de utilizacao'),
    (3, 'Uso de disco', '%', 'Percentual de ocupacao');

INSERT IGNORE INTO tipo_componente
    (id, nome, fk_metrica_componente)
VALUES
    (1, 'CPU', 1),
    (2, 'Memoria RAM', 2),
    (3, 'Disco', 3);

INSERT IGNORE INTO componente
    (id, status_atividade, fk_tipo_componente)
VALUES
    (1, 1, 1),
    (2, 1, 2),
    (3, 1, 3);

INSERT IGNORE INTO configuracao_maquina
    (id, fk_maquina, fk_componente)
VALUES
    (1, 1, 1),
    (2, 1, 2),
    (3, 1, 3);
~~~

Os IDs `1`, `2` e `3` serão usados pelo coletor. Em uma implantação com várias máquinas, cada uma deverá receber suas próprias linhas em `maquina` e `configuracao_maquina`.

## 9. Iniciar o MySQL

Entre na pasta do banco:

~~~bash
cd monfire-banco
sudo docker compose config
sudo docker compose up --build
~~~

Mantenha esse terminal aberto durante o primeiro teste. As mensagens do MySQL aparecerão diretamente nele. Aguarde até o servidor indicar que está pronto para conexões.

Abra uma segunda conexão SSH com a EC2 do banco e confira o estado:

~~~bash
cd monfire-banco
sudo docker compose ps
~~~

### 9.1 Criar o usuário limitado do coletor

Abra o cliente MySQL dentro do container:

~~~bash
sudo docker compose exec mysql mysql -uroot -p
~~~

Digite a senha `MYSQL_ROOT_PASSWORD` quando solicitada. No prompt do MySQL, execute:

~~~sql
CREATE USER IF NOT EXISTS 'monfire_collector'@'%'
    IDENTIFIED BY 'troque-por-uma-senha-exclusiva-do-coletor';

REVOKE ALL PRIVILEGES, GRANT OPTION
    FROM 'monfire_collector'@'%';

GRANT INSERT ON MonFire.captura
    TO 'monfire_collector'@'%';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'monfire_collector'@'%';
~~~

O resultado deve mostrar somente `USAGE` e `INSERT` em `MonFire.captura`.

Saia do MySQL:

~~~sql
EXIT;
~~~

Depois do primeiro teste, o banco pode ser iniciado em segundo plano:

~~~bash
sudo docker compose up -d
sudo docker compose ps
~~~

## 10. Preparar o container do coletor Python

Na EC2 `monfire-coletor`, crie:

~~~text
monfire-coletor/
├── .env
├── coletor.py
├── compose.yml
├── Dockerfile
└── requirements.txt
~~~

### 10.1 `monfire-coletor/requirements.txt`

~~~text
mysql-connector-python==9.4.0
psutil==7.0.0
python-dotenv==1.1.1
~~~

As versões estão fixadas para que uma reconstrução use as mesmas dependências. Elas podem ser atualizadas posteriormente, após novos testes.

### 10.2 `monfire-coletor/Dockerfile`

~~~dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY coletor.py .

CMD ["python", "-u", "coletor.py"]
~~~

### 10.3 `monfire-coletor/.env`

~~~dotenv
DB_HOST=10.0.0.10
DB_PORT=3306
DB_DATABASE=MonFire
DB_USER=monfire_collector
DB_PASSWORD=troque-por-a-mesma-senha-criada-no-mysql

CONFIG_CPU_ID=1
CONFIG_RAM_ID=2
CONFIG_DISCO_ID=3
INTERVALO_SEGUNDOS=30

HOST_PROC=/host/proc
HOST_ROOT=/host/root
~~~

Substitua `DB_HOST` pelo IPv4 privado da EC2 do banco. Não use o IP público.

### 10.4 `monfire-coletor/compose.yml`

~~~yaml
services:
  coletor:
    build:
      context: .
    container_name: monfire-coletor
    env_file:
      - .env
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host/root:ro
    restart: "no"
~~~

Os mounts são somente leitura. O coletor não precisa ser executado como container privilegiado.

### 10.5 `monfire-coletor/coletor.py`

~~~python
import os
import sys
import time
from datetime import datetime, timezone

import mysql.connector
import psutil
from dotenv import load_dotenv
from mysql.connector import Error as MySqlError


load_dotenv()


def exigir_variavel(nome):
    valor = os.getenv(nome)
    if valor is None or not valor.strip():
        raise ValueError(f"A variavel obrigatoria {nome} nao foi definida.")
    return valor.strip()


def carregar_configuracao():
    configuracao = {
        "db_host": exigir_variavel("DB_HOST"),
        "db_port": int(exigir_variavel("DB_PORT")),
        "db_database": exigir_variavel("DB_DATABASE"),
        "db_user": exigir_variavel("DB_USER"),
        "db_password": exigir_variavel("DB_PASSWORD"),
        "config_cpu_id": int(exigir_variavel("CONFIG_CPU_ID")),
        "config_ram_id": int(exigir_variavel("CONFIG_RAM_ID")),
        "config_disco_id": int(exigir_variavel("CONFIG_DISCO_ID")),
        "intervalo": int(exigir_variavel("INTERVALO_SEGUNDOS")),
        "host_proc": exigir_variavel("HOST_PROC"),
        "host_root": exigir_variavel("HOST_ROOT"),
    }

    if configuracao["intervalo"] <= 0:
        raise ValueError("INTERVALO_SEGUNDOS deve ser maior que zero.")

    return configuracao


def coletar_metricas(configuracao):
    psutil.PROCFS_PATH = configuracao["host_proc"]

    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory().percent
    disco = psutil.disk_usage(configuracao["host_root"]).percent

    return {
        configuracao["config_cpu_id"]: cpu,
        configuracao["config_ram_id"]: ram,
        configuracao["config_disco_id"]: disco,
    }


def conectar(configuracao):
    return mysql.connector.connect(
        host=configuracao["db_host"],
        port=configuracao["db_port"],
        database=configuracao["db_database"],
        user=configuracao["db_user"],
        password=configuracao["db_password"],
        connection_timeout=10,
        autocommit=False,
    )


def inserir_metricas(conexao, metricas, coletado_em):
    instrucao = """
        INSERT INTO captura
            (valor, dtHr, fk_configuracao_maquina)
        VALUES
            (%s, %s, %s)
    """

    valores = [
        (valor, coletado_em, configuracao_id)
        for configuracao_id, valor in metricas.items()
    ]

    cursor = conexao.cursor()
    try:
        cursor.executemany(instrucao, valores)
        conexao.commit()
    except Exception:
        conexao.rollback()
        raise
    finally:
        cursor.close()


def executar():
    conexao = None

    try:
        configuracao = carregar_configuracao()

        print(
            "Conectando ao MySQL em "
            f"{configuracao['db_host']}:{configuracao['db_port']}...",
            flush=True,
        )

        conexao = conectar(configuracao)
        print("Conexao estabelecida. Coleta iniciada.", flush=True)

        while True:
            metricas = coletar_metricas(configuracao)
            coletado_em = datetime.now(timezone.utc).replace(tzinfo=None)

            inserir_metricas(conexao, metricas, coletado_em)

            print(
                f"[{coletado_em.isoformat()}Z] "
                f"CPU={metricas[configuracao['config_cpu_id']]:.1f}% | "
                f"RAM={metricas[configuracao['config_ram_id']]:.1f}% | "
                f"Disco={metricas[configuracao['config_disco_id']]:.1f}% "
                "| dados inseridos",
                flush=True,
            )

            time.sleep(configuracao["intervalo"])

    except KeyboardInterrupt:
        print("\nColetor encerrado pelo usuario.", flush=True)

    except ValueError as erro:
        print(f"ERRO DE CONFIGURACAO: {erro}", file=sys.stderr, flush=True)
        sys.exit(1)

    except MySqlError as erro:
        print(
            "ERRO DO MYSQL: "
            f"codigo={erro.errno}; mensagem={erro.msg}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    except OSError as erro:
        print(
            f"ERRO AO LER O HOST: {erro}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    except Exception as erro:
        print(
            f"ERRO INESPERADO ({type(erro).__name__}): {erro}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    finally:
        if conexao is not None and conexao.is_connected():
            conexao.close()
            print("Conexao com o MySQL encerrada.", flush=True)


if __name__ == "__main__":
    executar()
~~~

O código usa placeholders `%s` e envia os valores separadamente. Isso evita montar SQL por concatenação. Como o autocommit está desligado, as três capturas são confirmadas juntas com `commit`; em caso de erro, `rollback` desfaz o conjunto.

Referências:

- [configuração de PROCFS_PATH no psutil](https://psutil.readthedocs.io/stable/#psutil.PROCFS_PATH);
- [transações e commit no MySQL Connector/Python](https://dev.mysql.com/doc/connector-python/en/connector-python-api-mysqlconnection-commit.html).

## 11. Testar a comunicação de rede

Na EC2 do coletor:

~~~bash
sudo apt-get update
sudo apt-get install -y netcat-openbsd
nc -vz IP_PRIVADO_DO_BANCO 3306
~~~

Resultado esperado:

~~~text
Connection to IP_PRIVADO_DO_BANCO 3306 port [tcp/mysql] succeeded!
~~~

Se ocorrer timeout:

1. confirme que as duas EC2 estão na mesma VPC;
2. confira o IP privado em `DB_HOST`;
3. confirme que a regra 3306 do banco usa como origem `sg-monfire-coletor`;
4. confirme no banco que `sudo docker compose ps` mostra o MySQL ativo;
5. confirme que o IP privado usado no `compose.yml` do banco está correto.

## 12. Executar o coletor

Na EC2 do coletor:

~~~bash
cd monfire-coletor
sudo docker compose config
sudo docker compose up --build
~~~

O comando fica em primeiro plano. A cada ciclo deverão aparecer CPU, RAM e disco, seguidos de `dados inseridos`.

Para encerrar manualmente, pressione `Ctrl+C`.

Se houver erro, o Python:

1. mostra a categoria e a mensagem diretamente no terminal;
2. desfaz a transação atual;
3. fecha a conexão;
4. encerra com código diferente de zero;
5. não reinicia automaticamente.

## 13. Confirmar os registros no banco

Em outra conexão SSH com a EC2 do banco:

~~~bash
cd monfire-banco
sudo docker compose exec mysql mysql -uroot -p MonFire
~~~

Execute:

~~~sql
SELECT
    captura.id,
    maquina.nome AS maquina,
    tipo_componente.nome AS componente,
    captura.valor,
    metrica_componente.unidade_medida,
    captura.dtHr
FROM captura
JOIN configuracao_maquina
    ON configuracao_maquina.id = captura.fk_configuracao_maquina
JOIN maquina
    ON maquina.id = configuracao_maquina.fk_maquina
JOIN componente
    ON componente.id = configuracao_maquina.fk_componente
JOIN tipo_componente
    ON tipo_componente.id = componente.fk_tipo_componente
JOIN metrica_componente
    ON metrica_componente.id =
       tipo_componente.fk_metrica_componente
ORDER BY captura.id DESC
LIMIT 12;
~~~

Devem aparecer grupos de três linhas: CPU, memória RAM e disco.

## 14. Testar a persistência do EBS

Primeiro, confirme que já existem capturas. Depois, na EC2 do banco:

~~~bash
cd monfire-banco
sudo docker compose down
sudo docker compose up -d --build
sudo docker compose ps
~~~

Entre novamente no MySQL e conte os registros:

~~~bash
sudo docker compose exec mysql mysql -uroot -p MonFire
~~~

~~~sql
SELECT COUNT(*) AS quantidade_de_capturas
FROM captura;
~~~

A quantidade deve permanecer igual ou aumentar após o coletor voltar a ser executado. Isso comprova que os dados estão no EBS montado em `/dados/mysql`, e não na camada descartável do container.

> Não formate novamente o EBS depois que ele contiver dados.

## 15. Testes de erro

### 15.1 Senha incorreta

Altere temporariamente `DB_PASSWORD` no `.env` do coletor e execute:

~~~bash
sudo docker compose up --build
~~~

O programa deve mostrar `ERRO DO MYSQL`, informar acesso negado e encerrar. Restaure a senha correta antes de continuar.

### 15.2 Banco indisponível

Na EC2 do banco:

~~~bash
cd monfire-banco
sudo docker compose stop mysql
~~~

Execute o coletor. Ele deve informar falha de conexão e encerrar.

Depois, ligue o banco novamente:

~~~bash
sudo docker compose start mysql
~~~

### 15.3 ID de configuração inexistente

No `.env` do coletor, altere temporariamente:

~~~dotenv
CONFIG_CPU_ID=999999
~~~

O MySQL deve rejeitar o conjunto por violação da chave estrangeira. Como as três inserções fazem parte da mesma transação, nenhuma delas deve permanecer no banco.

Restaure `CONFIG_CPU_ID=1` após o teste.

### 15.4 Tentativa não autorizada na porta 3306

Partindo de uma EC2 que não tenha o Security Group `sg-monfire-coletor`, execute:

~~~bash
nc -vz IP_PRIVADO_DO_BANCO 3306
~~~

A conexão deve falhar ou expirar. Não altere a regra para `0.0.0.0/0` para fazer esse teste funcionar.

## 16. Problemas comuns

### `Connection timed out`

Normalmente indica IP incorreto, Security Group incorreto, MySQL parado ou porta publicada em outro endereço.

### `Access denied for user`

Confira `DB_USER`, `DB_PASSWORD` e a criação de `monfire_collector` no MySQL.

### `Cannot add or update a child row`

Um dos IDs `CONFIG_CPU_ID`, `CONFIG_RAM_ID` ou `CONFIG_DISCO_ID` não existe em `configuracao_maquina`.

### `Permission denied` em `/var/lib/mysql`

Primeiro confirme que `/dados/mysql` está realmente montado:

~~~bash
findmnt /dados/mysql
ls -ld /dados/mysql
~~~

Em um volume novo e vazio, caso o container oficial não consiga ajustar as permissões, pare o MySQL e aplique:

~~~bash
sudo chown -R 999:999 /dados/mysql
~~~

Depois inicie o container novamente. Não aplique mudanças recursivas em outro caminho.

### O coletor mostra os recursos do container

Confirme os três mounts somente leitura no `compose.yml` e os valores:

~~~dotenv
HOST_PROC=/host/proc
HOST_ROOT=/host/root
~~~

## 17. Checklist final

- [ ] As duas EC2 usam Ubuntu 24.04 e estão na mesma VPC.
- [ ] O SSH está limitado ao IP público dos desenvolvedores com `/32`.
- [ ] A porta 3306 aceita somente `sg-monfire-coletor`.
- [ ] O coletor usa o IP privado do banco.
- [ ] O EBS de 20 GiB está montado em `/dados/mysql`.
- [ ] O `/etc/fstab` foi validado com `sudo mount -a`.
- [ ] O Docker e o plugin Compose funcionam nas duas EC2.
- [ ] O MySQL criou o schema sem executar `DROP DATABASE`.
- [ ] O usuário `monfire_collector` possui somente `INSERT`.
- [ ] CPU, RAM e disco aparecem no terminal do coletor.
- [ ] As capturas aparecem no `SELECT` de validação.
- [ ] Os dados permanecem após recriar o container MySQL.
- [ ] Senha inválida mostra o motivo e encerra o Python.
- [ ] Banco indisponível mostra o motivo e encerra o Python.
- [ ] ID inválido desfaz toda a transação e encerra o Python.
- [ ] Uma máquina sem o Security Group correto não alcança a porta 3306.

## 18. Limites desta homologação

Nesta versão:

- o coletor grava diretamente no MySQL;
- não existe fila local nem repetição automática;
- qualquer erro encerra o coletor;
- o `.env` é configurado manualmente;
- não há API, registry, pipeline, CloudWatch ou alerta externo;
- cada máquina adicional precisa de registros próprios em `maquina` e `configuracao_maquina`.

Em uma evolução para produção, o caminho recomendado é inserir uma API HTTPS entre os coletores e o banco, retirar o MySQL do alcance direto dos agentes, usar um gerenciador de segredos e automatizar backups e observabilidade.
