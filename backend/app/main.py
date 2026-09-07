from fastapi import FastAPI

app = FastAPI(title="Micro Automation Hub")

@app.get("/health")
def health_check():
    return {"status": "ok"}
