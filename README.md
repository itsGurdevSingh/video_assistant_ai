# Video Assistant AI

Local-first video understanding assistant. Upload a video, let the background worker extract and transcribe its audio, generate transcript embeddings, and ask grounded questions with timestamp sources.

## Features

- User registration, login, bearer sessions, and video ownership checks
- Streaming multipart uploads to local storage
- Durable PostgreSQL-backed processing queue with a separate worker
- FFmpeg audio extraction and Whisper.cpp transcription
- Transcript chunking, TEI embeddings, and pgvector retrieval
- Persistent video-scoped conversations and streamed chat responses
- Markdown assistant messages with clickable timestamp sources
- Authenticated video playback and a persisted video library
- Playwright demo recording workflow

## Architecture

```text
Next.js web app :3000
	|
Fastify API :3001 ---- PostgreSQL + pgvector :5432
	|\
	| \-- Whisper.cpp :8080
	| \-- TEI embeddings :8081
	|
Video worker -- claims queued videos from PostgreSQL
```

The API stores uploaded media under `MEDIA_STORAGE_PATH` and creates a queued video record. The worker claims queued jobs with PostgreSQL row locking and runs extraction, chunking, transcription, and embedding independently from the HTTP process.

## Requirements

- Node.js 22+
- pnpm 12+
- Docker Desktop
- A Whisper model at `docker/whisper/models/ggml-base.bin`
- A Mistral API key for chat responses

## Configuration

Create a root `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/video_assistant
MISTRAL_API_KEY=your_mistral_api_key
WEB_ORIGIN=http://localhost:3000
MEDIA_STORAGE_PATH=./data
WHISPER_BASE_URL=http://localhost:8080
EMBEDDINGS_BASE_URL=http://localhost:8081
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

Do not commit `.env` or real credentials.

## Run Locally

Install dependencies and start infrastructure:

```powershell
pnpm install
docker compose up -d
```

Apply database migrations:

```powershell
pnpm --filter @video-assistant/db db:migrate
```

Start the API, worker, and web app in separate terminals:

```powershell
pnpm --filter @video-assistant/api dev
pnpm --filter @video-assistant/api dev:worker
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is available at [http://localhost:3001/health](http://localhost:3001/health).

## Demo Recording

The generated demo is available at [demo/recordings/video-assistant-demo.webm](demo/recordings/video-assistant-demo.webm).

The reusable recorder uses an existing account and saved videos. Pass credentials through the environment; they are not stored in the script:

```powershell
$env:DEMO_EMAIL = "your_demo_email"
$env:DEMO_PASSWORD = "your_demo_password"
pnpm exec node demo/record-demo.mjs
```

The recorder saves a new WebM file under `demo/recordings/` and logs each step in the terminal.

## Validation

```powershell
pnpm exec turbo run build
pnpm --filter web lint
```

The API, worker, database, media, AI, and web packages are organized under `apps/` and `packages/`.
