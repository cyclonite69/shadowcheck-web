#!/usr/bin/env bash

# ShadowCheck Interactive CLI Prompt
# Usage:
#   chmod +x shadowcheck-cli.sh
#   ./shadowcheck-cli.sh

set -e

API_BASE="${API_BASE:-http://localhost:3001/api}"
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
BOLD='\033[1m'
NC='\033[0m'

# Helpers
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_section() { echo -e "\n${BOLD}${CYAN}$1${NC}"; }

# API call helper
api_call() {
  local endpoint=$1
  local method=${2:-GET}
  local data=$3

  if [ "$VERBOSE" = true ]; then
    log_info "API: ${method} ${API_BASE}${endpoint}"
  fi

  if [ "$method" = "GET" ]; then
    curl -s "${API_BASE}${endpoint}"
  else
    curl -s -X "${method}" -H "Content-Type: application/json" -d "$data" "${API_BASE}${endpoint}"
  fi
}

# Command: Metrics
cmd_metrics() {
  log_section "Dashboard Metrics"
  local response=$(api_call "/v1/dashboard/metrics")
  if [ -z "$response" ]; then
    log_error "Failed to fetch metrics"
    return 1
  fi
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Command: Search networks
cmd_search() {
  local query=$1

  if [ -z "$query" ]; then
    log_error "Usage: search <query>"
    echo "  Examples: search home, search aa:bb:cc, search office"
    return 1
  fi

  log_section "Network Search: '$query'"
  local response=$(api_call "/networks?limit=50&offset=0&q=${query}")
  if [ -z "$response" ]; then
    log_error "No networks found"
    return 1
  fi

  echo "$response" | jq '.networks[] | {ssid, bssid, signal, type, observations: .obs_count}' 2>/dev/null || echo "$response"
}

# Command: List threats
cmd_threats() {
  log_section "Threat Summary"
  local response=$(api_call "/v1/dashboard/threats")
  if [ -z "$response" ]; then
    log_error "Failed to fetch threats"
    return 1
  fi
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Command: Network details
cmd_network() {
  local bssid=$1

  if [ -z "$bssid" ]; then
    log_error "Usage: network <BSSID>"
    echo "  Example: network aa:bb:cc:dd:ee:ff"
    return 1
  fi

  log_section "Network Details: $bssid"
  local response=$(api_call "/networks?limit=1&offset=0&bssid=${bssid}")
  if [ -z "$response" ]; then
    log_error "Network not found"
    return 1
  fi

  echo "$response" | jq '.networks[0]' 2>/dev/null || echo "$response"
}

# Command: Filter by type
cmd_type() {
  local type=$1

  if [ -z "$type" ]; then
    log_error "Usage: type <W|E|B|L>"
    echo "  W = WiFi, E = BLE, B = Bluetooth, L = LTE"
    return 1
  fi

  log_section "Networks by Type: $type"
  local response=$(api_call "/networks?limit=50&offset=0&radioTypes=${type}")
  if [ -z "$response" ]; then
    log_error "No networks found for type: $type"
    return 1
  fi

  echo "$response" | jq '.networks[] | {ssid, bssid, signal, observations: .obs_count}' 2>/dev/null || echo "$response"
}

# Command: Stats
cmd_stats() {
  log_section "Statistics"
  local response=$(api_call "/v1/dashboard/summary")
  if [ -z "$response" ]; then
    log_error "Failed to fetch stats"
    return 1
  fi
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Command: Help
cmd_help() {
  cat <<EOF

${BOLD}ShadowCheck CLI${NC}

${CYAN}Commands:${NC}
  ${BOLD}metrics${NC}           Show dashboard metrics (threats, networks, etc)
  ${BOLD}threats${NC}           List all detected threats
  ${BOLD}search <query>${NC}    Search networks by SSID or BSSID
  ${BOLD}network <bssid>${NC}   Get detailed info for a network
  ${BOLD}type <W|E|B|L>${NC}    Filter networks by type (WiFi/BLE/BT/LTE)
  ${BOLD}stats${NC}             Show aggregated statistics
  ${BOLD}verbose${NC}           Toggle verbose API logging
  ${BOLD}help${NC}              Show this message
  ${BOLD}exit${NC}              Exit CLI

${CYAN}Examples:${NC}
  > metrics
  > search home
  > search aa:bb:cc
  > type W
  > network aa:bb:cc:dd:ee:ff
  > stats

${CYAN}API Base:${NC} ${API_BASE}

EOF
}

# Main loop
main() {
  log_success "ShadowCheck CLI Ready"
  log_info "Type 'help' for commands"
  echo ""

  while true; do
    echo -ne "${BOLD}${CYAN}shadowcheck>${NC} "
    read -r input

    # Parse command and args
    read -r cmd arg1 arg2 <<< "$input"

    case "$cmd" in
      metrics)
        cmd_metrics
        ;;
      threats)
        cmd_threats
        ;;
      search)
        cmd_search "$arg1"
        ;;
      network)
        cmd_network "$arg1"
        ;;
      type)
        cmd_type "$arg1"
        ;;
      stats)
        cmd_stats
        ;;
      verbose)
        VERBOSE=$([ "$VERBOSE" = true ] && echo "false" || echo "true")
        log_success "Verbose mode: $VERBOSE"
        ;;
      help)
        cmd_help
        ;;
      exit|quit)
        log_success "Goodbye"
        exit 0
        ;;
      "")
        # Empty input, just show prompt again
        continue
        ;;
      *)
        log_error "Unknown command: $cmd"
        log_info "Type 'help' for available commands"
        ;;
    esac

    echo ""
  done
}

# Run it
main
