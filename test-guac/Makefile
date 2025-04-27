.PHONY: up down

# Spin everything up
up:
	docker compose up --build -d

# Tear everything down and erase volumes/left-overs
down:
	docker compose down -v --remove-orphans
