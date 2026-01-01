from openai import OpenAI
from define import OPENAI_API_KEY
from typing import Optional, List, Dict

_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    """get OpenAI client (singleton pattern)"""
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY 未配置，请在 .env 文件中设置")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def chat_completion(messages: List[Dict[str, str]], model: str = "gpt-4o") -> str:
    """
    OpenAI chat completion interface
    
    Args:
        messages: message list, format: [{"role": "user", "content": "..."}]
        model: the model to use, default is gpt-4o
    
    Returns:
        the text content returned by the model
    """
    client = get_openai_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages
    )
    return response.choices[0].message.content


def stream_chat_completion(messages: List[Dict[str, str]], model: str = "gpt-4o"):
    client = get_openai_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def create_embeddings(text: str, model: str = "text-embedding-ada-002") -> List[float]:
    """
    create text embedding vector
    
    Args:
        text: the text to embed
        model: the embedding model to use, default is text-embedding-ada-002
    
    Returns:
        the list of embedding vectors
    """
    client = get_openai_client()
    response = client.embeddings.create(
        model=model,
        input=text
    )
    return response.data[0].embedding

