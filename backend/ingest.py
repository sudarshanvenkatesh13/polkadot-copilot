import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

# Polkadot docs URLs to scrape
DOCS_URLS = [
    "https://wiki.polkadot.network/docs/getting-started",
    "https://wiki.polkadot.network/docs/learn-architecture",
    "https://wiki.polkadot.network/docs/learn-parachains",
    "https://wiki.polkadot.network/docs/learn-xcm",
    "https://wiki.polkadot.network/docs/learn-staking",
    "https://wiki.polkadot.network/docs/learn-accounts",
    "https://wiki.polkadot.network/docs/learn-transactions",
    "https://wiki.polkadot.network/docs/build-guide",
    "https://wiki.polkadot.network/docs/build-pdk",
    "https://wiki.polkadot.network/docs/maintain-guides-how-to-validate-polkadot",
]

def scrape_page(url: str) -> str:
    """Scrape text content from a single page"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove nav, header, footer noise
        for tag in soup(["nav", "header", "footer", "script", "style"]):
            tag.decompose()
        
        text = soup.get_text(separator=" ", strip=True)
        print(f"✅ Scraped: {url}")
        return text
    except Exception as e:
        print(f"❌ Failed: {url} — {e}")
        return ""

def ingest():
    """Scrape docs, chunk, embed and store in ChromaDB"""
    print("🚀 Starting ingestion...")
    
    # Scrape all pages
    all_texts = []
    for url in DOCS_URLS:
        text = scrape_page(url)
        if text:
            all_texts.append(text)
    
    print(f"\n📄 Scraped {len(all_texts)} pages")
    
    # Chunk the text
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = splitter.create_documents(all_texts)
    print(f"✂️  Created {len(chunks)} chunks")
    
    # Embed and store in ChromaDB
    print("🔮 Embedding and storing in ChromaDB...")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory="./chroma_db"
    )
    
    print(f"\n✅ Ingestion complete! {len(chunks)} chunks stored in ChromaDB")

if __name__ == "__main__":
    ingest()