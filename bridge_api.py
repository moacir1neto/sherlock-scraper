from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import json

# Importando o motor de scraping que refatoramos
from cnpj_scraper import scrape_cnpj

app = FastAPI(title="Sherlock Scraper Bridge API")

class CNPJRequest(BaseModel):
    termo: str

@app.get("/")
def health_check():
    return {"status": "ok", "service": "sherlock-bridge-api"}

@app.post("/scrape-cnpj")
async def run_scrape_cnpj(request: CNPJRequest):
    """
    Rota que recebe um termo de busca e retorna os dados da Casa dos Dados vinculados ao CNPJ.
    """
    if not request.termo:
        raise HTTPException(status_code=400, detail="O campo 'termo' é obrigatório.")
    
    print(f"📡 API: Recebido pedido de busca para: {request.termo}")
    
    # Chama o motor de scraping assíncrono
    resultado = await scrape_cnpj(request.termo)
    
    if not resultado.get("success"):
        # Se for um erro de negócio (não encontrado), retornamos 200 com a flag de erro no JSON,
        # para que o Go trate como um fluxo normal de 'não encontrado'.
        return resultado
        
    return resultado

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
