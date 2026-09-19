import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime

import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (kept for the template's status demo routes below)
from lib.db import client, db, ensure_indexes


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    yield
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ---------------------------------------------------------------------------
# API gateway — the platform ingress routes /api/* to this service (port 8001)
# while page traffic goes to the frontend (port 3000). The Code Pay app is a
# single Next.js server that serves both its pages and its Route Handlers, so
# this catch-all forwards every /api/* call to the Next.js app and streams the
# response back (cookies — like the httpOnly session — included).
# ---------------------------------------------------------------------------
NEXT_ORIGIN = os.environ.get("NEXT_APP_ORIGIN", "http://localhost:3000")

HOP_BY_HOP = {"host", "content-length", "connection", "accept-encoding", "transfer-encoding", "keep-alive"}


@api_router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy_to_next(request: Request, path: str):
    url = f"{NEXT_ORIGIN}/api/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP}

    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=60) as http:
            upstream = await http.request(
                request.method,
                url,
                content=body if body else None,
                headers=headers,
                cookies=dict(request.cookies),
            )
    except httpx.RequestError as exc:
        logging.error("API proxy request to %s failed: %s", url, exc)
        return StreamingResponse(
            iter([b'{"error":"api_gateway_unreachable"}']),
            status_code=502,
            media_type="application/json",
        )

    resp = StreamingResponse(
        content=iter([upstream.content]),
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )
    # Preserve upstream headers — including every Set-Cookie (multi-value).
    for key, value in upstream.headers.multi_items():
        if key.lower() in ("content-length", "transfer-encoding", "connection", "content-encoding", "date", "content-type"):
            continue
        resp.headers.append(key, value)
    return resp


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
