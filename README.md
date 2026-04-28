# Backend-MahaVoice

Backend API untuk proyek MahaVoice menggunakan Express.js.

## Struktur Folder

```text
Backend-MahaVoice/
	src/
		config/
			env.js
		controllers/
			health.controller.js
		middlewares/
			errorHandler.js
			notFound.js
		routes/
			health.routes.js
			index.js
		app.js
		server.js
	.env.example
	.gitignore
	package.json
```

## Menjalankan Project

1. Install dependencies:

```bash
npm install
```

2. Salin file environment:

```bash
copy .env.example .env
```

3. Jalankan server development:

```bash
npm run dev
```

Server akan berjalan di `http://localhost:5000` (default).

## Endpoint Awal

- `GET /` - Welcome route
- `GET /api/health` - Health check