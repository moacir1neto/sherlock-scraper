# Usa a imagem oficial do Playwright que JÁ VEM com o Python e os navegadores instalados!
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Instala as dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Expõe a porta para a Bridge API
EXPOSE 8000

# Copia o nosso código para dentro do contêiner
COPY . .

# Por padrão, iniciamos o servidor web da Ponte (Microserviço)
# Mas ainda podemos rodar o main.py manualmente via 'docker run' se precisarmos de jobs pesados.
CMD ["uvicorn", "bridge_api:app", "--host", "0.0.0.0", "--port", "8000"]