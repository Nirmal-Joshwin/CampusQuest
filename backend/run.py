import uvicorn
import os
from app.config import settings

if __name__ == "__main__":
    port = int(os.getenv("PORT", settings.PORT))
    host = os.getenv("HOST", settings.HOST)
    print(f"Starting CampusQuest FastAPI backend on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)

