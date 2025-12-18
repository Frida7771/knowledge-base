from elasticsearch import Elasticsearch
from typing import Optional
from define import ELASTICSEARCH_URL

_es_client: Optional[Elasticsearch] = None


def get_es_client() -> Elasticsearch:
    """get Elasticsearch client (singleton pattern)"""
    global _es_client
    if _es_client is None:
        _es_client = Elasticsearch([ELASTICSEARCH_URL])
    return _es_client

