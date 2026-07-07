import os
import psycopg2
from flask import Flask, render_template_string

app = Flask(__name__)

# ==========================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS (RAILWAY)
# ==========================================
# Link real que você enviou (Cuidado ao subir para o GitHub público depois!)
DATABASE_URL = "postgresql://postgres:ZoLVFMMKvRQxFhFpTApEqmESiNdQpCOy@acela.proxy.rlwy.net:19268/railway"

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao banco: {e}")
        return None

def iniciar_banco():
    """Cria as tabelas no Railway e insere dados de teste na primeira vez"""
    conn = get_db_connection()
    if conn is None:
        return
    
    cur = conn.cursor()
    
    # Criando as tabelas principais
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            tipo_perfil VARCHAR(50) NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS planos_de_acao (
            id SERIAL PRIMARY KEY,
            paciente_id INTEGER REFERENCES usuarios(id),
            plano TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Verificando se já tem dados para não duplicar
    cur.execute("SELECT COUNT(*) FROM usuarios;")
    if cur.fetchone()[0] == 0:
        print("Inserindo dados de teste no banco...")
        cur.execute("INSERT INTO usuarios (nome, tipo_perfil) VALUES ('João (Paciente Teste)', 'paciente') RETURNING id;")
        paciente_id = cur.fetchone()[0]
        
        cur.execute("INSERT INTO usuarios (nome, tipo_perfil) VALUES ('Dra. Ser Perene (Psicóloga)', 'psicologa');")
        
        cur.execute("INSERT INTO planos_de_acao (paciente_id, plano) VALUES (%s, %s);", 
                    (paciente_id, "Praticar a técnica de respiração diafragmática todos os dias antes de dormir."))
    
    conn.commit()
    cur.close()
    conn.close()
    print("Banco de dados pronto e sincronizado!")

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
        .btn { display: inline-block; background-color: #3A261D; color: #E8D5D0; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; border: none; cursor: pointer; transition: background 0.3s; font-family: 'Arial', sans-serif; }
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

@app.route('/')
def login():
    conteudo_html = """
    <div class="card" style="text-align: center;">
        <h2>Acesso ao Sistema</h2>
        <p>Selecione o seu perfil para entrar:</p><br>
        <a href="/paciente" class="btn" style="margin: 5px;">Área do Paciente</a>
        <a href="/psicologa" class="btn" style="margin: 5px;">Área da Psicóloga</a>
        <a href="/admin" class="btn" style="margin: 5px;">Área Administrativa</a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo=conteudo_html)

@app.route('/paciente')
def area_paciente():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Buscando o paciente teste no banco real
    cur.execute("SELECT nome, id FROM usuarios WHERE tipo_perfil = 'paciente' LIMIT 1;")
    paciente = cur.fetchone()
    
    plano_texto = "Nenhum plano cadastrado."
    if paciente:
        # Buscando o plano de ação desse paciente no banco
        cur.execute("SELECT plano FROM planos_de_acao WHERE paciente_id = %s ORDER BY data_criacao DESC LIMIT 1;", (paciente[1],))
        plano = cur.fetchone()
        if plano:
            plano_texto = plano[0]
            
    cur.close()
    conn.close()

    nome_paciente = paciente[0] if paciente else "Paciente"

    conteudo_html = f"""
    <div class="alerta">
        Bem-vindo(a), {nome_paciente}! Os dados abaixo vêm direto do PostgreSQL.
    </div>
    <div class="card">
        <h2>Minha Jornada</h2>
        <p><strong>Plano de Ação Atual:</strong> {plano_texto}</p>
    </div>
    <button class="btn">Falar com minha Psicóloga</button>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/psicologa')
def area_psicologa():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Buscando nome da psicóloga
    cur.execute("SELECT nome FROM usuarios WHERE tipo_perfil = 'psicologa' LIMIT 1;")
    psicologa = cur.fetchone()
    
    # Contando quantos pacientes temos no banco
    cur.execute("SELECT COUNT(*) FROM usuarios WHERE tipo_perfil = 'paciente';")
    qtd_pacientes = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    nome_psi = psicologa[0] if psicologa else "Psicóloga"

    conteudo_html = f"""
    <div class="card">
        <h2>Painel da {nome_psi}</h2>
        <p>Você tem <strong>{qtd_pacientes}</strong> paciente(s) cadastrado(s) no banco de dados do Railway.</p>
    </div>
    <div class="card">
        <h2>Agenda do Dia</h2>
        <p><strong>10:00</strong> - João (Sessão Online) <a href="#" style="color: #3A261D;">[Link]</a></p>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

@app.route('/admin')
def area_admin():
    conteudo_html = """
    <div class="card">
        <h2>Visão Geral do Banco</h2>
        <p>As tabelas 'usuarios' e 'planos_de_acao' foram criadas com sucesso no Railway!</p>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área Administrativa", conteudo=conteudo_html)

# ==========================================
# INICIALIZAÇÃO
# ==========================================
if __name__ == '__main__':
    # Roda a função de criar as tabelas antes de subir o servidor web
    iniciar_banco()
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
