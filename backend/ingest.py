import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

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
    "https://wiki.polkadot.network/docs/learn-governance",
    "https://wiki.polkadot.network/docs/learn-bridges",
    "https://wiki.polkadot.network/docs/build-substrate",
    "https://wiki.polkadot.network/docs/learn-consensus",
]


def scrape_page(url: str) -> str:
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["nav", "header", "footer", "script", "style"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        print(f"✅ Scraped: {url}")
        return text
    except Exception as e:
        print(f"❌ Failed: {url} — {e}")
        return ""


def ingest():
    print("🚀 Starting ingestion...")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    all_documents = []

    for url in DOCS_URLS:
        text = scrape_page(url)
        if not text:
            continue
        chunks = splitter.split_text(text)
        for chunk in chunks:
            all_documents.append(Document(page_content=chunk, metadata={"source": url}))

    print(f"✂️  Created {len(all_documents)} chunks from {len(DOCS_URLS)} pages")

    print("🔮 Embedding and storing in ChromaDB...")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    Chroma.from_documents(
        documents=all_documents,
        embedding=embeddings,
        persist_directory="./chroma_db",
    )

    print(f"✅ Ingestion complete! {len(all_documents)} chunks stored in ChromaDB")


if __name__ == "__main__":
    ingest()
