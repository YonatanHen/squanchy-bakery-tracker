from app.api import api_v1


@api_v1.get("/health")
def health():
    return {"status": "ok"}
