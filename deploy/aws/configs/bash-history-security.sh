#!/bin/bash
# Bash History Security Configuration
# Prevents passwords and sensitive commands from being logged

# Add to /home/ssm-user/.bashrc and /root/.bashrc

# Ignore commands with passwords
export HISTIGNORE="*password*:*PASSWORD*:*passwd*:*PASSWD*:*secret*:*SECRET*:*token*:*TOKEN*:*key*:*KEY*"

# Ignore specific sensitive commands
export HISTIGNORE="$HISTIGNORE:psql*:mysql*:ALTER USER*:CREATE USER*:echo*>*password*:echo*>*secret*"

# Ignore docker exec commands that might contain passwords
export HISTIGNORE="$HISTIGNORE:docker exec*psql*:docker exec*ALTER*"

# Don't save commands starting with space
export HISTCONTROL=ignorespace:ignoredups:erasedups

# Limit history size
export HISTSIZE=1000
export HISTFILESIZE=2000

# Timestamp history entries
export HISTTIMEFORMAT="%F %T "

# Append to history file, don't overwrite
shopt -s histappend

# Save history after each command
PROMPT_COMMAND="history -a; $PROMPT_COMMAND"

# Function to run sensitive commands without logging
nohistory() {
    set +o history
    "$@"
    set -o history
}

# Alias for password rotation (won't be logged)
alias rotate-password=' ./scripts/rotate-db-password.sh'

# Alias for setting secrets (won't be logged)
alias set-secret=' node scripts/set-secret.js'

# Note: Commands starting with space are not logged
echo "💡 Tip: Prefix sensitive commands with space to exclude from history"
echo "   Example:  psql -c \"ALTER USER ...\""
