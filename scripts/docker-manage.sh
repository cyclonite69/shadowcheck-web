#!/bin/bash
# ShadowCheck Docker Management Script
# Manages PostgreSQL infrastructure and application services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
function print_header() {
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}================================${NC}"
}

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_error() {
    echo -e "${RED}✗${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if .env exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
        print_warning "Please update .env with your credentials before starting services"
        exit 0
    else
        print_error ".env.example not found. Please create .env manually"
        exit 1
    fi
fi

# Commands
case "${1:-help}" in
    start-db)
        print_header "Starting PostgreSQL Infrastructure"
        docker-compose -f docker-compose.postgres.yml up -d
        print_success "PostgreSQL infrastructure started"
        echo ""
        echo "Waiting for PostgreSQL to be healthy..."
        sleep 5
        docker-compose -f docker-compose.postgres.yml ps
        ;;

    stop-db)
        print_header "Stopping PostgreSQL Infrastructure"
        docker-compose -f docker-compose.postgres.yml stop
        print_success "PostgreSQL infrastructure stopped"
        ;;

    restart-db)
        print_header "Restarting PostgreSQL Infrastructure"
        docker-compose -f docker-compose.postgres.yml restart
        print_success "PostgreSQL infrastructure restarted"
        ;;

    start-app)
        print_header "Starting Application Services"
        docker-compose up -d
        print_success "Application services started"
        docker-compose ps
        ;;

    stop-app)
        print_header "Stopping Application Services"
        docker-compose stop
        print_success "Application services stopped"
        ;;

    start-all)
        print_header "Starting All Services"
        echo "1. Starting PostgreSQL infrastructure..."
        docker-compose -f docker-compose.postgres.yml up -d
        sleep 8
        echo ""
        echo "2. Starting application services..."
        docker-compose up -d
        print_success "All services started"
        echo ""
        echo "Service Status:"
        docker ps --filter "name=shadowcheck" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;

    stop-all)
        print_header "Stopping All Services"
        docker-compose stop
        docker-compose -f docker-compose.postgres.yml stop
        print_success "All services stopped"
        ;;

    restart-all)
        print_header "Restarting All Services"
        $0 stop-all
        sleep 3
        $0 start-all
        ;;

    status)
        print_header "Service Status"
        docker ps --filter "name=shadowcheck" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "Network:"
        docker network inspect shadowcheck_net --format '{{.Name}}: {{len .Containers}} containers' 2>/dev/null || echo "shadowcheck_net: Not created"
        ;;

    logs-db)
        docker-compose -f docker-compose.postgres.yml logs -f postgres
        ;;

    logs-app)
        docker-compose logs -f api
        ;;

    logs-all)
        docker-compose -f docker-compose.postgres.yml logs -f &
        docker-compose logs -f
        ;;

    clean)
        print_warning "This will remove all stopped containers and unused volumes"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down
            docker-compose -f docker-compose.postgres.yml down
            print_success "Containers removed (volumes preserved)"
        fi
        ;;

    clean-all)
        print_error "WARNING: This will remove ALL data including database!"
        read -p "Are you absolutely sure? Type 'DELETE' to confirm: " confirm
        if [ "$confirm" = "DELETE" ]; then
            docker-compose down -v
            docker-compose -f docker-compose.postgres.yml down -v
            print_success "All containers and volumes removed"
        else
            print_warning "Cancelled"
        fi
        ;;

    backup-db)
        print_header "Backing Up Database"
        BACKUP_FILE="backups/shadowcheck_backup_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p backups
        docker exec shadowcheck_postgres pg_dump -U shadowcheck_user shadowcheck_db > "$BACKUP_FILE"
        print_success "Database backed up to $BACKUP_FILE"
        ;;

    enable-autostart)
        print_header "Enabling Docker Autostart on Boot"
        sudo systemctl enable docker
        sudo systemctl start docker
        print_success "Docker service will start on boot"
        print_success "Containers with 'restart: unless-stopped' will auto-start"
        ;;

    help|*)
        echo "ShadowCheck Docker Management"
        echo ""
        echo "Database Commands:"
        echo "  start-db         Start PostgreSQL + PostGIS + PgAdmin"
        echo "  stop-db          Stop database infrastructure"
        echo "  restart-db       Restart database infrastructure"
        echo "  backup-db        Backup PostgreSQL database"
        echo ""
        echo "Application Commands:"
        echo "  start-app        Start application services (API)"
        echo "  stop-app         Stop application services"
        echo ""
        echo "Combined Commands:"
        echo "  start-all        Start database + application"
        echo "  stop-all         Stop everything"
        echo "  restart-all      Restart everything"
        echo "  status           Show status of all services"
        echo ""
        echo "Logs:"
        echo "  logs-db          Show database logs (follow)"
        echo "  logs-app         Show application logs (follow)"
        echo "  logs-all         Show all logs (follow)"
        echo ""
        echo "Maintenance:"
        echo "  clean            Remove stopped containers (keeps data)"
        echo "  clean-all        Remove everything including volumes (DESTRUCTIVE)"
        echo "  enable-autostart Enable Docker to start on system boot"
        echo ""
        echo "Examples:"
        echo "  ./docker-manage.sh start-all      # Start everything"
        echo "  ./docker-manage.sh status          # Check what's running"
        echo "  ./docker-manage.sh backup-db       # Backup database"
        ;;
esac
