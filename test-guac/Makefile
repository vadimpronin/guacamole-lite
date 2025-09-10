.PHONY: help up down build clean logs client admin demo

help: ## Show this help message
	@echo "Enhanced GuacamoleLite test-guac environment with multi-guacd routing"
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	@echo "Starting enhanced GuacamoleLite test environment..."
	@echo "Features: Multi-guacd routing, session join tracking, admin dashboard"
	docker-compose up -d
	@echo ""
	@echo "Services started:"
	@echo "  - Client interface:  http://localhost:9090"
	@echo "  - Admin dashboard:   http://localhost:9092"
	@echo "  - guacd instances:   guacd-1, guacd-2, guacd-3"
	@echo ""
	@echo "Demo steps:"
	@echo "  1. Open client interface and create connections on different guacd instances"
	@echo "  2. Copy session IDs and join them from another browser tab"
	@echo "  3. Watch the admin dashboard for real-time session join tracking"

down: ## Stop all services
	docker-compose down

build: ## Build all containers
	docker-compose build

clean: ## Remove all containers and volumes
	docker-compose down -v --remove-orphans
	docker system prune -f

logs: ## Show logs from all services
	docker-compose logs -f

client: ## Open client interface in browser
	@echo "Opening client interface..."
	@open http://localhost:9090 2>/dev/null || xdg-open http://localhost:9090 2>/dev/null || echo "Open http://localhost:9090 in your browser"

admin: ## Open admin dashboard in browser
	@echo "Opening admin dashboard..."
	@open http://localhost:9092 2>/dev/null || xdg-open http://localhost:9092 2>/dev/null || echo "Open http://localhost:9092 in your browser"

demo: up ## Start services and open demo interfaces
	@echo "Waiting for services to start..."
	@sleep 10
	@make client
	@sleep 2
	@make admin
	@echo ""
	@echo "Demo environment ready!"
	@echo ""
	@echo "Try this demo scenario:"
	@echo "  1. Create a new connection on guacd-1"
	@echo "  2. Copy the session ID from the connection header"
	@echo "  3. Open a new browser tab, choose 'Join Connection', paste the ID"
	@echo "  4. Watch the admin dashboard show the join tracking in real-time"
	@echo "  5. Try connecting to different guacd instances and joining across them"