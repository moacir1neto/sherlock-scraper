import sys
import json
import re
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

def extract_cnpj_from_url(url):
    """Extrai o CNPJ final da URL casadosdados (ex: /solucao/cnpj/razao-social-00000000000000)"""
    match = re.search(r'-(\d{14})$', url)
    if match:
        raw = match.group(1)
        return f"{raw[:2]}.{raw[2:5]}.{raw[5:8]}/{raw[8:12]}-{raw[12:]}"
    return ""

async def scrape_cnpj(termo_busca: str) -> dict:
    """Motor de scraping principal que pode ser chamado por CLI ou API."""
    resultado = {
        "success": False,
        "error": None,
        "message": "",
        "dados": {
            "cnpj": "",
            "situacao_cadastral": "",
            "email": "",
            "telefone": ""
        }
    }

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 720},
                locale='pt-BR'
            )
            page = await context.new_page()

            # 2. Acessar a Casa dos Dados
            await page.goto("https://casadosdados.com.br/", timeout=60000)
            await page.wait_for_load_state("domcontentloaded")

            # 3. Aguardar o seletor de input
            await page.wait_for_selector('input[name="q"]', timeout=60000)

            # 4. Preencher o input e enviar
            await page.fill('input[name="q"]', termo_busca)
            await page.click('button[type="submit"]')

            # 5. Espera do Vue.js
            try:
                await page.wait_for_selector('article.media', timeout=10000)
            except PlaywrightTimeoutError:
                resultado["success"] = False
                resultado["error"] = "cnpj_not_found"
                resultado["message"] = f"Empresa não encontrada para o termo '{termo_busca}'."
                await browser.close()
                return resultado

            cnpj_texto_card = ""
            try:
                primeiro_card = page.locator('article.media').first
                text = await primeiro_card.inner_text()
                match = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text)
                if match:
                    cnpj_texto_card = match.group(0)
            except:
                pass

            # 6. Encontrar o link de detalhes
            try:
                link_detalhes = page.locator('article.media').first.locator('a[href^="/solucao/cnpj/"]')
                await link_detalhes.first.click(force=True)
            except Exception as e:
                resultado["success"] = False
                resultado["error"] = "click_failed"
                resultado["message"] = f"Erro ao clicar em detalhes: {str(e)}"
                await browser.close()
                return resultado

            # 7. Aguardar a página interna renderizar
            await page.wait_for_load_state("networkidle", timeout=15000)
            try:
                await page.wait_for_selector('label:has-text("Situação Cadastral")', timeout=10000)
            except:
                pass 

            # 8. Extração
            try:
                situacao_el = page.locator('label').filter(has_text=re.compile(r"Situação Cadastral", re.I))
                if await situacao_el.count() > 0:
                    val_el = situacao_el.first.locator('xpath=..').locator('.has-text-weight-bold').first
                    if await val_el.count() > 0:
                        resultado["dados"]["situacao_cadastral"] = (await val_el.inner_text()).strip()
            except:
                pass

            try:
                email_el = page.locator('label').filter(has_text=re.compile(r"Email|E-MAIL", re.I))
                if await email_el.count() > 0:
                    val_el = email_el.first.locator('xpath=..').locator('a[href^="mailto:"]').first
                    if await val_el.count() > 0:
                        resultado["dados"]["email"] = (await val_el.inner_text()).strip()
            except:
                pass

            try:
                tel_el = page.locator('label').filter(has_text=re.compile(r"Telefone", re.I))
                if await tel_el.count() > 0:
                    val_el = tel_el.first.locator('xpath=..').locator('a[href^="tel:"]').first
                    if await val_el.count() > 0:
                        resultado["dados"]["telefone"] = (await val_el.inner_text()).strip()
            except:
                pass

            cnpj_from_url = extract_cnpj_from_url(page.url)
            if cnpj_from_url:
                resultado["dados"]["cnpj"] = cnpj_from_url
            elif cnpj_texto_card:
                resultado["dados"]["cnpj"] = cnpj_texto_card
            else:
                try:
                    text_content = await page.content()
                    match = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text_content)
                    if match:
                        resultado["dados"]["cnpj"] = match.group(0)
                except:
                    pass

            resultado["success"] = True
            resultado["message"] = "Extração concluída."
            await browser.close()
            return resultado

    except Exception as e:
        resultado["success"] = False
        resultado["error"] = "unexpected_error"
        resultado["message"] = str(e)
        return resultado

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "missing_argument",
            "message": "Termo de busca não fornecido."
        }, ensure_ascii=False))
        return

    res = await scrape_cnpj(sys.argv[1])
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

