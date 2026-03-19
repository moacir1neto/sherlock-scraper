import time
import re
import csv
import argparse
from playwright.sync_api import sync_playwright

print(r"""
  ____  _               _            _    
 / ___|| |__   ___ _ __| | ___   ___| | __
 \___ \| '_ \ / _ \ '__| |/ _ \ / __| |/ /
  ___) | | | |  __/ |  | | (_) | (__|   < 
 |____/|_| |_|\___|_|  |_|\___/ \___|_|\_\
    FASE 10: O CAÇADOR DE ELEMENTOS 🎯
""")

parser = argparse.ArgumentParser(description="Sherlock - Caçador de Leads no Google Maps")
parser.add_argument('--nicho', required=True, help='Nicho de negócio (ex: Dentista, Advogado)')
parser.add_argument('--localizacao', required=True, help='Cidade/região (ex: Florianópolis SC)')
args = parser.parse_args()


def processar_telefone(telefone_extraido):
    numeros = re.sub(r'\D', '', telefone_extraido)
    if not numeros: return "Sem telefone", "Indefinido", "-"
    if not numeros.startswith('55') and len(numeros) >= 10: numeros = '55' + numeros
        
    if len(numeros) == 13 and numeros[4] == '9':
        return telefone_extraido.replace('', '').strip(), "📱 Telemóvel", f"https://wa.me/{numeros}"
    elif len(numeros) == 12:
        return telefone_extraido.replace('', '').strip(), "☎️ Fixo", "-"
    else:
        return telefone_extraido.replace('', '').strip(), "❓ Outro", "-"

def investigar_site(context, url_site):
    """ O Radar Omnichannel COM CAPTURA DE PITCH e MAILTO """
    dados = {
        "resumo": "-", "email": "-", "instagram": "-", "facebook": "-", 
        "linkedin": "-", "tiktok": "-", "youtube": "-"
    }
    
    print(f"   🌐 A vasculhar o site: {url_site}")
    site_page = context.new_page()
    
    try:
        site_page.goto(url_site, timeout=15000)
        site_page.wait_for_load_state('domcontentloaded', timeout=5000)
        
        # --- 1. CAPTURA DO ELEVATOR PITCH (RESUMO DO NEGÓCIO) ---
        try:
            meta_desc = site_page.locator('meta[name="description"]')
            if meta_desc.count() > 0:
                resumo = meta_desc.first.get_attribute("content")
                if resumo:
                    dados["resumo"] = resumo.replace('\n', ' ').replace('\r', ' ').strip()
            
            if dados["resumo"] == "-":
                titulo = site_page.title()
                if titulo:
                    dados["resumo"] = titulo.replace('\n', ' ').strip()
        except:
            pass

        # --- 2. CAÇADOR AVANÇADO DE E-MAILS ---
        conteudo = site_page.content()
        emails_crus = set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', conteudo))
        
        try:
            mailto_links = site_page.locator('a[href^="mailto:"]')
            for i in range(mailto_links.count()):
                href = mailto_links.nth(i).get_attribute("href")
                if href:
                    email_clean = href.replace("mailto:", "").split("?")[0].strip()
                    emails_crus.add(email_clean)
        except:
            pass

        emails_limpos = [e for e in emails_crus if not e.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
        if emails_limpos:
            dados["email"] = ", ".join(list(emails_limpos)[:2])

        # --- 3. RADAR REDES SOCIAIS ---
        redes = ["instagram.com", "facebook.com", "linkedin.com", "tiktok.com", "youtube.com"]
        for rede in redes:
            loc = site_page.locator(f'a[href*="{rede}"]')
            if loc.count() > 0:
                nome_chave = rede.split('.')[0] 
                dados[nome_chave] = loc.first.get_attribute("href")

    except Exception:
        print(f"   ⚠️ Site bloqueou ou demorou. Extração parcial.")
    finally:
        site_page.close()
        
    return dados

def run(playwright):
    print("="*50)
    nicho = args.nicho
    cidade = args.localizacao
    print(f"🎯 Nicho: {nicho} | 📍 Localização: {cidade}")
    print("="*50)
    
    termo_busca = f"{nicho} em {cidade}"
    nome_arquivo = f"leads_{nicho.replace(' ', '_')}_{cidade.replace(' ', '_')}.csv"

    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 720}, locale='pt-BR')
    page = context.new_page()

    print("📍 A aceder ao Google Maps...")
    page.goto("https://www.google.com.br/maps?hl=pt-BR")
    page.wait_for_load_state('networkidle')

    try:
        print(f"🔍 A pesquisar por: '{termo_busca}'...")
        search_box = page.locator("input#searchboxinput").or_(page.locator("input[name='q']")).or_(page.get_by_placeholder(re.compile("Pesquise", re.IGNORECASE)))
        search_box.first.wait_for(state="attached", timeout=10000)
        search_box.first.click(force=True)
        search_box.first.fill(termo_busca, force=True)
        search_box.first.press("Enter")

        page.wait_for_selector("a[href*='/maps/place/']", timeout=60000)
        time.sleep(2)

        print("🖱️ A fazer scroll para carregar os Leads...")
        painel_lateral = page.locator("div[role='feed']")
        painel_lateral.hover()
        for _ in range(4): 
            page.mouse.wheel(0, 5000)
            time.sleep(2.5)

        places = page.locator("a[href*='/maps/place/']")
        quantidade = places.count()

        print("\n" + "=" * 50)
        print(f"🕵️‍♂️ A INICIAR AUDITORIA COM RAIO-X EM {quantidade} EMPRESAS...")
        print("=" * 50)

        leads_processados = set()

        with open(nome_arquivo, mode="w", newline="", encoding="utf-8") as arquivo_csv:
            escritor = csv.writer(arquivo_csv, delimiter=';')
            escritor.writerow([
                "Empresa", "Nota (Estrelas)", "Qtd Avaliações", "Resumo do Negócio (Pitch)", "Endereço", 
                "Telefone", "Tipo", "Link WhatsApp", "Site", 
                "E-mail", "Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube"
            ])

            for i in range(quantidade):
                link_elemento = places.nth(i)
                nome = link_elemento.get_attribute("aria-label")
                
                if not nome: continue
                    
                if nome in leads_processados:
                    print(f"\n⏭️ A ignorar clone detetado: {nome[:35]}...")
                    continue
                    
                leads_processados.add(nome)
                
                print(f"\n⏳ A analisar: {nome[:35]}...")
                
                link_elemento.click(force=True)
                time.sleep(2.5) 
                
                # --- NOVIDADE FASE 10: EXTRAÇÃO FORÇA BRUTA DE AVALIAÇÕES ---
                nota = "-"
                qtd_avaliacoes = "-"
                try:
                    # Tenta capturar pelo aria-label do link de avaliações (mais estável)
                    reputacao_loc = page.locator('button[aria-label*="estrelas"], span[aria-label*="estrelas"]').first
                    if reputacao_loc.count() > 0:
                        texto_rep = reputacao_loc.get_attribute("aria-label")
                        # Ex: "4,8 estrelas 123 avaliações"
                        match_rep = re.search(r'([1-5][.,]\d)\s*estrelas\s*([\d.]+)', texto_rep)
                        if match_rep:
                            nota = match_rep.group(1).replace(',', '.')
                            qtd_avaliacoes = match_rep.group(2).replace('.', '')
                        else:
                            # Fallback 1: Só a nota
                            if "estrelas" in texto_rep:
                                nota = texto_rep.split(" ")[0].replace(',', '.')
                            # Fallback 2: Só os números das avaliações
                            nums = re.findall(r'\d+', texto_rep.split("estrelas")[-1]) if "estrelas" in texto_rep else re.findall(r'\d+', texto_rep)
                            if nums:
                                qtd_avaliacoes = "".join(nums)

                    # Fallback de Força Bruta: Procura no texto visível do painel
                    if nota == "-" or qtd_avaliacoes == "-":
                        texto_painel = page.locator('div[role="main"]').first.inner_text()
                        match_bruto = re.search(r'([1-5][.,]\d)\s*\(([\d.]+)\)', texto_painel)
                        if match_bruto:
                            if nota == "-": nota = match_bruto.group(1).replace(',', '.')
                            if qtd_avaliacoes == "-": qtd_avaliacoes = match_bruto.group(2).replace('.', '')
                except Exception as e:
                    pass

                # 2. Endereço
                endereco_locator = page.locator('button[data-item-id="address"]')
                endereco = endereco_locator.first.inner_text().replace('\n', ' ').replace('', '').replace('-', '', 1).strip() if endereco_locator.count() > 0 else "Não encontrado"

                # 3. Telefone e WhatsApp
                telefone_locator = page.locator('button[data-item-id^="phone:tel:"]')
                if telefone_locator.count() > 0:
                    tel_bruto = telefone_locator.first.inner_text().replace('\n', ' ')
                    tel_visual, tipo_num, link_wa = processar_telefone(tel_bruto)
                else:
                    tel_visual, tipo_num, link_wa = ("Não encontrado", "Sem número", "-")

                # 4. Site e Auditoria Omnichannel
                site_locator = page.locator('a[data-item-id="authority"]')
                site = "-"
                dados_sociais = {"resumo": "-", "email": "-", "instagram": "-", "facebook": "-", "linkedin": "-", "tiktok": "-", "youtube": "-"}
                
                if site_locator.count() > 0:
                    site = site_locator.first.get_attribute("href")
                    dados_sociais = investigar_site(context, site)

                # Salvar a linha do CSV!
                escritor.writerow([
                    nome, nota, qtd_avaliacoes, dados_sociais["resumo"], endereco, tel_visual, tipo_num, link_wa, site,
                    dados_sociais["email"], dados_sociais["instagram"], dados_sociais["facebook"], 
                    dados_sociais["linkedin"], dados_sociais["tiktok"], dados_sociais["youtube"]
                ])

        print("\n" + "=" * 50)
        print(f"✅ SUCESSO! FICHEIRO '{nome_arquivo}' GUARDADO COM SUCESSO!")
        print(f"📊 Total de Leads ÚNICOS e validados: {len(leads_processados)}")
        print("A sua base de prospeção B2B está agora IMPLACÁVEL!")

    except Exception as e:
        print("❌ Ups! Erro na extração.")
        print(f"Detalhe: {e}")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)