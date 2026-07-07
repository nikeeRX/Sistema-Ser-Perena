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
    
    # Criação das tabelas base e módulos
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
    
    # Força atualização caso já existam tabelas
    colunas_plano = ["exercicios TEXT", "metas TEXT", "recomendacoes TEXT", "psicologa_id INTEGER"]
    for col in colunas_plano:
        try: cur.execute(f"ALTER TABLE planos_de_acao ADD COLUMN IF NOT EXISTS {col};")
        except: pass

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
    corpo = f"Olá, {nome_paciente}!\n\nRecebemos sua solicitação de cadastro. Seu perfil está em análise pela nossa equipe."
    msg.attach(MIMEText(corpo, 'plain'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(remetente, senha)
        server.sendmail(remetente, destinatario, msg.as_string())
        server.quit()
    except Exception as e: print(f"Erro e-mail: {e}")

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
        .btn-outline { background-color: transparent; color: #3A261D; border: 1px solid #3A261D; }
        .sucesso { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial', sans-serif; }
        .alerta { background-color: #E8D5D0; color: #3A261D; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; border: 1px dashed #3A261D; font-family: 'Arial', sans-serif; }
        .mensagem-box { background-color: #F9F4F3; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #E8D5D0; }
        .data-msg { font-size: 0.75rem; color: #888; display: block; margin-top: 5px; }
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
                if user[2] == 'pendente': return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo="<div class='alerta' style='max-width: 400px; margin: 0 auto;'>Cadastro em análise pela clínica.</div>")
                if user[1] == 'paciente': return redirect(url_for('area_paciente', user_id=user[0]))
                if user[1] == 'psicologa': return redirect(url_for('area_psicologa', user_id=user[0]))
                if user[1] == 'admin': return redirect(url_for('area_admin'))

    conteudo_html = """
    <div class="card" style="max-width: 400px; margin: 0 auto;">
        <h2 style="text-align: center;">Acesso</h2>
        <form method="POST">
            <label>E-mail</label><input type="email" name="email" required>
            <label>Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn" style="width: 100%;">Entrar</button>
        </form>
        <a href="/cadastro" style="display: block; text-align: center; margin-top: 15px; color:#3A261D; font-family: 'Arial';">Solicitar Acesso</a>
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
            except: conn.rollback()
            finally: cur.close(); conn.close()
    
    conteudo_html = """
    <div class="card" style="max-width: 500px; margin: 0 auto;">
        <h2>Cadastro de Paciente</h2>
        <form method="POST">
            <label>Nome</label><input type="text" name="nome" required>
            <label>CPF</label><input type="text" name="cpf" required>
            <label>E-mail</label><input type="email" name="email" required>
            <label>Contato</label><input type="text" name="contato" required>
            <label>Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn" style="width: 100%;">Solicitar</button>
        </form>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Cadastro", conteudo=conteudo_html)

@app.route('/psicologa/<int:user_id>', methods=['GET', 'POST'])
def area_psicologa(user_id):
    # Rota mantida conforme a última atualização
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'novo_recado':
            cur.execute("INSERT INTO recados_gerais (psicologa_id, mensagem) VALUES (%s, %s);", (user_id, request.form.get('mensagem')))
        elif acao == 'novo_plano':
            cur.execute("INSERT INTO planos_de_acao (paciente_id, psicologa_id, plano, exercicios, metas, recomendacoes) VALUES (%s, %s, %s, %s, %s, %s);", 
                        (request.form.get('paciente_id'), user_id, request.form.get('plano'), request.form.get('exercicios'), request.form.get('metas'), request.form.get('recomendacoes')))
        conn.commit()
    cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'ativo';")
    pacientes = cur.fetchall()
    options_pacientes = "".join([f"<option value='{p[0]}'>{p[1]}</option>" for p in pacientes])
    cur.close(); conn.close()

    conteudo_html = f"""
    <div class="card">
        <h2>1. Agenda do Dia</h2><button class="btn btn-outline">+ Agendar Nova Sessão</button>
    </div>
    <div class="card">
        <h2>2. Criar Plano de Ação (Pós-Sessão)</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="novo_plano">
            <label>Selecione o Paciente</label><select name="paciente_id" required><option value="">Escolha...</option>{options_pacientes}</select>
            <label>Plano de Ação - Individual</label><textarea name="plano" required></textarea>
            <label>Exercícios Sugeridos</label><textarea name="exercicios"></textarea>
            <label>Metas</label><textarea name="metas"></textarea>
            <label>Recomendações</label><textarea name="recomendacoes"></textarea>
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Salvar Plano</button>
        </form>
    </div>
    <div class="card">
        <h2>3. Mural Geral</h2>
        <form method="POST">
            <input type="hidden" name="acao" value="novo_recado">
            <label>Escreva a reflexão ou aviso</label><textarea name="mensagem" required></textarea>
            <button type="submit" class="btn" style="width: 100%;">Postar</button>
        </form>
    </div>
    <a href="/" class="btn btn-outline">Sair do Painel</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

# ==========================================
# ÁREA DO PACIENTE (NOVA IMPLEMENTAÇÃO)
# ==========================================
@app.route('/paciente/<int:user_id>', methods=['GET', 'POST'])
def area_paciente(user_id):
    mensagem_sucesso = ""
    conn = get_db_connection()
    cur = conn.cursor()

    # Se o paciente enviou uma mensagem para a psicóloga
    if request.method == 'POST':
        psicologa_id = request.form.get('psicologa_id')
        conteudo = request.form.get('mensagem')
        if psicologa_id and conteudo:
            cur.execute("INSERT INTO mensagens (remetente_id, destinatario_id, conteudo) VALUES (%s, %s, %s);", (user_id, psicologa_id, conteudo))
            conn.commit()
            mensagem_sucesso = "Mensagem enviada com sucesso para a psicóloga!"

    # 1. Puxar nome do paciente
    cur.execute("SELECT nome FROM usuarios WHERE id = %s;", (user_id,))
    nome_paciente = cur.fetchone()[0]

    # 2. Puxar o plano de ação mais recente (Minha Jornada)
    cur.execute("SELECT plano, exercicios, metas, recomendacoes, data_criacao FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC LIMIT 1;", (user_id,))
    plano_atual = cur.fetchone()

    # 3. Puxar histórico de planos (ignorando o atual)
    cur.execute("SELECT plano, data_criacao FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC OFFSET 1;", (user_id,))
    historico = cur.fetchall()

    # 4. Puxar Mensagens da Clínica (Mural Geral)
    cur.execute("""
        SELECT u.nome, r.mensagem, r.data_criacao 
        FROM recados_gerais r JOIN usuarios u ON r.psicologa_id = u.id 
        ORDER BY r.data_criacao DESC LIMIT 5;
    """)
    recados = cur.fetchall()

    # 5. Puxar Lembretes Exclusivos (Mensagens da Psicóloga para o Paciente)
    cur.execute("""
        SELECT u.nome, m.conteudo, m.data_envio 
        FROM mensagens m JOIN usuarios u ON m.remetente_id = u.id 
        WHERE m.destinatario_id = %s ORDER BY m.data_envio DESC;
    """, (user_id,))
    mensagens_privadas = cur.fetchall()

    # 6. Lista de psicólogas para o formulário de envio de mensagem
    cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'psicologa';")
    lista_psicologas = cur.fetchall()
    options_psi = "".join([f"<option value='{p[0]}'>{p[1]}</option>" for p in lista_psicologas])

    cur.close(); conn.close()

    # --- Renderização HTML Dinâmica ---
    html_msg = f"<div class='sucesso'>{mensagem_sucesso}</div>" if mensagem_sucesso else ""
    
    # Renderizar Minha Jornada
    if plano_atual:
        html_jornada = f"""
            <h3>Plano da Semana</h3>
            <p>{plano_atual[0]}</p>
            <h3>Exercícios</h3>
            <p>{plano_atual[1] or 'Nenhum exercício sugerido.'}</p>
            <h3>Metas</h3>
            <p>{plano_atual[2] or 'Nenhuma meta registrada.'}</p>
            <h3>Leituras / Vídeos</h3>
            <p>{plano_atual[3] or 'Nenhuma recomendação no momento.'}</p>
            <span class="data-msg">Criado em: {plano_atual[4].strftime('%d/%m/%Y')}</span>
        """
    else:
        html_jornada = "<p>Seu plano de ação ainda não foi cadastrado pela psicóloga.</p>"

    # Renderizar Histórico
    html_historico = "".join([f"<div class='mensagem-box'><p>{h[0]}</p><span class='data-msg'>{h[1].strftime('%d/%m/%Y')}</span></div>" for h in historico]) or "<p>Nenhum histórico anterior.</p>"

    # Renderizar Mensagens da Clínica
    html_clinica = "".join([f"<div class='mensagem-box'><p><strong>{r[0]}:</strong> {r[1]}</p><span class='data-msg'>{r[2].strftime('%d/%m/%Y')}</span></div>" for r in recados]) or "<p>Nenhum aviso geral.</p>"

    # Renderizar Mensagens da Psicóloga
    html_lembretes = "".join([f"<div class='mensagem-box'><p><strong>{m[0]}:</strong> {m[1]}</p><span class='data-msg'>{m[2].strftime('%d/%m/%Y às %H:%M')}</span></div>" for m in mensagens_privadas]) or "<p>Nenhuma mensagem direta da sua psicóloga.</p>"

    conteudo_html = f"""
    <div class="alerta">Bem-vindo(a), {nome_paciente}! Você tem uma sessão agendada para amanhã.</div>
    {html_msg}

    <div class="card">
        <h2>Minha Jornada</h2>
        <p style="font-style: italic; color: #5c3e30; margin-bottom: 20px;">Acompanhe aqui o seu tratamento.</p>
        {html_jornada}
        
        <details style="margin-top: 20px; border-top: 1px solid #E8D5D0; padding-top: 15px;">
            <summary style="font-family: Arial; font-weight: bold; cursor: pointer;">Ver Histórico de Planos Anteriores</summary>
            <div style="margin-top: 15px;">{html_historico}</div>
        </details>
    </div>

    <div class="card">
        <h2>Mensagens da Clínica</h2>
        <p style="font-style: italic; color: #5c3e30;">Reflexões, avisos e campanhas.</p>
        {html_clinica}
    </div>

    <div class="card">
        <h2>Lembretes da Psicóloga</h2>
        <p style="font-style: italic; color: #5c3e30;">Mensagens exclusivas para você.</p>
        {html_lembretes}
    </div>

    <div class="card">
        <h2>Falar com minha Psicóloga</h2>
        <p style="font-style: italic; color: #5c3e30; margin-bottom: 10px;">Ex: "Consegui realizar a tarefa" ou "Preciso remarcar".</p>
        <form method="POST">
            <label>Selecione a Psicóloga</label>
            <select name="psicologa_id" required>
                <option value="">Escolha com quem quer falar...</option>
                {options_psi}
            </select>
            <label>Sua Mensagem</label>
            <textarea name="mensagem" placeholder="Escreva sua mensagem aqui..." required></textarea>
            <button type="submit" class="btn" style="width: 100%;">Enviar Mensagem</button>
        </form>
    </div>

    <a href="/" class="btn btn-outline" style="margin-bottom: 30px;">Sair do Aplicativo</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/admin')
def area_admin():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nome, email, contato FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'pendente';")
    pendentes = cur.fetchall()
    html_pendentes = "".join([f"<div style='border-bottom: 1px solid #E8D5D0; padding: 10px 0;'><strong>{p[1]}</strong><br><a href='/aprovar/{p[0]}' class='btn' style='padding: 5px 10px; font-size: 0.8rem;'>Aprovar</a></div>" for p in pendentes]) or "<p>Nenhum paciente pendente.</p>"
    cur.close(); conn.close()
    return render_template_string(TEMPLATE_UNICO, titulo="Admin", conteudo=f"<div class='card'><h2>Pacientes Pendentes</h2>{html_pendentes}</div><a href='/' class='btn btn-outline'>Sair</a>")

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
