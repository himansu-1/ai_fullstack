# AI Fullstack (Client + Server)

A full-stack GenAI workflow builder and chat assistant.

- Client: React + Vite + React Flow, authenticated UI for building LLM workflows, uploading PDFs, and chatting.
- Server: FastAPI + SQLAlchemy + Postgres + ChromaDB (persistent embeddings) with WebSocket streaming and REST APIs.

---

## Quick Start (Docker Compose)

Prerequisites: Docker Desktop

1. Create an `.env` in the repo root (values optional for local dev):
```
SECRET_KEY=please_change_me
OPENAI_API_KEY=
DEV_HF_API_KEY=
DEV_GROQ_API_KEY=
HF_INFERENCE_ENDPOINT=
USE_LOCAL_SENTENCE_TRANSFORMERS=false
HF_TIMEOUT=45
```
2. Build and run:
```
docker compose -f docker-composer.yml up --build
```
3. Open:
- Client: http://localhost:3000
- Server: http://localhost:8000/ping

The database and vector store persist in Docker volumes: `pg_data`, `chroma_data`.

---

## Project Structure

```
ai_fullstack/
  client/               # React + Vite SPA (served via nginx in Docker)
  server/               # FastAPI app with Postgres + Chroma
  docker-composer.yml   # Compose for server, client, postgres
```

---

## Client (React + Vite)

### Tech stack
- React 19, TypeScript, Vite
- React Router, React Flow (workflow graph)
- Axios (API), Tailwind CSS v4 via `@tailwindcss/vite`

### Environment variables (Vite)
Create `client/.env` and set:
```
VITE_HF_API_KEY=
VITE_GROQ_API_KEY=
VITE_SERP_API_KEY=
```
These are used as defaults in the initial workflow nodes and can be overridden inside the UI.

### Component tree (high level)
- `App.tsx`
  - `Base` (layout)
    - `Navbar`
    - `Outlet`
  - Routes
    - `/` → `LoginSignup`
    - `/stacks` → `StacksPage` (protected)
    - `/chatAi` → `ChatAi` (protected)

Key view components inside `ChatAi` (React Flow):
- Node types: `UserNode`, `KBNode`, `LLMNode`, `OutputNode`
- Canvas actions: build workflow, edit, chat, import/export

### Authentication system
- Email/password via `/auth/signup` and `/auth/login`
- Stores `access_token` JWT in `localStorage` under `user`
- Axios interceptor attaches `Authorization: Bearer <token>` when present
- Protected routes use `WithAuth` HOC to guard access and redirect to `/`

### Client → Backend API usage
Base URL: `http://localhost:8000/api` (see `client/src/utility/api.ts`)

- Auth
  - POST `/auth/signup` → body: `{ email, password }` → 201 `{ message }`
  - POST `/auth/login` → body: `{ email, password }` → 200 `{ access_token, token_type }`

- Sessions
  - GET `/session/list` → 200 `[{ id, name, description, created_at }]`
  - POST `/session/create` → body: `{ name?, description?, layout? }` → 200 `{ session_id }`
  - GET `/session/{id}` → 200 `SessionDetail`
  - POST `/session/build` → body: `SessionBuildRequest` → 200 `{ session_id }`
  - PATCH `/session/{id}` → body: `SessionEditRequest` → 200 `{ session_id }`

- Knowledge Base (PDF embeddings)
  - POST `/kb/upload` (multipart) → fields: `embeddingProvider, embeddingModel, apiKey, sessionId?, files[]` → 200 `{ document_ids, chunk_ids, chroma_collection }`
  - POST `/kb/query` → body: `{ session_id, query, top_k? }` → 200 `{ context }`

- LLM / Chat
  - POST `/llm/generate` → body: `{ session_id, query, context?, history?, layout? }` → 200 `{ answer }`
  - GET `/llm/history/{session_id}` → 200 `{ messages: [{ role, content }] }`

- WebSocket
  - `ws://localhost:8000/api/ws/chat?token=<jwt>&session_id=<id>`
  - Sends: `{ type:'message', query, context, history }`
  - Receives: `{ type:'message', role:'assistant', content }`

### Example payloads and responses (Client-side usage)

- Signup
```json
POST /api/auth/signup
{
  "email": "test@example.com",
  "password": "123456"
}
// 201
{ "message": "User created successfully" }
```

- Login
```json
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "123456"
}
// 200
{ "access_token": "<jwt>", "token_type": "bearer" }
```

- Create Session
```json
POST /api/session/create
{
  "name": "My Stack",
  "description": "PDF QA"
}
// 200
{ "session_id": 1 }
```

- Build Session
```json
POST /api/session/build
{
  "name": "My Stack",
  "description": "PDF QA",
  "kb": {
    "embeddingProvider": "huggingface",
    "embeddingModel": "sentence-transformers/all-MiniLM-L6-v2",
    "includeContext": true,
    "documentIds": [10, 11],
    "apiKey": "<hf_or_other>"
  },
  "llm": {
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "apiKey": "<groq>",
    "temperature": 0.7,
    "prompt": "You are a helpful assistant.",
    "useWebSearch": false
  }
}
// 200
{ "session_id": 1 }
```

- KB Upload (multipart)
- fields: `embeddingProvider`, `embeddingModel`, `apiKey`, `sessionId`, `files[]`
- response: `{ document_ids: number[], chunk_ids: string[], chroma_collection: string }`

- KB Query
```json
POST /api/kb/query
{
  "session_id": 1,
  "query": "What is the warranty period?",
  "top_k": 4
}
// 200
{ "context": "[Source: doc.pdf]\n..." }
```

- LLM Generate
```json
POST /api/llm/generate
{
  "session_id": 1,
  "query": "Summarize the document",
  "context": "...",
  "history": [{"role":"user","content":"Hi"}]
}
// 200
{ "answer": "Summary ..." }
```

- Chat History
```json
GET /api/llm/history/1
// 200
{ "messages": [{"role":"user","content":"..."},{"role":"assistant","content":"..."}] }
```

### Run client locally (without Docker)
1. Node 18+
2. From `client/`:
```
npm ci
npm run dev
```
3. Open http://localhost:5173
4. Ensure backend at `http://localhost:8000` or update `client/src/utility/api.ts`.

---

## Server (FastAPI)

### Tech stack and key packages
- FastAPI (web framework)
- Uvicorn (ASGI server)
- SQLAlchemy (ORM)
- psycopg2-binary (Postgres driver)
- python-jose, passlib[bcrypt] (JWT auth + password hashing)
- python-multipart (file uploads)
- chromadb (vector store persisted to disk)
- pypdf (PDF parsing)
- openai, google-generativeai, groq, huggingface-hub (LLM/embeddings integrations)
- python-dotenv (env loading)

### Files and responsibilities
- `app/main.py`: FastAPI app, CORS, table creation, include routers, `/ping`
- `app/config.py`: loads env vars (DB URL, secrets, dev defaults, production toggle)
- `app/database.py`: SQLAlchemy engine/session, simple migrations
- `app/models.py`: ORM models and relationships
- `app/schemas.py`: Pydantic request/response models
- `app/dependencies.py`: DB session dependency, JWT auth dependency
- `app/auth.py`: signup/login endpoints (JWT issuance)
- `app/session.py`: session CRUD/build/edit/list/detail
- `app/kb.py`: PDF upload → embeddings in Chroma, KB query
- `app/embed.py`: embeddings pipeline, Chroma persistent client
- `app/llm.py`: generate answers using OpenAI/Gemini/Groq; chat history
- `app/ws.py`: WebSocket chat endpoint

### Data models and relationships
- `User` 1—* `Session`
- `User` 1—* `Document`
- `Session` *—* `Document` via `SessionDocument` association table
- `Session` 1—* `ChatMessage`

Model list: `User`, `Document`, `Session`, `ChatMessage`, plus `SessionDocument` association.

### Routing and endpoints (Server)
Base prefix: `/api`

- Auth (`app/auth.py`)
  - POST `/auth/signup` → body: `{ email, password }` → 201 `{ message }`
  - POST `/auth/login` → body: `{ email, password }` → 200 `{ access_token, token_type }`

- Session (`app/session.py`)
  - GET `/session/list` → 200: `[{ id, name, description, created_at }]`
  - POST `/session/create` → body: `SessionCreateRequest` → 200 `{ session_id }`
  - GET `/session/{id}` → 200 `SessionDetail` (includes documents, KB/LLM configs)
  - POST `/session/build` → body: `SessionBuildRequest` → validates providers, saves row, links docs → 200 `{ session_id }`
  - PATCH `/session/{id}` → body: `SessionEditRequest` → updates configs/docs → 200 `{ session_id }`

- Knowledge Base (`app/kb.py`)
  - POST `/kb/upload` (multipart) → uploads PDFs, extracts text, creates embeddings into Chroma collection per user, stores `Document` rows → 200 `{ document_ids, chunk_ids, chroma_collection }`
  - POST `/kb/query` → queries Chroma collection for session and returns concatenated context → 200 `{ context }`

- LLM (`app/llm.py`)
  - POST `/llm/generate` → runs provider-specific completion; persists messages → 200 `{ answer }`
  - GET `/llm/history/{session_id}` → returns persisted `ChatMessage`s → 200 `{ messages }`

- WebSocket (`app/ws.py`)
  - `/ws/chat` (no prefix in router, mounted under `/api`) → authenticate via `token` query param (JWT); `session_id` required; streams assistant messages in JSON.

### Example payloads and responses (Server)
See client section for the same JSON examples; schemas are defined in `app/schemas.py`:
- `SessionBuildRequest`, `SessionEditRequest`, `KBQueryRequest`, `LLMGenerateRequest`, `Token`, `SessionDetail`, etc.

### WebSocket behavior
- Connect to: `ws://<host>:8000/api/ws/chat?token=<jwt>&session_id=<id>`
- Server validates JWT (`SECRET_KEY`, `ALGORITHM`) and session-user ownership.
- Message loop:
  - Client sends `{"type":"message","query":"...","context":"...","history":[...]}`
  - Server executes provider call (OpenAI/Gemini/Groq) based on `Session` settings, persists both user and assistant messages, and responds with `{"type":"message","role":"assistant","content":"..."}`.
- On error, server sends an error content string; client can fallback to HTTP `/llm/generate`.

### Running the server locally (without Docker)
1. Python 3.11, Postgres running (db: `workflowdb`, user: `postgres`, pass: `postgres`)
2. Create and activate venv:
```
cd server
python -m venv venv
venv\Scripts\activate  # Windows
pip install --no-cache-dir -r requirements.txt
```
3. Set environment variables (examples):
```
set DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/workflowdb
set SECRET_KEY=please_change_me
set ALGORITHM=HS256
set FRONTEND_ORIGIN=http://localhost:5173
set CHROMA_PATH=./chroma_store
set DEV_HF_API_KEY=
set DEV_GROQ_API_KEY=
```
4. Run API:
```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Full folder trees

### Client
```
client/
  Dockerfile
  eslint.config.js
  index.html
  package-lock.json
  package.json
  public/
    vite.svg
  README.md
  src/
    App.tsx
    assets/
      react.svg
    index.css
    main.tsx
    utility/
      api.ts
    vite-env.d.ts
  tsconfig.app.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  nginx.conf
```

### Server
```
server/
  Dockerfile
  requirements.txt
  app/
    __init__.py
    auth.py
    chat.py
    config.py
    database.py
    dependencies.py
    embed.py
    kb.py
    llm.py
    main.py
    models.py
    schemas.py
    session.py
    ws.py
  chroma_store/
    chroma.sqlite3
    <collection data files>
  venv/
```

---

## Notes
- In development, the server can automatically use dev keys (HF/Groq) if `PRODUCTION_MODE` is not set to true.
- For production, set `PRODUCTION_MODE=true` and provide real API keys; review `FRONTEND_ORIGIN`, `ALGORITHM`, `SECRET_KEY`.
- Chroma persistent path is configurable via `CHROMA_PATH`.
