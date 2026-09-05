# ╔══════════════════════════════════════════════════════════════╗
# ║        GenPosFit — Genryphem Posture and Fit                 ║
# ║        Makefile: Command operasional Docker + Database + Dev ║
# ╚══════════════════════════════════════════════════════════════╝

# ------------------------- KONFIGURASI ------------------------
COMPOSE        := docker compose
COMPOSE_FILE   := docker-compose.yml

SERVICE_DB       := db
SERVICE_BACKEND  := backend
SERVICE_FRONTEND := frontend
SERVICE_PMA      := phpmyadmin

DB_NAME          := genposfit
DB_USER          := genposfit_user
DB_PASSWORD      := genposfit_secret
DB_ROOT_PASSWORD := root_secret
DB_CONTAINER     := genposfit-db

BACKUP_DIR       := ./backups
SEED_DIR         := ./database/seed

COLOR_RESET  := \033[0m
COLOR_GREEN  := \033[32m
COLOR_YELLOW := \033[33m
COLOR_CYAN   := \033[36m

.DEFAULT_GOAL := help
.PHONY: help up up-detached down restart stop start build rebuild ps logs \
        logs-backend logs-frontend logs-db health \
        db db-root db-create db-drop db-tables db-count db-dump db-restore \
        migrate seed reseed seed-dummy \
        shell-backend shell-frontend shell-db \
        install-backend install-frontend lint-backend lint-frontend \
        repair doctor clean nuke destroy


# ════════════════════════════════════════════════════════════════
# HELP
# ════════════════════════════════════════════════════════════════
help: ## Tampilkan daftar semua command yang tersedia
	@echo ""
	@echo "$(COLOR_CYAN)  GenPosFit — Genryphem Posture and Fit$(COLOR_RESET)"
	@echo "$(COLOR_CYAN)  Command Operasional$(COLOR_RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(COLOR_GREEN)%-20s$(COLOR_RESET) %s\n", $$1, $$2}'
	@echo ""


# ════════════════════════════════════════════════════════════════
# DOCKER — LIFECYCLE UTAMA
# ════════════════════════════════════════════════════════════════

up: ## [Docker] Build (jika perlu) + jalankan semua container di foreground
	$(COMPOSE) up

up-detached: ## [Docker] Jalankan semua container di background (mode daemon)
	$(COMPOSE) up -d
	@echo "$(COLOR_GREEN)✔ Semua service GenPosFit berjalan$(COLOR_RESET)"
	@echo "  Frontend   → http://localhost:3042"
	@echo "  Backend    → http://localhost:8042/docs"
	@echo "  PhpMyAdmin → http://localhost:8122"

down: ## [Docker] Stop dan hapus semua container (data volume tetap aman)
	$(COMPOSE) down

stop: ## [Docker] Stop semua container tanpa menghapus
	$(COMPOSE) stop

start: ## [Docker] Start kembali container yang di-stop
	$(COMPOSE) start

restart: ## [Docker] Restart semua container
	$(COMPOSE) restart
	@echo "$(COLOR_GREEN)✔ Semua container di-restart$(COLOR_RESET)"

restart-backend: ## [Docker] Restart hanya service backend
	$(COMPOSE) restart $(SERVICE_BACKEND)

restart-frontend: ## [Docker] Restart hanya service frontend
	$(COMPOSE) restart $(SERVICE_FRONTEND)

restart-db: ## [Docker] Restart hanya service database
	$(COMPOSE) restart $(SERVICE_DB)


# ════════════════════════════════════════════════════════════════
# DOCKER — BUILD
# ════════════════════════════════════════════════════════════════

build: ## [Docker] Build semua image (backend, frontend)
	$(COMPOSE) build

build-backend: ## [Docker] Build ulang image backend saja
	$(COMPOSE) build $(SERVICE_BACKEND)

build-frontend: ## [Docker] Build ulang image frontend saja
	$(COMPOSE) build $(SERVICE_FRONTEND)

rebuild: ## [Docker] Build ulang SEMUA image tanpa cache (fresh build)
	$(COMPOSE) build --no-cache

rebuild-backend: ## [Docker] Build ulang backend tanpa cache
	$(COMPOSE) build --no-cache $(SERVICE_BACKEND)

rebuild-frontend: ## [Docker] Build ulang frontend tanpa cache
	$(COMPOSE) build --no-cache $(SERVICE_FRONTEND)


# ════════════════════════════════════════════════════════════════
# DOCKER — MONITORING & STATUS
# ════════════════════════════════════════════════════════════════

ps: ## [Docker] Lihat status semua container
	$(COMPOSE) ps

logs: ## [Docker] Lihat log semua service (live follow)
	$(COMPOSE) logs -f --tail=100

logs-backend: ## [Docker] Lihat log backend saja
	$(COMPOSE) logs -f --tail=100 $(SERVICE_BACKEND)

logs-frontend: ## [Docker] Lihat log frontend saja
	$(COMPOSE) logs -f --tail=100 $(SERVICE_FRONTEND)

logs-db: ## [Docker] Lihat log database saja
	$(COMPOSE) logs -f --tail=100 $(SERVICE_DB)

health: ## [Docker] Cek health status semua service
	@echo "$(COLOR_CYAN)── Health Check GenPosFit ──$(COLOR_RESET)"
	@docker inspect --format='{{.Name}}: {{.State.Health.Status}}' $(DB_CONTAINER) 2>/dev/null || \
		echo "  db: tidak berjalan"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

doctor: ## 🔍 Diagnostik menyeluruh: port, image, container, env, konfigurasi
	@echo ""
	@echo "$(COLOR_CYAN)╔══════════════════════════════════════════════════════════════╗$(COLOR_RESET)"
	@echo "$(COLOR_CYAN)║           GenPosFit — Diagnostic Scan                      ║$(COLOR_RESET)"
	@echo "$(COLOR_CYAN)╚══════════════════════════════════════════════════════════════╝$(COLOR_RESET)"
	@echo ""
	@# ── 1. Environment ──
	@echo "$(COLOR_YELLOW)── 1. Environment (.env) ──$(COLOR_RESET)"
	@if [ ! -f .env ]; then \
		echo "  ⚠ .env tidak ditemukan, copy dari .env.example"; \
		cp .env.example .env; \
	else \
		echo "  ✔ .env ada"; \
	fi
	@$(eval DB_PORT := $(shell grep '^DB_PORT=' .env | cut -d= -f2))
	@$(eval BACKEND_PORT := $(shell grep '^BACKEND_PORT=' .env | cut -d= -f2))
	@$(eval FRONTEND_PORT := $(shell grep '^FRONTEND_PORT=' .env | cut -d= -f2))
	@$(eval PMA_PORT := $(shell grep '^PMA_PORT=' .env | cut -d= -f2))
	@echo "     DB_PORT=$(DB_PORT)   BACKEND_PORT=$(BACKEND_PORT)   FRONTEND_PORT=$(FRONTEND_PORT)   PMA_PORT=$(PMA_PORT)"
	@if [ "$(DB_PORT)" != "3348" ] || [ "$(BACKEND_PORT)" != "8042" ] || [ "$(FRONTEND_PORT)" != "3042" ] || [ "$(PMA_PORT)" != "8122" ]; then \
		echo "  ⚠ Beberapa port tidak sesuai ekspektasi (3348/8042/3042/8122)!"; \
	else \
		echo "  ✔ Port sesuai formula +42"; \
	fi
	@echo ""
	@# ── 2. Port conflict (apakah port sudah dipakai container lain) ──
	@echo "$(COLOR_YELLOW)── 2. Port Conflict ──$(COLOR_RESET)"
	@for port in 3348 8042 3042 8122; do \
		used=$$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ":$$port->|:$$port-" | head -1); \
		if [ -n "$$used" ]; then \
			echo "  ✔ :$$port → $$used"; \
		else \
			echo "  ⚠ :$$port → tidak ada container yang memakainya (mungkin belum up)"; \
		fi; \
	done
	@echo ""
	@# ── 3. Container status ──
	@echo "$(COLOR_YELLOW)── 3. Container Status ──$(COLOR_RESET)"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  ❌ Tidak bisa membaca status container"
	@echo ""
	@# ── 4. Image freshness ──
	@echo "$(COLOR_YELLOW)── 4. Image Freshness ──$(COLOR_RESET)"
	@echo "  backend:   dicek via hash perubahan kode"
	@echo "  frontend:  dicek via hash perubahan kode"
	@echo "  mysql:8.0  $(shell docker images --format '{{.Repository}}:{{.Tag}} ({{.CreatedAt}})' mysql:8.0 2>/dev/null || echo 'tidak ada')"
	@echo "  phpmyadmin:latest $(shell docker images --format '{{.Repository}}:{{.Tag}} ({{.CreatedAt}})' phpmyadmin:latest 2>/dev/null || echo 'tidak ada')"
	@echo ""
	@# ── 5. Docker Compose config ──
	@echo "$(COLOR_YELLOW)── 5. Docker Compose Config ──$(COLOR_RESET)"
	@$(COMPOSE) config 2>&1 | grep -E 'image:|container_name:|ports:' | head -12
	@echo ""
	@# ── 6. Backend health ──
	@echo "$(COLOR_YELLOW)── 6. Backend API Health ──$(COLOR_RESET)"
	@curl -s -o /dev/null -w "  HTTP %{http_code}" http://localhost:$(BACKEND_PORT)/api/health 2>/dev/null && echo " ✔" || echo "  ❌ Tidak dapat dijangkau"
	@echo ""
	@echo "$(COLOR_GREEN)✔ Diagnostik selesai$(COLOR_RESET)"

repair: ## 🔧 Perbaiki otomatis: cleanup orphan containers, rebuild stale images, restart, verifikasi
	@echo ""
	@echo "$(COLOR_CYAN)╔══════════════════════════════════════════════════════════════╗$(COLOR_RESET)"
	@echo "$(COLOR_CYAN)║           GenPosFit — Repair Mode                          ║$(COLOR_RESET)"
	@echo "$(COLOR_CYAN)╚══════════════════════════════════════════════════════════════╝$(COLOR_RESET)"
	@echo ""
	@# 1. Cek .env
	@if [ ! -f .env ]; then \
		echo "  ⚠ .env tidak ditemukan, meng-copy dari .env.example..."; \
		cp .env.example .env; \
	fi
	@# 2. Hapus container orphan (dari build gagal / image lama)
	@echo "$(COLOR_YELLOW)➜ Membersihkan container orphan...$(COLOR_RESET)"
	-$(COMPOSE) down --remove-orphans 2>/dev/null
	@echo ""
	@# 3. Pull image eksternal (mysql, phpmyadmin)
	@echo "$(COLOR_YELLOW)➜ Menarik image eksternal terbaru...$(COLOR_RESET)"
	@docker pull mysql:8.0 2>/dev/null | tail -1
	@docker pull phpmyadmin:latest 2>/dev/null | tail -1
	@echo ""
	@# 4. Build ulang image lokal (backend, frontend) tanpa cache
	@echo "$(COLOR_YELLOW)➜ Build ulang image lokal (backend, frontend)...$(COLOR_RESET)"
	$(COMPOSE) build --no-cache backend frontend
	@echo ""
	@# 5. Start container
	@echo "$(COLOR_YELLOW)➜ Menjalankan ulang semua container...$(COLOR_RESET)"
	$(COMPOSE) up -d
	@echo ""
	@# 6. Tunggu health check
	@echo "$(COLOR_YELLOW)➜ Menunggu container siap...$(COLOR_RESET)"
	@sleep 5
	-$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@# 7. Verifikasi backend API
	@echo "$(COLOR_YELLOW)➜ Verifikasi backend API...$(COLOR_RESET)"
	@for i in 1 2 3 4 5; do \
		code=$$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8042/api/health 2>/dev/null); \
		if [ "$$code" = "200" ]; then \
			echo "  ✔ Backend ready (HTTP 200)"; \
			break; \
		fi; \
		echo "  ⏳ Menunggu backend ($$i/5)..."; \
		sleep 3; \
	done
	@echo ""
	@# 8. Verifikasi frontend
	@echo "$(COLOR_YELLOW)➜ Verifikasi frontend...$(COLOR_RESET)"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3042 2>/dev/null); \
	if [ "$$code" = "200" ]; then \
		echo "  ✔ Frontend ready (HTTP $$code)"; \
	else \
		echo "  ⚠ Frontend HTTP $$code (mungkin butuh loading)"; \
	fi
	@echo ""
	@# 9. Laporan akhir
	@echo "$(COLOR_GREEN)╔══════════════════════════════════════════════════════════════╗$(COLOR_RESET)"
	@echo "$(COLOR_GREEN)║            Repair selesai — semua service berjalan            ║$(COLOR_RESET)"
	@echo "$(COLOR_GREEN)╚══════════════════════════════════════════════════════════════╝$(COLOR_RESET)"
	@echo "  Frontend   → http://localhost:3042"
	@echo "  Backend    → http://localhost:8042/docs"
	@echo "  PhpMyAdmin → http://localhost:8122"


# ════════════════════════════════════════════════════════════════
# DATABASE — MYSQL
# ════════════════════════════════════════════════════════════════

db: ## [DB] Masuk MySQL shell sebagai user aplikasi
	@echo "$(COLOR_YELLOW)→ Masuk MySQL: $(DB_NAME)$(COLOR_RESET)"
	$(COMPOSE) exec $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME)

db-root: ## [DB] Masuk MySQL shell sebagai root
	$(COMPOSE) exec $(SERVICE_DB) mysql -uroot -p$(DB_ROOT_PASSWORD)

db-create: ## [DB] Buat database genposfit (jika belum ada)
	$(COMPOSE) exec $(SERVICE_DB) mysql -uroot -p$(DB_ROOT_PASSWORD) \
		-e "CREATE DATABASE IF NOT EXISTS $(DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@echo "$(COLOR_GREEN)✔ Database $(DB_NAME) siap$(COLOR_RESET)"

db-drop: ## [DB] HAPUS database genposfit (semua data hilang!)
	@read -p "⚠ Yakin hapus database $(DB_NAME)? (y/N): " ok && \
		[ "$$ok" = "y" ] && \
		$(COMPOSE) exec $(SERVICE_DB) mysql -uroot -p$(DB_ROOT_PASSWORD) \
		-e "DROP DATABASE IF EXISTS $(DB_NAME);" && \
		echo "$(COLOR_GREEN)✔ Database dihapus$(COLOR_RESET)" || \
		echo "Dibatalkan."

db-tables: ## [DB] Lihat daftar tabel di database
	$(COMPOSE) exec $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		-e "SHOW TABLES;"

db-count: ## [DB] Hitung jumlah baris semua tabel utama
	$(COMPOSE) exec $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		-e "SELECT 'users' AS tabel, COUNT(*) AS jumlah FROM users \
		    UNION ALL SELECT 'pose_baseline', COUNT(*) FROM pose_baseline \
		    UNION ALL SELECT 'posture_logs', COUNT(*) FROM posture_logs \
		    UNION ALL SELECT 'exercises', COUNT(*) FROM exercises;"

db-dump: ## [DB] Export seluruh database ke file .sql
	@mkdir -p $(BACKUP_DIR)
	@$(COMPOSE) exec $(SERVICE_DB) mysqldump -uroot -p$(DB_ROOT_PASSWORD) $(DB_NAME) \
		> $(BACKUP_DIR)/genposfit_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(COLOR_GREEN)✔ Backup tersimpan di $(BACKUP_DIR)/$(COLOR_RESET)"

db-restore: ## [DB] Restore database dari file .sql (make db-restore FILE=path/to/file.sql)
	@test -n "$(FILE)" || (echo "$(COLOR_YELLOW)Pemakaian: make db-restore FILE=backups/genposfit_20240101.sql$(COLOR_RESET)" && exit 1)
	$(COMPOSE) exec -T $(SERVICE_DB) mysql -uroot -p$(DB_ROOT_PASSWORD) $(DB_NAME) < $(FILE)
	@echo "$(COLOR_GREEN)✔ Database di-restore dari $(FILE)$(COLOR_RESET)"


# ════════════════════════════════════════════════════════════════
# MIGRATION & SEEDING
# ════════════════════════════════════════════════════════════════

migrate: ## [DB] Jalankan skema tabel + upgrade kolom baru (idempotent, aman diulang)
	$(COMPOSE) exec -T $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		< ./database/init/01_schema.sql
	$(COMPOSE) exec -T $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		< ./database/init/02_migrate.sql
	@echo "$(COLOR_GREEN)✔ Migrasi skema & upgrade kolom selesai$(COLOR_RESET)"

seed: ## [DB] Isi data awal (latihan, config) tanpa menghapus data lama
	$(COMPOSE) exec -T $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		< $(SEED_DIR)/seed.sql
	@echo "$(COLOR_GREEN)✔ Seed data selesai$(COLOR_RESET)"

reseed: ## [DB] RESET TOTAL: drop tabel → migrasi ulang → seed ulang
	@echo "$(COLOR_YELLOW)→ Me-reset database GenPosFit...$(COLOR_RESET)"
	$(COMPOSE) exec -T $(SERVICE_DB) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME) \
		-e "SET FOREIGN_KEY_CHECKS=0; \
		    DROP TABLE IF EXISTS exercise_sessions, posture_logs, \
		    pose_baseline, exercises, users; \
		    SET FOREIGN_KEY_CHECKS=1;"
	$(MAKE) migrate
	$(MAKE) seed
	@echo "$(COLOR_GREEN)✔ Database berhasil di-reseed$(COLOR_RESET)"

seed-dummy: ## [DB] Isi data dummy pengguna untuk development/testing
	$(COMPOSE) exec $(SERVICE_BACKEND) python $(SEED_DIR)/seed_user.py
	@echo "$(COLOR_GREEN)✔ Data dummy user dibuat$(COLOR_RESET)"


# ════════════════════════════════════════════════════════════════
# SHELL — MASUK CONTAINER
# ════════════════════════════════════════════════════════════════

shell-backend: ## [Shell] Masuk terminal backend (bash)
	docker exec -it genposfit-backend bash

shell-frontend: ## [Shell] Masuk terminal frontend (sh)
	docker exec -it genposfit-frontend sh

shell-db: ## [Shell] Masuk terminal container database
	docker exec -it $(DB_CONTAINER) bash


# ════════════════════════════════════════════════════════════════
# DEVELOPMENT — INSTALL & LINT
# ════════════════════════════════════════════════════════════════

install-backend: ## [Dev] Install ulang dependency Python di container backend
	$(COMPOSE) exec $(SERVICE_BACKEND) pip install -r requirements.txt

install-frontend: ## [Dev] Install ulang npm package di container frontend
	$(COMPOSE) exec $(SERVICE_FRONTEND) npm install

lint-backend: ## [Dev] Cek kualitas kode backend (ruff)
	$(COMPOSE) exec $(SERVICE_BACKEND) ruff check app/

lint-frontend: ## [Dev] Cek kualitas kode frontend (eslint)
	$(COMPOSE) exec $(SERVICE_FRONTEND) npm run lint


# ════════════════════════════════════════════════════════════════
# CLEANUP — HATI-HATI
# ════════════════════════════════════════════════════════════════

clean: ## [Clean] Stop semua + hapus container & network (volume data AMAN)
	$(COMPOSE) down --remove-orphans
	@echo "$(COLOR_GREEN)✔ Container dibersihkan, data database tetap tersimpan$(COLOR_RESET)"

nuke: ## [Clean] Stop semua + HAPUS VOLUME DATABASE (semua data hilang!)
	@read -p "⚠⚠ SEMUA DATA DATABASE AKAN HILANG. Lanjut? (y/N): " ok && \
		[ "$$ok" = "y" ] && $(COMPOSE) down -v --remove-orphans && \
		echo "$(COLOR_GREEN)✔ Semua container + volume dihapus$(COLOR_RESET)" || \
		echo "Dibatalkan."

destroy: ## [Clean] Total wipe: container + volume + image (dari nol lagi)
	@read -p "⚠⚠⚠ HAPUS SEMUA (container+volume+image)? (y/N): " ok && \
		[ "$$ok" = "y" ] && $(COMPOSE) down -v --rmi all --remove-orphans && \
		echo "$(COLOR_GREEN)✔ Environment GenPosFit dihapus total$(COLOR_RESET)" || \
		echo "Dibatalkan."
