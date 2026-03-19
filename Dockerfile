# Usa a imagem oficial do Playwright que JÁ VEM com o Python e os navegadores instalados!
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Instala as dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o nosso código para dentro do contêiner
COPY . .

# Comando padrão ao rodar o contêiner
CMD ["python", "main.py"]