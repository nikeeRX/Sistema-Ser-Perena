import os
import smtplib
import psycopg2
import base64
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
        print(f"Erro ao conectar: {e}")
        return None

def iniciar_banco():
    conn = get_db_connection()
    if conn is None: return
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, cpf VARCHAR(14) UNIQUE,
            email VARCHAR(100) UNIQUE, contato VARCHAR(20), senha VARCHAR(100),
            tipo_perfil VARCHAR(50) NOT NULL, status VARCHAR(20) DEFAULT 'pendente'
        );
        CREATE TABLE IF NOT EXISTS planos_de_acao (
            id SERIAL PRIMARY KEY, paciente_id INTEGER REFERENCES usuarios(id),
            psicologa_id INTEGER REFERENCES usuarios(id), plano TEXT, exercicios TEXT,
            metas TEXT, recomendacoes TEXT, data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS recados_gerais (
            id SERIAL PRIMARY KEY, autor_id INTEGER REFERENCES usuarios(id),
            tipo VARCHAR(50) DEFAULT 'Aviso', mensagem TEXT, data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agenda (
            id SERIAL PRIMARY KEY, psicologa_id INTEGER REFERENCES usuarios(id),
            paciente_id INTEGER REFERENCES usuarios(id), data_hora TIMESTAMP,
            status_sessao VARCHAR(20) DEFAULT 'Agendada'
        );
        CREATE TABLE IF NOT EXISTS financeiro (
            id SERIAL PRIMARY KEY, paciente_id INTEGER REFERENCES usuarios(id),
            psicologa_id INTEGER REFERENCES usuarios(id), data_cobranca DATE,
            valor DECIMAL(10,2), status_pagamento VARCHAR(20) DEFAULT 'Pendente'
        );
        CREATE TABLE IF NOT EXISTS mensagens (
            id SERIAL PRIMARY KEY, remetente_id INTEGER REFERENCES usuarios(id),
            destinatario_id INTEGER REFERENCES usuarios(id), conteudo TEXT,
            data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS notificacoes_popup (
            id SERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id),
            mensagem TEXT, lida BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS diario_emocional (
            id SERIAL PRIMARY KEY, paciente_id INTEGER REFERENCES usuarios(id),
            humor VARCHAR(50), nota_texto TEXT, data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    colunas_novas = ["crp VARCHAR(50)", "foto TEXT", "psicologa_id INTEGER REFERENCES usuarios(id)"]
    for col in colunas_novas:
        try: cur.execute(f"ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS {col};")
        except: pass

    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'admin';")
    if cur.fetchone()[0] == 0:
        cur.execute("INSERT INTO usuarios (nome, email, senha, tipo_perfil, status) VALUES ('Administrador', 'admin@serperene.com', 'admin123', 'admin', 'ativo');")
    
    conn.commit()
    cur.close(); conn.close()

# ==========================================
# 2. SISTEMA DE E-MAIL
# ==========================================
def enviar_email_boas_vindas(destinatario, nome_paciente):
    remetente = os.getenv("EMAIL_CLINICA", "nao-configurado")
    senha = os.getenv("SENHA_EMAIL_CLINICA", "nao-configurado")
    if remetente == "nao-configurado": return
    
    msg = MIMEMultipart()
    msg['From'] = remetente
    msg['To'] = destinatario
    msg['Subject'] = "Bem-vindo(a) à Ser Perene"
    msg.attach(MIMEText(f"Olá, {nome_paciente}!\n\nSeu cadastro foi recebido com sucesso e está em análise. Você receberá um aviso assim que for liberado.", 'plain'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(remetente, senha)
        server.sendmail(remetente, destinatario, msg.as_string())
        server.quit()
    except Exception as e: print(e)

# ==========================================
# 3. FRONT-END HTML BASE
# ==========================================
TEMPLATE_UNICO = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ser Perene - {{ titulo }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Georgia', serif; }
        body { background-color: #F4EBE9; color: #3A261D; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        header { width: 100%; background-color: #E8D5D0; padding: 20px; text-align: center; border-bottom: 2px solid #3A261D; }
        header h1 { font-size: 2.5rem; font-weight: normal; }
        .container { width: 90%; max-width: 800px; margin: 40px auto; }
        .card { background-color: #FFFFFF; border-radius: 12px; padding: 30px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(58, 38, 29, 0.1); border-left: 6px solid #3A261D; }
        .card h2 { margin-bottom: 15px; font-size: 1.5rem; border-bottom: 1px solid #E8D5D0; padding-bottom: 10px; }
        .card h3 { font-size: 1.1rem; margin-top: 15px; margin-bottom: 5px; color: #5c3e30;}
        p, li { font-family: 'Arial', sans-serif; line-height: 1.6; font-size: 0.95rem; margin-bottom: 10px;}
        label { font-family: 'Arial', sans-serif; font-weight: bold; font-size: 0.9rem; display: block; margin-top: 12px; }
        input, select, textarea { width: 100%; padding: 12px; margin: 6px 0 16px 0; border: 1px solid #E8D5D0; border-radius: 6px; background-color: #F4EBE9; font-family: 'Arial', sans-serif; }
        .btn { display: inline-block; background-color: #3A261D; color: #E8D5D0; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; border: none; cursor: pointer; transition: 0.3s; width: 100%; font-family: 'Arial'; }
        .btn-outline { background-color: transparent; color: #3A261D; border: 1px solid #3A261D; }
        .btn-small { padding: 6px 12px; font-size: 0.8rem; width: auto; }
        .sucesso { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial'; }
        .erro { background-color: #ffcccc; color: #990000; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial'; }
        .alerta { background-color: #E8D5D0; color: #3A261D; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; font-family: 'Arial'; }
        .mensagem-box { background-color: #F9F4F3; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #E8D5D0; }
        .data-msg { font-size: 0.75rem; color: #888; display: block; margin-top: 5px; font-family: 'Arial'; }
        .foto-perfil { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 10px; border: 2px solid #3A261D; }
        .link-cadastro { display: block; text-align: center; margin-top: 20px; font-family: 'Arial', sans-serif; color: #3A261D; text-decoration: none; font-size: 0.9rem; }
        .link-cadastro:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <header><h1>serperene *</h1></header>
    <div class="container">{{ conteudo | safe }}</div>
    {{ script_popup | safe }}
</body>
</html>
"""

# ==========================================
# 4. ROTAS DO APLICATIVO
# ==========================================

@app.route('/')
def index():
    html = """
    <div class="card" style="max-width: 450px; margin: 0 auto; text-align: center;">
        <h2 style="border: none;">Bem-vindo(a) à Clínica</h2>
        <p style="margin-bottom: 25px; font-style: italic; color: #5c3e30;">Selecione o seu perfil para acessar o sistema:</p>
        
        <a href="/login/paciente" class="btn" style="margin-bottom: 15px; padding: 15px; font-size: 1.1rem;">Sou Paciente</a>
        <a href="/login/psicologa" class="btn" style="margin-bottom: 25px; padding: 15px; font-size: 1.1rem; background-color: #5c3e30;">Sou Psicóloga</a>
        
        <hr style="border: 0; height: 1px; background-color: #E8D5D0; margin-bottom: 20px;">
        <a href="/login/admin" class="btn btn-outline">Acesso Administrativo</a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Início", conteudo=html, script_popup="")

@app.route('/login/<perfil>', methods=['GET', 'POST'])
def login(perfil):
    if perfil not in ['paciente', 'psicologa', 'admin']: return redirect('/')
    
    msg_erro = ""
    if request.method == 'POST':
        conn = get_db_connection()
        cur = conn.cursor()
        # Verifica se o email e senha batem, e se o perfil tentado é o perfil real dele
        cur.execute("SELECT id, tipo_perfil, status FROM usuarios WHERE email=%s AND senha=%s AND tipo_perfil=%s LIMIT 1;", 
                    (request.form.get('email'), request.form.get('senha'), perfil))
        user = cur.fetchone()
        cur.close(); conn.close()
        
        if user:
            if user[2] == 'pendente': 
                msg_erro = "Seu cadastro está em análise pela clínica. Aguarde a liberação."
            else:
                return redirect(url_for(f"area_{user[1]}", user_id=user[0]) if user[1] != 'admin' else url_for('area_admin'))
        else:
            msg_erro = "E-mail ou senha incorretos, ou perfil inválido."

    html_erro = f"<div class='erro'>{msg_erro}</div>" if msg_erro else ""
    
    # Renderiza o link de cadastro de acordo com o perfil da página
    link_cad = ""
    if perfil == 'paciente':
        link_cad = f'<a href="/cadastro/paciente" class="link-cadastro">Primeiro acesso? <strong>Cadastre-se como Paciente aqui.</strong></a>'
    elif perfil == 'psicologa':
        link_cad = f'<a href="/cadastro/psicologa" class="link-cadastro">Quer fazer parte da equipe? <strong>Solicite seu acesso aqui.</strong></a>'

    titulo_display = perfil.capitalize()
    html = f"""
    <div class="card" style="max-width: 400px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0; border:none;">Login - {titulo_display}</h2>
            <a href="/" style="color:#5c3e30; text-decoration:none; font-family:Arial; font-size:0.9rem;">Voltar</a>
        </div>
        <hr style="border: 0; height: 1px; background-color: #E8D5D0; margin: 15px 0;">
        {html_erro}
        <form method="POST">
            <label>E-mail</label><input type="email" name="email" required>
            <label>Senha</label><input type="password" name="senha" required>
            <button type="submit" class="btn">Entrar na Conta</button>
        </form>
        {link_cad}
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo=f"Login {titulo_display}", conteudo=html, script_popup="")

@app.route('/cadastro/<perfil>', methods=['GET', 'POST'])
def cadastro(perfil):
    if perfil not in ['paciente', 'psicologa']: return redirect('/')
    
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'POST':
        foto_b64 = None
        if 'foto' in request.files:
            foto_file = request.files['foto']
            if foto_file.filename != '':
                foto_b64 = base64.b64encode(foto_file.read()).decode('utf-8')

        psi_id = request.form.get('psicologa_id')
        psi_id = psi_id if psi_id and psi_id.strip() != "" else None

        try:
            cur.execute("""
                INSERT INTO usuarios (nome, cpf, email, contato, senha, tipo_perfil, status, crp, foto, psicologa_id) 
                VALUES (%s,%s,%s,%s,%s,%s,'pendente',%s,%s,%s);
            """, (
                request.form.get('nome'), request.form.get('cpf'), request.form.get('email'), 
                request.form.get('contato'), request.form.get('senha'), perfil,
                request.form.get('crp'), foto_b64, psi_id
            ))
            conn.commit()
            enviar_email_boas_vindas(request.form.get('email'), request.form.get('nome'))
            return redirect('/')
        except Exception as e: 
            conn.rollback()
            return render_template_string(TEMPLATE_UNICO, titulo="Cadastro", conteudo="<div class='erro'>Erro: CPF ou E-mail já cadastrados.</div>", script_popup="")
        finally: cur.close(); conn.close()
    
    # Formulários Condicionais
    campos_extras = ""
    if perfil == 'paciente':
        cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'psicologa' AND status = 'ativo';")
        options_psi = "".join([f"<option value='{p[0]}'>Dra. {p[1]}</option>" for p in cur.fetchall()])
        campos_extras = f"""
            <label>Sua Psicóloga (Opcional)</label>
            <select name="psicologa_id">
                <option value="">Ainda não tenho / Não sei</option>
                {options_psi}
            </select>
        """
    elif perfil == 'psicologa':
        campos_extras = """
            <div style="background-color: #F9F4F3; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin-top:0; color:#3A261D;">Dados Profissionais</h3>
                <label>Registro CRP</label>
                <input type="text" name="crp" placeholder="Ex: 00/00000" required>
                <label>Foto de Perfil</label>
                <input type="file" name="foto" accept="image/*">
            </div>
        """
    
    cur.close(); conn.close()

    html = f"""
    <div class="card" style="max-width: 500px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0; border:none;">Cadastro - {perfil.capitalize()}</h2>
            <a href="/login/{perfil}" style="color:#5c3e30; text-decoration:none; font-family:Arial; font-size:0.9rem;">Voltar</a>
        </div>
        <hr style="border: 0; height: 1px; background-color: #E8D5D0; margin: 15px 0;">
        
        <form method="POST" enctype="multipart/form-data">
            <label>Nome Completo</label><input type="text" name="nome" required>
            <label>CPF</label><input type="text" name="cpf" required>
            <label>E-mail</label><input type="email" name="email" required>
            <label>Contato (WhatsApp)</label><input type="text" name="contato" required>
            <label>Crie uma Senha</label><input type="password" name="senha" required>
            
            {campos_extras}

            <button type="submit" class="btn" style="margin-top: 10px;">Solicitar Aprovação</button>
        </form>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo=f"Cadastro {perfil.capitalize()}", conteudo=html, script_popup="")

@app.route('/admin', methods=['GET', 'POST'])
def area_admin():
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'campanha':
            cur.execute("INSERT INTO recados_gerais (autor_id, tipo, mensagem) VALUES ((SELECT id FROM usuarios WHERE tipo_perfil='admin' LIMIT 1), 'Campanha', %s);", (request.form.get('mensagem'),))
            conn.commit()

    # Busca cadastros pendentes mostrando explicitamente o que pediram
    cur.execute("SELECT id, nome, email, contato, tipo_perfil, crp FROM usuarios WHERE status = 'pendente';")
    pendentes = cur.fetchall()
    
    html_pendentes = ""
    for p in pendentes:
        txt_crp = f" | CRP: {p[5]}" if p[4] == 'psicologa' and p[5] else ""
        html_pendentes += f"""
        <div style='border-bottom: 1px solid #E8D5D0; padding: 15px 0; display: flex; justify-content: space-between; align-items: center;'>
            <div>
                <strong>{p[1]}</strong><br>
                <span style='font-size: 0.85rem; font-family: Arial; color: #5c3e30; font-weight: bold;'>Solicitou acesso como: {p[4].capitalize()}</span><br>
                <span style='font-size: 0.8rem; font-family: Arial;'>{p[2]} | {p[3]}{txt_crp}</span>
            </div>
            <a href='/aprovar/{p[0]}' class='btn btn-small'>Aprovar Cadastro</a>
        </div>
        """
    if not html_pendentes: html_pendentes = "<p>Nenhum cadastro aguardando aprovação no momento.</p>"

    # Lista de Psicólogas Ativas com Foto
    cur.execute("SELECT nome, email, crp, foto FROM usuarios WHERE tipo_perfil = 'psicologa' AND status = 'ativo';")
    psicologas = cur.fetchall()
    html_psis = ""
    for psi in psicologas:
        img_tag = f"<img src='data:image/jpeg;base64,{psi[3]}' class='foto-perfil'>" if psi[3] else "<div class='foto-perfil' style='display:inline-block; background:#E8D5D0;'></div>"
        crp_txt = f"CRP: {psi[2]}" if psi[2] else "CRP: Não informado"
        html_psis += f"<li style='display:flex; align-items:center; margin-bottom:15px;'>{img_tag} <div><strong>Dra. {psi[0]}</strong><br><span style='font-size:0.8rem;'>{psi[1]} | {crp_txt}</span></div></li>"

    cur.close(); conn.close()

    html = f"""
    <div class="alerta">Painel Administrativo Mestre</div>
    
    <div class="card">
        <h2>Aprovações Pendentes</h2>
        <p style="font-family:Arial; font-size:0.9rem; color:#5c3e30;">Libere o acesso dos pacientes e psicólogas que se cadastraram no sistema.</p>
        {html_pendentes}
    </div>

    <div class="card">
        <h2>Corpo Clínico (Psicólogas Ativas)</h2>
        <ul style="list-style:none; margin:0;">
            {html_psis or '<p>Nenhuma psicóloga ativa na equipe.</p>'}
        </ul>
    </div>
    
    <div class="card">
        <h2>Atalhos de Gestão e Comunicação</h2>
        <form method="POST" style="margin-bottom: 20px;"><input type="hidden" name="acao" value="campanha">
            <label>Disparar mensagem/campanha para toda a clínica:</label>
            <textarea name="mensagem" required></textarea>
            <button type="submit" class="btn">Publicar Campanha Geral</button>
        </form>
        <div style="display:flex; gap:10px; flex-wrap: wrap;">
            <button class="btn btn-outline" style="flex:1; min-width: 200px;">Ver Financeiro</button>
            <button class="btn btn-outline" style="flex:1; min-width: 200px;">Ver Agenda Global</button>
        </div>
    </div>

    <a href="/" class="btn btn-outline" style="margin-bottom:30px;">Sair do Painel Admin</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Admin", conteudo=html, script_popup="")

@app.route('/aprovar/<int:user_id>')
def aprovar_usuario(user_id):
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        # Aprova mantendo o perfil que a pessoa solicitou na tela isolada dela
        cur.execute("UPDATE usuarios SET status = 'ativo' WHERE id = %s;", (user_id,))
        conn.commit()
        cur.close(); conn.close()
    return redirect(url_for('area_admin'))

# ==========================================
# ROTAS EXISTENTES MANTIDAS (Paciente e Psicóloga)
# ==========================================
@app.route('/paciente/<int:user_id>', methods=['GET', 'POST'])
def area_paciente(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'diario':
            cur.execute("INSERT INTO diario_emocional (paciente_id, humor, nota_texto) VALUES (%s, %s, %s);", (user_id, request.form.get('humor'), request.form.get('nota')))
        elif acao == 'mensagem':
            cur.execute("INSERT INTO mensagens (remetente_id, destinatario_id, conteudo) VALUES (%s, %s, %s);", (user_id, request.form.get('psi_id'), request.form.get('msg')))
        conn.commit()
    cur.execute("SELECT id, mensagem FROM notificacoes_popup WHERE usuario_id = %s AND lida = FALSE LIMIT 1;", (user_id,))
    alerta = cur.fetchone()
    script_popup = ""
    if alerta:
        script_popup = f"<script>window.onload = function() {{ alert('AVISO DA CLÍNICA:\\n\\n{alerta[1]}'); }};</script>"
        cur.execute("UPDATE notificacoes_popup SET lida = TRUE WHERE id = %s;", (alerta[0],))
        conn.commit()
    cur.execute("SELECT plano, exercicios FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC LIMIT 1;", (user_id,))
    plano = cur.fetchone()
    cur.close(); conn.close()
    
    html_plano = f"<p><strong>Plano:</strong> {plano[0]}</p><p><strong>Tarefas:</strong> {plano[1]}</p>" if plano else "<p>Nenhum plano ativo.</p>"
    html = f"""<div class="card"><h2>Minha Jornada</h2>{html_plano}</div><div class="card"><h2>Diário Emocional</h2><form method="POST"><input type="hidden" name="acao" value="diario"><label>Humor de hoje:</label><select name="humor"><option>Bem</option><option>Ansioso(a)</option><option>Triste</option><option>Irritado(a)</option></select><label>Detalhes:</label><textarea name="nota"></textarea><button type="submit" class="btn">Registrar</button></form></div><a href="/" class="btn btn-outline" style="margin-bottom:30px;">Sair</a>"""
    return render_template_string(TEMPLATE_UNICO, titulo="Paciente", conteudo=html, script_popup=script_popup)

@app.route('/psicologa/<int:user_id>', methods=['GET', 'POST'])
def area_psicologa(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'POST':
        acao = request.form.get('acao')
        if acao == 'novo_plano':
            paciente_id = request.form.get('paciente_id')
            cur.execute("INSERT INTO planos_de_acao (paciente_id, psicologa_id, plano, exercicios) VALUES (%s, %s, %s, %s);", (paciente_id, user_id, request.form.get('plano'), request.form.get('exercicios')))
            cur.execute("INSERT INTO notificacoes_popup (usuario_id, mensagem) VALUES (%s, 'Sua psicóloga atualizou seu Plano de Ação!');", (paciente_id,))
            conn.commit()
    cur.execute("SELECT id, nome FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'ativo';")
    opts = "".join([f"<option value='{p[0]}'>{p[1]}</option>" for p in cur.fetchall()])
    cur.close(); conn.close()
    
    html = f"""<div class="card"><h2>Atualizar Plano de Ação</h2><form method="POST"><input type="hidden" name="acao" value="novo_plano"><select name="paciente_id" required><option value="">Paciente...</option>{opts}</select><textarea name="plano" placeholder="Plano principal" required></textarea><textarea name="exercicios" placeholder="Tarefas"></textarea><button type="submit" class="btn">Salvar e Disparar Alerta</button></form></div><a href="/" class="btn btn-outline" style="margin-bottom:30px;">Sair</a>"""
    return render_template_string(TEMPLATE_UNICO, titulo="Psicóloga", conteudo=html, script_popup="")

if __name__ == '__main__':
    iniciar_banco()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
