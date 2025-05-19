.PHONY: up down

# Spin everything up
up:
	docker compose up --build -d
	@echo "Open your browser at http://127.0.0.1:9090/"

# Tear everything down and erase volumes/left-overs
down:
	docker compose down -v --remove-orphans
