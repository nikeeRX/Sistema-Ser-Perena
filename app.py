import os
import psycopg2
from flask import Flask, render_template_string

app = Flask(__name__)

# ==========================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS (RAILWAY)
# ==========================================
# A string de conexão será puxada das variáveis de ambiente do Railway
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://usuario:senha@containers-us-west.railway.app:5432/railway")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao banco: {e}")
        return None

# ==========================================
# 2. FRONT-END (HTML + CSS RAIZ EMBUTIDO)
# ==========================================
# Paleta extraída das logos:
# Marrom Escuro: #3A261D
# Nude/Rosa Claro: #E8D5D0
# Fundo da página: #F4EBE9 (Uma versão um pouco mais clara do nude para não cansar a vista)

TEMPLATE_UNICO = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ser Perene - {{ titulo }}</title>
    <style>
        /* RESET BÁSICO */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Georgia', serif; /* Fonte serifada para combinar com a elegância da logo */
        }
        
        body {
            background-color: #F4EBE9; /* Fundo claro */
            color: #3A261D; /* Texto marrom escuro da logo */
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
        }

        /* CABEÇALHO */
        header {
            width: 100%;
            background-color: #E8D5D0; /* Nude da logo */
            padding: 20px;
            text-align: center;
            border-bottom: 2px solid #3A261D;
        }

        header h1 {
            font-size: 2.5rem;
            letter-spacing: 2px;
            font-weight: normal;
        }
        
        header p {
            font-style: italic;
            font-size: 0.9rem;
            margin-top: 5px;
        }

        /* CONTAINER PRINCIPAL */
        .container {
            width: 90%;
            max-width: 800px;
            margin: 40px auto;
        }

        /* CARDS DE CONTEÚDO */
        .card {
            background-color: #FFFFFF;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(58, 38, 29, 0.1);
            border-left: 6px solid #3A261D;
        }

        .card h2 {
            margin-bottom: 15px;
            font-size: 1.5rem;
            border-bottom: 1px solid #E8D5D0;
            padding-bottom: 10px;
        }

        .card p {
            line-height: 1.6;
            margin-bottom: 10px;
            font-family: 'Arial', sans-serif; /* Fonte mais limpa para leitura de textos longos */
        }

        /* BOTÕES */
        .btn {
            display: inline-block;
            background-color: #3A261D;
            color: #E8D5D0;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            text-align: center;
            border: none;
            cursor: pointer;
            transition: background 0.3s;
            font-family: 'Arial', sans-serif;
        }

        .btn:hover {
            background-color: #5c3e30;
        }
        
        /* ALERTAS / LEMBRETES */
        .alerta {
            background-color: #E8D5D0;
            color: #3A261D;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: bold;
            text-align: center;
            border: 1px dashed #3A261D;
        }
    </style>
</head>
<body>

    <header>
        <!-- Você pode trocar o h1 abaixo pela tag <img src="..."> quando for hospedar a imagem -->
        <h1>serperene *</h1>
        <p>Acompanhamento Psicológico</p>
    </header>

    <div class="container">
        <!-- Renderização dinâmica do conteúdo dependendo da rota -->
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
    # Tela inicial provisória simulando um login
    conteudo_html = """
    <div class="card" style="text-align: center;">
        <h2>Acesso ao Sistema</h2>
        <p>Selecione o seu perfil para entrar:</p>
        <br>
        <a href="/paciente" class="btn" style="margin: 5px;">Área do Paciente</a>
        <a href="/psicologa" class="btn" style="margin: 5px;">Área da Psicóloga</a>
        <a href="/admin" class="btn" style="margin: 5px;">Área Administrativa</a>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Login", conteudo=conteudo_html)

@app.route('/paciente')
def area_paciente():
    # Estrutura "Minha Jornada" com base no seu documento
    conteudo_html = """
    <div class="alerta">
        Notificação: Sua próxima sessão é amanhã às 14:00.
    </div>

    <div class="card">
        <h2>Minha Jornada</h2>
        <p><strong>Plano de Ação da Semana:</strong> Praticar a técnica de respiração diafragmática ensinada na última sessão.</p>
        <p><strong>Reflexões:</strong> Como você se sentiu ao dizer "não" no trabalho esta semana?</p>
    </div>

    <div class="card">
        <h2>Mural da Clínica</h2>
        <p>Lembre-se: O autocuidado não é egoísmo, é necessidade. Descanse a mente neste final de semana.</p>
    </div>
    
    <button class="btn">Falar com minha Psicóloga</button>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área do Paciente", conteudo=conteudo_html)

@app.route('/psicologa')
def area_psicologa():
    # Estrutura de Gestão da Psicóloga
    conteudo_html = """
    <div class="card">
        <h2>Agenda do Dia</h2>
        <p><strong>10:00</strong> - João (Sessão Online) <a href="#" style="color: #3A261D;">[Link do Meet]</a></p>
        <p><strong>14:00</strong> - Maria (Sessão Online) <a href="#" style="color: #3A261D;">[Link do Meet]</a></p>
    </div>

    <div class="card">
        <h2>Gerar Plano de Ação</h2>
        <p><em>Formulário de preenchimento do plano individual pós-sessão entrará aqui.</em></p>
        <button class="btn">Novo Plano</button>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área da Psicóloga", conteudo=conteudo_html)

@app.route('/admin')
def area_admin():
    # Estrutura Administrativa / Financeira
    conteudo_html = """
    <div class="card">
        <h2>Visão Geral - Gestão</h2>
        <p><strong>Pacientes Ativos:</strong> 42</p>
        <p><strong>Sessões Realizadas no Mês:</strong> 128</p>
        <p><strong>Taxa de Faltas:</strong> 4%</p>
    </div>

    <div class="card">
        <h2>Financeiro</h2>
        <p>Pagamentos pendentes: 3</p>
        <button class="btn">Ver Relatório Financeiro</button>
    </div>
    """
    return render_template_string(TEMPLATE_UNICO, titulo="Área Administrativa", conteudo=conteudo_html)

# ==========================================
# INICIALIZAÇÃO
# ==========================================
if __name__ == '__main__':
    # Roda o servidor na porta 5000 (ou a porta que o Railway injetar)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
