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
    """Cria as tabelas estruturadas com Nome, CPF, E-mail e Contato"""
    conn = get_db_connection()
    if conn is None:
        return
    
    cur = conn.cursor()
    
    # Criando a tabela de usuários com os novos campos solicitados
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
    
    # Inserindo dados iniciais de teste caso a tabela esteja limpa
    cur.execute("SELECT COUNT(*) FROM usuarios;")
    if cur.fetchone()[0] == 0:
        print("Inserindo dados iniciais de teste...")
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, email, contato, tipo_perfil) 
            VALUES ('João Silva', '123.456.789-00', 'joao@email.com', '(61) 99999-9999', 'paciente') 
            RETURNING id;
        """)
        paciente_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO usuarios (nome, cpf, email, contato, tipo_perfil) 
            VALUES ('Dra. Ser Perene', '000.000.000-11', 'psicologa@email.com', '(61) 98888-8888', 'psicologa');
        """)
        
        cur.execute("INSERT INTO planos_de_acao (paciente_id, plano) VALUES (%s, %s);", 
                    (paciente_id, "Praticar a técnica de respiração diafragmática todos os dias antes de dormir."))
    
    conn.commit()
    cur.close()
    conn.close()
    print("Banco de dados pronto, estruturado e sincronizado!")

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
        
        /* ESTILOS DE FORMULÁRIO */
        label { font-family: 'Arial', sans-serif; font-weight: bold; font-size: 0.9rem; display: block; margin-top: 12px; text-align: left; }
        input[type="text"], input[type="email"], select { 
            width: 100%; padding: 12px; margin: 6px 0 16px 0; border: 1px solid #E8D5D0; 
            border-radius: 6px; background-color: #F4EBE9; color: #3A261D; font-family: 'Arial', sans-serif; font-size: 1rem; 
        }
        input[type="text"]:focus, input[type="email"]:focus, select:focus { outline: none; border-color: #3A261D; }
        
        .btn { display: inline-block; background-color: #3A261D; color: #E8D5D0; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; border: none; cursor: pointer; transition: background 0.3s; font-family: 'Arial', sans-serif; font-size: 1rem; }
        .btn:hover { background-color: #5c3e30; }
        .alerta { background-color: #E8D5D0; color: #3A261D; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; text-align: center; border: 1px dashed #3A261D; }
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
    if request.method == 'POST':
        nome = request.form.get('nome')
        cpf = request.form.get('cpf')
        email = request.form.get('email')
        contato = request.form.get('contato')
        tipo_perfil = request.form.get('tipo_perfil')
        
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            try:
                # Procura se o usuário já está no banco pelo CPF ou E-mail
                cur.execute("SELECT id, tipo_perfil FROM usuarios WHERE cpf = %s OR email = %s LIMIT 1;", (cpf, email))
                user = cur.fetchone()
                
                if not user:
                    # Se for novo, realiza a inserção com os campos editados
                    cur.execute("""
                        INSERT INTO usuarios (nome, cpf, email, contato, tipo_perfil)
                        VALUES (%s, %s, %s, %s, %s) RETURNING id, tipo_perfil;
                    """, (nome, cpf, email, contato, tipo_perfil))
                    user = cur.fetchone()
                    conn.commit()
                
                user_id = user[0]
                perfil_atual = user[1]
                
                cur.close()
                conn.close()
                
                # Redireciona dinamicamente passando o ID do usuário logado
                if perfil_atual == 'paciente':
                    return redirect(url_for('area_paciente', user_id=user_id))
                elif perfil_atual == 'psicologa':
                    return redirect(url_for('area_psicologa', user_id=user_id))
                else:
                    return redirect(url_for('area_admin'))
                    
            except Exception as e:
                print(f"Erro no processo de login/cadastro: {e}")
                if conn: conn.rollback()

    conteudo_html = """
    <div class="card" style="max-width: 500px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 20px;">Acesso ao Sistema</h2>
        <form method="POST">
            <label for="nome">Nome Completo</label>
            <input type="text" id="nome" name="nome" placeholder="Digite seu nome" required>
            
            <label for="cpf">CPF</label>
            <input type="text" id="cpf" name="cpf" placeholder="000.000.000-00" required>
            
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" placeholder="nome@exemplo.com" required>
            
            <label for="contato">Telefone de Contato</label>
            <input type="text" id="contato" name="contato" placeholder="(00) 00000-0000" required>
            
            <label for="tipo_perfil">Tipo de Perfil</label>
            <select id="tipo_perfil" name="tipo_perfil">
                <option value="paciente">Paciente</option>
                <option value="psicologa">Psicóloga</option>
                <option value="admin">Administrador da Clínica</option>
            </select>
            
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Entrar no Aplicativo</button>
        </form>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo=conteudo_html)

@app.route('/paciente')
@app.route('/paciente/<int:user_id>')
def area_paciente(user_id=None):
    conn = get_db_connection()
    cur = conn.cursor()
    
    if user_id:
        cur.execute("SELECT nome, id, cpf, email, contato FROM usuarios WHERE id = %s;", (user_id,))
    else:
        cur.execute("SELECT nome, id, cpf, email, contato FROM usuarios WHERE tipo_perfil = 'paciente' LIMIT 1;")
    paciente = cur.fetchone()
    
    plano_texto = "Nenhum plano cadastrado."
    if paciente:
        cur.execute("SELECT plano FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC LIMIT 1;", (paciente[1],))
        plano = cur.fetchone()
        if plano:
            plano_texto = plano[0]
            
    cur.close()
    conn.close()

    if not paciente:
        return redirect(url_for('login'))

    conteudo_html = f"""
    <div class="alerta">
        Área do Paciente — Conectado como: <strong>{paciente[0]}</strong>
    </div>
    <div class="card">
        <h2>Meus Dados de Contato</h2>
        <p><strong>CPF:</strong> {paciente[2]}</p>
        <p><strong>E-mail:</strong> {paciente[3]}</p>
        <p><strong>Telefone:</strong> {paciente[4]}</p>
    </div>
    <div class="card">
        <h2>Minha Jornada</h2>
        <p><strong>Plano de Ação da Semana:</strong> {plano_texto}</p>
    </div>
    <a href="/" class="btn" style="background-color: transparent; color: #3A261D; border: 1px solid #3A261D;">Desconectar</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/psicologa')
@app.route('/psicologa/<int:user_id>')
def area_psicologa(user_id=None):
    conn = get_db_connection()
    cur = conn.cursor()
    
    if user_id:
        cur.execute("SELECT nome, email FROM usuarios WHERE id = %s;", (user_id,))
    else:
        cur.execute("SELECT nome, email FROM usuarios WHERE tipo_perfil = 'psicologa' LIMIT 1;")
    psicologa = cur.fetchone()
    
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'paciente';")
    qtd_pacientes = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    nome_psi = psicologa[0] if psicologa else "Psicóloga"
    email_psi = psicologa[1] if psicologa else ""

    conteudo_html = f"""
    <div class="card">
        <h2>Painel Profissional</h2>
        <p><strong>Profissional:</strong> {nome_psi}</p>
        <p><strong>E-mail Corporativo:</strong> {email_psi}</p>
        <p><strong>Pacientes Sob Sua Gestão:</strong> {qtd_pacientes}</p>
    </div>
    <div class="card">
        <h2>Agenda do Dia</h2>
        <p><strong>10:00</strong> - Sessão Online Agendada <a href="#" style="color: #3A261D;">[Link da Vídeo Chamada]</a></p>
    </div>
    <a href="/" class="btn" style="background-color: transparent; color: #3A261D; border: 1px solid #3A261D;">Desconectar</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

@app.route('/admin')
def area_admin():
    conteudo_html = """
    <div class="card">
        <h2>Painel Administrativo Geral</h2>
        <p>Controle global de usuários, CPFs cadastrados e monitoramento de banco de dados ativos no Railway.</p>
    </div>
    <a href="/" class="btn" style="background-color: transparent; color: #3A261D; border: 1px solid #3A261D;">Voltar</a>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área Administrativa", conteudo=conteudo_html)

# ==========================================
# INICIALIZAÇÃO
# ==========================================
if __name__ == '__main__':
    iniciar_banco()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
