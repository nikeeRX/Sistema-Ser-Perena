import os
import psycopg2
from flask import Flask, render_template_string, request, redirect, url_for

app = Flask(__name__)

# ==========================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS (RAILWAY)
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
    """Atualiza as tabelas com senha e status de aprovação"""
    conn = get_db_connection()
    if conn is None:
        return
    
    cur = conn.cursor()
    
    # Criando as tabelas caso seja um banco zerado
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            cpf VARCHAR(14) UNIQUE,
            email VARCHAR(100) UNIQUE,
            contato VARCHAR(20),
            tipo_perfil VARCHAR(50) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS planos_de_acao (
            id SERIAL PRIMARY KEY,
            paciente_id INTEGER REFERENCES usuarios(id),
            plano TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Atualizando o banco existente para suportar as novas regras (Senha e Status)
    cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha VARCHAR(100);")
    cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente';")
    
    # Criando o usuário Admin caso não exista
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'admin';")
    if cur.fetchone()[0] == 0:
        print("Criando Administrador padrão...")
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, email, senha, tipo_perfil, status) 
            VALUES ('Administrador', '000.000.000-00', 'admin@serperene.com', 'admin123', 'admin', 'ativo');
        """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("Banco atualizado com rotinas de Senha e Status!")

# ==========================================
# 2. FRONT-END (HTML + CSS RAIZ EMBUTIDO)
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
        header p { font-style: italic; font-size: 0.9rem; margin-top: 5px; }
        
        .container { width: 90%; max-width: 800px; margin: 40px auto; }
        .card { background-color: #FFFFFF; border-radius: 12px; padding: 30px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(58, 38, 29, 0.1); border-left: 6px solid #3A261D; }
        .card h2 { margin-bottom: 15px; font-size: 1.5rem; border-bottom: 1px solid #E8D5D0; padding-bottom: 10px; }
        .card p { line-height: 1.6; margin-bottom: 10px; font-family: 'Arial', sans-serif; }
        
        label { font-family: 'Arial', sans-serif; font-weight: bold; font-size: 0.9rem; display: block; margin-top: 12px; text-align: left; }
        input[type="text"], input[type="email"], input[type="password"], select { 
            width: 100%; padding: 12px; margin: 6px 0 16px 0; border: 1px solid #E8D5D0; 
            border-radius: 6px; background-color: #F4EBE9; color: #3A261D; font-family: 'Arial', sans-serif; font-size: 1rem; 
        }
        input:focus, select:focus { outline: none; border-color: #3A261D; }
        
        .btn { display: inline-block; background-color: #3A261D; color: #E8D5D0; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; border: none; cursor: pointer; transition: background 0.3s; font-family: 'Arial', sans-serif; font-size: 1rem; }
        .btn:hover { background-color: #5c3e30; }
        .btn-small { padding: 6px 12px; font-size: 0.8rem; }
        .btn-outline { background-color: transparent; color: #3A261D; border: 1px solid #3A261D; }
        
        .alerta { background-color: #E8D5D0; color: #3A261D; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; border: 1px dashed #3A261D; }
        .erro { background-color: #ffcccc; color: #990000; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-family: 'Arial', sans-serif; font-size: 0.9rem;}
        
        .link-cadastro { display: block; text-align: center; margin-top: 20px; font-family: 'Arial', sans-serif; color: #3A261D; text-decoration: none; font-size: 0.9rem; }
        .link-cadastro:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <header>
        <h1>serperene *</h1>
        <p>Acompanhamento Psicológico</p>
    </header>
    <div class="container">
        {{ conteudo | safe }}
    </div>
</body>
</html>
"""

# ==========================================
# 3. ROTAS E LÓGICA DO APLICATIVO
# ==========================================

@app.route('/', methods=['GET', 'POST'])
def login():
    mensagem_erro = ""
    if request.method == 'POST':
        email = request.form.get('email')
        senha = request.form.get('senha')
        
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            # Busca o usuário pelo e-mail e senha
            cur.execute("SELECT id, tipo_perfil, status FROM usuarios WHERE email = %s AND senha = %s LIMIT 1;", (email, senha))
            user = cur.fetchone()
            cur.close()
            conn.close()
            
            if user:
                user_id, perfil, status = user
                
                # Bloqueia se estiver pendente
                if status == 'pendente':
                    mensagem_erro = "Seu cadastro está em análise. Aguarde a aprovação da clínica."
                else:
                    # Redireciona para a área certa
                    if perfil == 'paciente':
                        return redirect(url_for('area_paciente', user_id=user_id))
                    elif perfil == 'psicologa':
                        return redirect(url_for('area_psicologa', user_id=user_id))
                    elif perfil == 'admin':
                        return redirect(url_for('area_admin'))
            else:
                mensagem_erro = "E-mail ou senha incorretos."

    html_erro = f"<div class='erro'>{mensagem_erro}</div>" if mensagem_erro else ""

    conteudo_html = f"""
    <div class="card" style="max-width: 400px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 20px;">Acesso ao Sistema</h2>
        {html_erro}
        <form method="POST">
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" required>
            
            <label for="senha">Senha</label>
            <input type="password" id="senha" name="senha" required>
            
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Entrar</button>
        </form>
        <a href="/cadastro" class="link-cadastro">Ainda não tem cadastro? <strong>Solicite seu acesso aqui.</strong></a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo=conteudo_html)

@app.route('/cadastro', methods=['GET', 'POST'])
def cadastro():
    mensagem = ""
    if request.method == 'POST':
        nome = request.form.get('nome')
        cpf = request.form.get('cpf')
        email = request.form.get('email')
        contato = request.form.get('contato')
        senha = request.form.get('senha')
        
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            try:
                # O perfil é sempre 'paciente' e o status é 'pendente'
                cur.execute("""
                    INSERT INTO usuarios (nome, cpf, email, contato, senha, tipo_perfil, status)
                    VALUES (%s, %s, %s, %s, %s, 'paciente', 'pendente');
                """, (nome, cpf, email, contato, senha))
                conn.commit()
                mensagem = "Cadastro solicitado com sucesso! Aguarde a aprovação da clínica para fazer login."
            except Exception as e:
                conn.rollback()
                mensagem = "Erro: CPF ou E-mail já cadastrados."
            finally:
                cur.close()
                conn.close()

    html_msg = f"<div class='alerta'>{mensagem}</div>" if mensagem else ""

    conteudo_html = f"""
    <div class="card" style="max-width: 500px; margin: 0 auto;">
        <h2 style="text-align: center;">Cadastro de Paciente</h2>
        <p style="text-align: center; font-size: 0.9rem; margin-bottom: 20px;">Preencha os dados abaixo. Seu acesso será liberado após análise da clínica.</p>
        {html_msg}
        <form method="POST">
            <label>Nome Completo</label>
            <input type="text" name="nome" required>
            
            <label>CPF</label>
            <input type="text" name="cpf" required>
            
            <label>E-mail</label>
            <input type="email" name="email" required>
            
            <label>Telefone de Contato</label>
            <input type="text" name="contato" required>
            
            <label>Crie uma Senha</label>
            <input type="password" name="senha" required>
            
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Solicitar Acesso</button>
        </form>
        <a href="/" class="link-cadastro">Já tem conta? <strong>Faça login aqui.</strong></a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Cadastro", conteudo=conteudo_html)

@app.route('/paciente/<int:user_id>')
def area_paciente(user_id):
    # A mesma lógica anterior, apenas isolada para o paciente logado
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT nome, cpf, email FROM usuarios WHERE id = %s;", (user_id,))
    paciente = cur.fetchone()
    cur.close()
    conn.close()

    conteudo_html = f"""
    <div class="alerta">Área do Paciente — Conectado como: <strong>{paciente[0]}</strong></div>
    <div class="card">
        <h2>Minha Jornada</h2>
        <p>Seus planos de ação aparecerão aqui assim que sua psicóloga disponibilizar.</p>
    </div>
    <a href="/" class="btn btn-outline">Sair</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/psicologa/<int:user_id>')
def area_psicologa(user_id):
    conteudo_html = """
    <div class="card">
        <h2>Painel da Psicóloga</h2>
        <p>Bem-vinda ao seu consultório virtual.</p>
    </div>
    <a href="/" class="btn btn-outline">Sair</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

@app.route('/admin')
def area_admin():
    conn = get_db_connection()
    cur = conn.cursor()
    # Pega todos os pacientes pendentes
    cur.execute("SELECT id, nome, email, contato FROM usuarios WHERE tipo_perfil = 'paciente' AND status = 'pendente';")
    pendentes = cur.fetchall()
    cur.close()
    conn.close()

    html_pendentes = ""
    if pendentes:
        for p in pendentes:
            html_pendentes += f"""
            <div style="border-bottom: 1px solid #E8D5D0; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>{p[1]}</strong><br>
                    <span style="font-size: 0.8rem; font-family: Arial;">{p[2]} | {p[3]}</span>
                </div>
                <a href="/aprovar/{p[0]}" class="btn btn-small">Aprovar Acesso</a>
            </div>
            """
    else:
        html_pendentes = "<p>Não há pacientes aguardando aprovação no momento.</p>"

    conteudo_html = f"""
    <div class="card">
        <h2>Pacientes Pendentes de Aprovação</h2>
        {html_pendentes}
    </div>
    <div class="card">
        <h2>Cadastrar Nova Psicóloga</h2>
        <p style="font-size: 0.9rem;">O cadastro de profissionais é feito exclusivamente por aqui.</p>
        <button class="btn btn-outline" style="margin-top: 10px;">+ Adicionar Profissional</button>
    </div>
    <a href="/" class="btn btn-outline">Sair</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área Administrativa", conteudo=conteudo_html)

@app.route('/aprovar/<int:user_id>')
def aprovar_usuario(user_id):
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute("UPDATE usuarios SET status = 'ativo' WHERE id = %s;", (user_id,))
        conn.commit()
        cur.close()
        conn.close()
    return redirect(url_for('area_admin'))

if __name__ == '__main__':
    iniciar_banco()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
