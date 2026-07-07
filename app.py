import os
import smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, render_template_string, request, redirect, url_for

app = Flask(__name__)

# ==========================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS
# ==========================================
DATABASE_URL = "postgresql://postgres:ZoLVFMMKvRQxFhFpTApEqmESiNdQpCOy@acela.proxy.rlwy.net:19268/railway"

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao banco: {e}")
        return None

def iniciar_banco():
    conn = get_db_connection()
    if conn is None: return
    cur = conn.cursor()
    
    # Criação das tabelas base e de todos os módulos
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            cpf VARCHAR(14) UNIQUE,
            email VARCHAR(100) UNIQUE,
            contato VARCHAR(20),
            senha VARCHAR(100),
            tipo_perfil VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'pendente'
        );
        CREATE TABLE IF NOT EXISTS planos_de_acao (
            id SERIAL PRIMARY KEY,
            paciente_id INTEGER REFERENCES usuarios(id),
            psicologa_id INTEGER REFERENCES usuarios(id),
            plano TEXT,
            exercicios TEXT,
            metas TEXT,
            recomendacoes TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS recados_gerais (
            id SERIAL PRIMARY KEY,
            psicologa_id INTEGER REFERENCES usuarios(id),
            mensagem TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agenda (
            id SERIAL PRIMARY KEY,
            psicologa_id INTEGER REFERENCES usuarios(id),
            paciente_id INTEGER REFERENCES usuarios(id),
            data_hora TIMESTAMP,
            status_sessao VARCHAR(20) DEFAULT 'Agendada'
        );
        CREATE TABLE IF NOT EXISTS financeiro (
            id SERIAL PRIMARY KEY,
            paciente_id INTEGER REFERENCES usuarios(id),
            psicologa_id INTEGER REFERENCES usuarios(id),
            data_cobranca DATE,
            valor DECIMAL(10,2),
            status_pagamento VARCHAR(20) DEFAULT 'Pendente'
        );
        CREATE TABLE IF NOT EXISTS mensagens (
            id SERIAL PRIMARY KEY,
            remetente_id INTEGER REFERENCES usuarios(id),
            destinatario_id INTEGER REFERENCES usuarios(id),
            conteudo TEXT,
            data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Força a adição de colunas em tabelas existentes para não dar erro
    colunas_plano = ["exercicios TEXT", "metas TEXT", "recomendacoes TEXT", "psicologa_id INTEGER"]
    for col in colunas_plano:
        try: cur.execute(f"ALTER TABLE planos_de_acao ADD COLUMN IF NOT EXISTS {col};")
        except: pass

    # Cria a conta do administrador se não existir
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'admin';")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO usuarios (nome, email, senha, tipo_perfil, status) VALUES ('Administrador', 'admin@serperene.com', 'admin123', 'admin', 'ativo');")
    
    conn.commit()
    cur.close()
    conn.close()

# ==========================================
# 2. FUNÇÕES AUXILIARES E E-MAIL
# ==========================================
def enviar_email_boas_vindas(destinatario, nome_paciente):
    remetente = os.getenv("EMAIL_CLINICA", "nao-configurado")
    senha = os.getenv("SENHA_EMAIL_CLINICA", "nao-configurado")
    if remetente == "nao-configurado": return
    
    msg = MIMEMultipart()
    msg['From'] = remetente
    msg['To'] = destinatario
    msg['Subject'] = "Bem-vindo(a) à Ser Perene - Cadastro em Análise"
    corpo = f"Olá, {nome_paciente}!\n\nRecebemos sua solicitação de cadastro. Seu perfil está em análise pela nossa equipe. Assim que for aprovado, você poderá acessar o aplicativo."
    msg.attach(MIMEText(corpo, 'plain'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(remetente, senha)
        server.sendmail(remetente, destinatario, msg.as_string())
        server.quit()
    except Exception as e: print(f"Erro ao enviar e-mail: {e}")

# ==========================================
# 3. FRONT-END (HTML + CSS RAIZ)
# ==========================================
TEMPLATE_UNICO = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ser Perene - {{ titulo }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Georgia', serif; }
        body { background-color: #F4EBE9; color: #3A261D; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        header { width: 100%; background-color: #E8D5D0; padding: 20px; text-align: center; border-bottom: 2px solid #3A261D; }
        header h1 { font-size: 2.5rem; letter-spacing: 2px; font-weight: normal; }
        .container { width: 90%; max-width: 800px; margin: 40px auto; }
        .card { background-color: #FFFFFF; border-radius: 12px; padding: 30px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(58, 38, 29, 0.1); border-left: 6px solid #3A261D; }
        .card h2 { margin-bottom: 15px; font-size: 1.5rem; border-bottom: 1px solid #E8D5D0; padding-bottom: 10px; }
        .card h3 { font-size: 1.1rem; margin-top: 15px; margin-bottom: 5px; color: #5c3e30;}
        p, li { font-family: 'Arial', sans-serif; line-height: 1.6; font-size: 0.95rem; margin-bottom: 10px;}
        ul { margin-left: 20px; margin-bottom: 15px; }
        label { font-family: 'Arial', sans-serif; font-weight: bold; font-size: 0.9rem; display: block; margin-top: 12px; }
        input[type="text"], input[type="email"], input[type="password"], input[type="date"], input[type="number"], select, textarea { width: 100%; padding: 12px; margin: 6px 0 16px 0; border: 1px solid #E8D5D0; border-radius: 6px; background-color: #F4EBE9; color: #3A261D; font-family: 'Arial', sans-serif; }
        textarea { resize: vertical; min-height: 80px; }
        .btn { display: inline-block; background-color: #3A261D; color: #E8D5D0; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; border: none; cursor: pointer; transition: background 0.3s; font-family: 'Arial', sans-serif; }
        .btn:hover { background-color: #5c3e30; }
        .btn-small { padding: 6px 12px; font-size: 0.8rem; }
        .btn-outline { background-color: transparent; color: #3A261D; border: 1px solid #3A261D; }
        .sucesso { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial', sans-serif; }
        .erro { background-color: #ffcccc; color: #990000; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial', sans-serif; font-size: 0.9rem;}
        .alerta { background-color: #E8D5D0; color: #3A261D; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; border: 1px dashed #3A261D; font-family: 'Arial', sans-serif; }
        .mensagem-box { background-color: #F9F4F3; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #E8D5D0; }
        .data-msg { font-size: 0.75rem; color: #888; display: block; margin-top: 5px; }
        .link-cadastro { display: block; text-align: center; margin-top: 20px; font-family: 'Arial', sans-serif; color: #3A261D; text-decoration: none; font-size: 0.9rem; }
        .link-cadastro:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <header><h1>serperene *</h1></header>
    <div class="container">{{ conteudo | safe }}</div>
</body>
</html>
"""

# ==========================================
# 4. ROTAS E LÓGICA DO APLICATIVO
# ==========================================

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT id, tipo_perfil, status FROM usuarios WHERE email = %s AND senha = %s LIMIT 1;", (request.form.get('email'), request.form.get('senha')))
            user = cur.fetchone()
            cur.close(); conn.close()
            
            if user:
                if user[2] == 'pendente': 
                    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo="<div class='erro' style='max-width: 400px; margin: 0 auto;'>Seu cadastro ainda está em análise pela clínica.</div>")
                if user[1] == 'paciente': return redirect(url_for('area_paciente', user_id=user[0]))
                if user[1] == 'psicologa': return redirect(url_for('area_psicologa', user_id=user[0]))
                if user[1] == 'admin': return redirect(url_for('area_admin'))
            else:
                return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo="<div class='erro' style='max-width: 400px; margin: 0 auto;'>E-mail ou senha incorretos.</div>")

    conteudo_html = """
    <div class="card" style="max-width: 400px; margin: 0 auto;">
        <h2 style="text-align: center;">Acesso</h2>
        <form method="POST">
            <label>E-mail</label><input type="email" name="email" required>
            <label>Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn" style="width: 100%;">Entrar</button>
        </form>
        <a href="/cadastro" class="link-cadastro">Ainda não tem cadastro? <strong>Solicite acesso aqui.</strong></a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo=conteudo_html)

@app.route('/cadastro', methods=['GET', 'POST'])
def cadastro():
    if request.method == 'POST':
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            try:
                cur.execute("INSERT INTO usuarios (nome, cpf, email, contato, senha, tipo_perfil, status) VALUES (%s, %s, %s, %s, %s, 'paciente', 'pendente');", 
                            (request.form.get('nome'), request.form.get('cpf'), request.form.get('email'), request.form.get('contato'), request.form.get('senha')))
                conn.commit()
                enviar_email_boas_vindas(request.form.get('email'), request.form.get('nome'))
                return redirect('/')
            except: 
                conn.rollback()
                return render_template_string(TEMPLATE_UNICO, titulo="Cadastro", conteudo="<div class='erro' style='max-width: 500px; margin: 0 auto;'>Erro: CPF ou E-mail já cadastrado.</div>")
            finally: cur.close(); conn.close()
    
    conteudo_html = """
    <div class="card" style="max-width: 500px; margin: 0 auto;">
        <h2 style="text-align: center;">Cadastro de Paciente</h2>
        <form method="POST">
            <label>Nome Completo</label><input type="text" name="nome" required>
            <label>CPF</label><input type="text" name="cpf" required>
            <label>E-mail</label><input type="email" name="email" required>
            <label>Contato</label><input type="text" name="contato" required>
            <label>Crie uma Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn" style="width: 100%;">Solicitar Acesso</button>
        </form>
        <a href="/" class="link-cadastro">Já tem conta? <strong>Faça login aqui.</strong></a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Cadastro", conteudo=conteudo_html)

@app.route('/paciente/<int:user_id>', methods=['GET', 'POST'])
def area_paciente(user_id):
    mensagem_sucesso = ""
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'POST':
        psicologa_id = request.form.get('psicologa_id')
        conteudo = request.form.get('mensagem')
        if psicologa_id and conteudo:
            cur.execute("INSERT INTO mensagens (remetente_id, destinatario_id, conteudo) VALUES (%s, %s, %s);", (user_id, psicologa_id, conteudo))
            conn.commit()
            mensagem_sucesso = "Mensagem enviada com sucesso para a psicóloga!"

    cur.execute("SELECT nome FROM usuarios WHERE id = %s;", (user_id,))
    nome_paciente = cur.fetchone()[0]

    cur.execute("SELECT plano, exercicios, metas, recomendacoes, data_criacao FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC LIMIT 1;", (user_id,))
    plano_atual = cur.fetchone()

    cur.execute("SELECT plano, data_criacao FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC OFFSET 1;", (user_id,))
    historico = cur.fetchall()

    cur.execute("SELECT u.nome, r.mensagem, r.data_criacao FROM recados_gerais r JOIN usuarios u ON r.psicologa_id = u.id ORDER BY r.data_criacao DESC LIMIT 5;")
    recados = cur.fetchall()

    cur.execute("SELECT u.nome, m.conteudo, m.data_envio FROM mensagens m JOIN usuarios u ON m.remetente_id = u.id WHERE m.destinatario_id = %s ORDER BY m.data_envio DESC;", (user_id,))
    mensagens_privadas = cur.fetchall()

    cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'psicologa';")
    lista_psicologas = cur.fetchall()
    options_psi = "".join([f"<option value='{p[0]}'>{p[1]}</option>" for p in lista_psicologas])

    cur.close(); conn.close()

    html_msg = f"<div class='sucesso'>{mensagem_sucesso}</div>" if mensagem_sucesso else ""
    
    if plano_atual:
        html_jornada = f"<h3>Plano da Semana</h3><p>{plano_atual[0]}</p><h3>Exercícios</h3><p>{plano_atual[1] or 'Nenhum'}</p><h3>Metas</h3><p>{plano_atual[2] or 'Nenhuma'}</p><h3>Leituras / Vídeos</h3><p>{plano_atual[3] or 'Nenhum'}</p><span class='data-msg'>Criado em: {plano_atual[4].strftime('%d/%m/%Y')}</span>"
    else:
        html_jornada = "<p>Seu plano de ação ainda não foi cadastrado pela psicóloga.</p>"

    html_historico = "".join([f"<div class='mensagem-box'><p>{h[0]}</p><span class='data-msg'>{h[1].strftime('%d/%m/%Y')}</span></div>" for h in historico]) or "<p>Nenhum histórico.</p>"
    html_clinica = "".join([f"<div class='mensagem-box'><p><strong>{r[0]}:</strong> {r[1]}</p><span class='data-msg'>{r[2].strftime('%d/%m/%Y')}</span></div>" for r in recados]) or "<p>Nenhum aviso geral.</p>"
    html_lembretes = "".join([f"<div class='mensagem-box'><p><strong>{m[0]}:</strong> {m[1]}</p><span class='data-msg'>{m[2].strftime('%d/%m/%Y %H:%M')}</span></div>" for m in mensagens_privadas]) or "<p>Nenhuma mensagem direta.</p>"

    conteudo_html = f"""
    <div class="alerta">Bem-vindo(a), {nome_paciente}!</div>
    {html_msg}

    <div class="card">
        <h2>Minha Jornada</h2>
        <p style="font-style: italic; color: #5c3e30; margin-bottom: 20px;">Acompanhe aqui o seu tratamento.</p>
        {html_jornada}
        <details style="margin-top: 20px; border-top: 1px solid #E8D5D0; padding-top: 15px;">
            <summary style="font-family: Arial; font-weight: bold; cursor: pointer;">Ver Histórico Anterior</summary>
            <div style="margin-top: 15px;">{html_historico}</div>
        </details>
    </div>

    <div class="card">
        <h2>Mensagens da Clínica</h2>
        {html_clinica}
    </div>

    <div class="card">
        <h2>Lembretes da Psicóloga</h2>
        {html_lembretes}
    </div>

    <div class="card">
        <h2>Falar com minha Psicóloga</h2>
        <form method="POST">
            <label>Selecione a Psicóloga</label>
            <select name="psicologa_id" required><option value="">Escolha...</option>{options_psi}</select>
            <label>Sua Mensagem</label>
            <textarea name="mensagem" required></textarea>
            <button type="submit" class="btn" style="width: 100%;">Enviar Mensagem</button>
        </form>
    </div>
    <a href="/" class="btn btn-outline" style="margin-bottom: 30px; width: 100%;">Sair do Aplicativo</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/psicologa/<int:user_id>', methods=['GET', 'POST'])
def area_psicologa(user_id):
    mensagem_sucesso = ""
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'novo_recado':
            cur.execute("INSERT INTO recados_gerais (psicologa_id, mensagem) VALUES (%s, %s);", (user_id, request.form.get('mensagem')))
            mensagem_sucesso = "Recado geral postado!"
        elif acao == 'novo_plano':
            cur.execute("INSERT INTO planos_de_acao (paciente_id, psicologa_id, plano, exercicios, metas, recomendacoes) VALUES (%s, %s, %s, %s, %s, %s);", 
                        (request.form.get('paciente_id'), user_id, request.form.get('plano'), request.form.get('exercicios'), request.form.get('metas'), request.form.get('recomendacoes')))
            mensagem_sucesso = "Plano de ação criado com sucesso!"
        elif acao == 'nova_cobranca':
            cur.execute("INSERT INTO financeiro (paciente_id, psicologa_id, data_cobranca, valor) VALUES (%s, %s, %s, %s);",
                        (request.form.get('paciente_id'), user_id, request.form.get('data_cobranca'), request.form.get('valor')))
            mensagem_sucesso = "Cobrança financeira lançada!"
        conn.commit()

    cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'ativo';")
    pacientes = cur.fetchall()
    options_pacientes = "".join([f"<option value='{p[0]}'>{p[1]}</option>" for p in pacientes])
    cur.close(); conn.close()

    html_msg = f"<div class='sucesso'>{mensagem_sucesso}</div>" if mensagem_sucesso else ""

    conteudo_html = f"""
    {html_msg}
    <div class="card">
        <h2>1. Agenda do Dia</h2><button class="btn btn-outline">+ Agendar Nova Sessão</button>
    </div>
    <div class="card">
        <h2>2. Criar Plano de Ação (Pós-Sessão)</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="novo_plano">
            <label>Selecione o Paciente</label><select name="paciente_id" required><option value="">Escolha...</option>{options_pacientes}</select>
            <label>Plano de Ação Principal</label><textarea name="plano" required></textarea>
            <label>Exercícios Sugeridos</label><textarea name="exercicios"></textarea>
            <label>Metas</label><textarea name="metas"></textarea>
            <label>Recomendações (Vídeos/Livros)</label><textarea name="recomendacoes"></textarea>
            <button type="submit" class="btn" style="width: 100%;">Salvar Plano</button>
        </form>
    </div>
    <div class="card">
        <h2>3. Mural Geral (Para todos)</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="novo_recado">
            <label>Aviso ou Reflexão</label><textarea name="mensagem" required></textarea>
            <button type="submit" class="btn" style="width: 100%;">Postar</button>
        </form>
    </div>
    <div class="card">
        <h2>4. Gestão Financeira</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="nova_cobranca">
            <label>Paciente</label><select name="paciente_id" required><option value="">Escolha...</option>{options_pacientes}</select>
            <label>Data de Cobrança</label><input type="date" name="data_cobranca" required>
            <label>Valor (R$)</label><input type="number" step="0.01" name="valor" required>
            <button type="submit" class="btn btn-outline" style="width: 100%;">Lançar Cobrança</button>
        </form>
    </div>
    <a href="/" class="btn btn-outline" style="width: 100%; margin-bottom: 40px;">Sair do Painel</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

@app.route('/admin', methods=['GET', 'POST'])
def area_admin():
    mensagem = ""
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'nova_psicologa':
            try:
                cur.execute("INSERT INTO usuarios (nome, cpf, email, contato, senha, tipo_perfil, status) VALUES (%s, %s, %s, %s, %s, 'psicologa', 'ativo');", 
                            (request.form.get('nome'), request.form.get('cpf'), request.form.get('email'), request.form.get('contato'), request.form.get('senha')))
                conn.commit()
                mensagem = "Psicóloga cadastrada com sucesso!"
            except:
                conn.rollback()
                mensagem = "Erro: CPF ou E-mail já cadastrado."

    cur.execute("SELECT id, nome, email, contato FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'pendente';")
    pendentes = cur.fetchall()
    
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'ativo';")
    qtd_ativos = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'psicologa';")
    qtd_psi = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM planos_de_acao;")
    qtd_planos = cur.fetchone()[0]

    cur.execute("SELECT nome, email FROM usuarios WHERE tipo_perfil = 'psicologa';")
    psicologas = cur.fetchall()

    cur.execute("SELECT a.data_hora, pac.nome, psi.nome, a.status_sessao FROM agenda a JOIN usuarios pac ON a.paciente_id = pac.id JOIN usuarios psi ON a.psicologa_id = psi.id ORDER BY a.data_hora DESC LIMIT 5;")
    agenda_global = cur.fetchall()

    cur.execute("SELECT f.data_cobranca, pac.nome, f.valor, f.status_pagamento FROM financeiro f JOIN usuarios pac ON f.paciente_id = pac.id ORDER BY f.data_cobranca DESC LIMIT 5;")
    financeiro_global = cur.fetchall()

    cur.close(); conn.close()

    html_msg = f"<div class='sucesso'>{mensagem}</div>" if mensagem else ""
    html_pendentes = "".join([f"<div style='border-bottom: 1px solid #E8D5D0; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;'><div><strong>{p[1]}</strong><br><span style='font-size: 0.8rem; font-family: Arial;'>{p[2]} | {p[3]}</span></div><a href='/aprovar/{p[0]}' class='btn btn-small'>Aprovar</a></div>" for p in pendentes]) or "<p>Nenhum paciente aguardando.</p>"
    html_psicologas = "".join([f"<li><strong>{psi[0]}</strong> ({psi[1]})</li>" for psi in psicologas]) or "<p>Nenhuma psicóloga cadastrada.</p>"
    html_agenda = "".join([f"<div class='mensagem-box'><p><strong>{ag[0].strftime('%d/%m/%Y %H:%M') if ag[0] else 'S/D'}</strong> - {ag[1]} com {ag[2]} <span style='float:right; color:#5c3e30;'>[{ag[3]}]</span></p></div>" for ag in agenda_global]) or "<p>Nenhuma sessão registrada.</p>"
    html_financeiro = "".join([f"<div class='mensagem-box'><p><strong>{fin[0].strftime('%d/%m/%Y') if fin[0] else 'S/D'}</strong> - {fin[1]} <span style='float:right; font-weight: bold;'>R$ {fin[2]} [{fin[3]}]</span></p></div>" for fin in financeiro_global]) or "<p>Nenhuma cobrança lançada.</p>"

    conteudo_html = f"""
    <div class="alerta">Área Administrativa — Gestão Completa</div>
    {html_msg}
    
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div class="card" style="flex: 1; min-width: 300px;">
            <h2>Aprovações Pendentes</h2>{html_pendentes}
        </div>
        <div class="card" style="flex: 1; min-width: 300px;">
            <h2>Relatório Rápido</h2>
            <ul>
                <li>📈 <strong>Ativos:</strong> {qtd_ativos}</li>
                <li>👩‍⚕️ <strong>Psicólogas:</strong> {qtd_psi}</li>
                <li>📋 <strong>Planos:</strong> {qtd_planos}</li>
            </ul>
        </div>
    </div>

    <div class="card"><h2>Agenda Global</h2>{html_agenda}</div>
    <div class="card"><h2>Financeiro Global</h2>{html_financeiro}</div>

    <div class="card" style="background-color: #fcf9f8;">
        <h2>Cadastrar Psicóloga</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="nova_psicologa">
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;"><label>Nome</label><input type="text" name="nome" required></div>
                <div style="flex: 1; min-width: 150px;"><label>CPF</label><input type="text" name="cpf" required></div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;"><label>E-mail Corporativo</label><input type="email" name="email" required></div>
                <div style="flex: 1; min-width: 150px;"><label>Contato</label><input type="text" name="contato" required></div>
            </div>
            <label>Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Adicionar à Equipe</button>
        </form>
        <h3 style="margin-top: 20px; border-top: 1px solid #E8D5D0; padding-top: 15px;">Equipe Atual:</h3>
        <ul>{html_psicologas}</ul>
    </div>
    <a href="/" class="btn btn-outline" style="margin-bottom: 40px; width: 100%;">Sair do Admin</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Admin", conteudo=conteudo_html)

@app.route('/aprovar/<int:user_id>')
def aprovar_usuario(user_id):
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute("UPDATE usuarios SET status = 'ativo' WHERE id = %s;", (user_id,))
        conn.commit()
        cur.close(); conn.close()
    return redirect(url_for('area_admin'))

if __name__ == '__main__':
    iniciar_banco()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
