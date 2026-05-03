# Backend-MahaVoice

Backend API untuk proyek MahaVoice menggunakan Express.js.

## Environment

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_API_VERSION` (default: `v1beta`)
- `GEMINI_MODEL` (default: `gemini-2.5-flash`)
- `YOUTUBE_API_KEY`

Untuk fitur chatbot, tabel `chatbot` tetap memakai kolom `id_chat`, `id_user`, `pesan`, dan `waktu`. Backend menyimpan payload chat sebagai JSON di kolom `pesan` agar role `user` dan `assistant` tetap bisa dibedakan tanpa mengubah skema tabel.

Catatan: jika model Gemini tertentu tidak tersedia untuk akun/API key Anda, backend akan mencoba beberapa model lain secara otomatis. Default yang disarankan adalah `gemini-2.5-flash` melalui API `v1beta`.

## Struktur Folder

```text
Backend-MahaVoice/
	src/
		config/
			env.js
		controllers/
			chat.controller.js
			health.controller.js
		middlewares/
			errorHandler.js
			notFound.js
		routes/
			chat.routes.js
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
- `GET /api/chat/history` - Riwayat chat per user dan session
- `POST /api/chat/message` - Simpan pesan user, panggil Gemini, lalu simpan balasan