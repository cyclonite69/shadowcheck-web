import os
import re
import collections

# Define domains and their path patterns (regex)
DOMAINS = {
    'wigle': [
        r'client/src/components/wigle/',
        r'server/src/api/routes/v1/wigle',
        r'server/src/services/wigle',
        r'server/src/api/routes/v1/wigle'
    ],
    'auth': [
        r'client/src/components/auth/',
        r'server/src/api/routes/v1/auth\.ts',
        r'server/src/services/auth',
        r'server/src/api/routes/v1/auth\.ts'
    ],
    'settings': [
        r'server/src/api/routes/v1/settings\.ts',
        r'server/src/api/routes/v1/settingsHelpers\.ts',
        r'server/src/services/adminSettingsService\.ts'
    ],
    'admin': [
        r'client/src/components/admin/',
        r'client/src/components/AdminPage\.tsx',
        r'server/src/api/routes/v1/admin/',
        r'server/src/api/routes/v1/admin\.ts',
        r'server/src/services/admin'
    ],
    'map': [
        r'client/src/components/geospatial/',
        r'client/src/components/kepler/',
        r'client/src/components/GeospatialExplorer\.tsx',
        r'client/src/components/KeplerPage\.tsx',
        r'client/src/components/WigleMap\.tsx',
        r'client/src/components/LazyMapComponent\.tsx',
        r'server/src/api/routes/v1/geospatial\.ts',
        r'server/src/api/routes/v1/kepler\.ts',
        r'client/src/components/map/'
    ],
    'scoring': [
        r'server/src/services/threatScoringService\.ts',
        r'server/src/api/routes/v1/admin-threat-scoring\.ts',
        r'server/src/api/routes/v1/threats\.ts',
        r'server/src/api/routes/v2/threats\.ts'
    ],
    'etl': [
        r'etl/'
    ],
}

# Domains are exclusive. If a file matches admin and settings, it should go to settings if we want but here they might overlap.
# Let's check from specific to general.

DOMAIN_ORDER = ['settings', 'scoring', 'wigle', 'auth', 'admin', 'map', 'etl']

def get_domain(file_path):
    # Normalize path
    file_path = file_path.replace('\\', '/')
    if file_path.startswith('./'):
        file_path = file_path[2:]
    
    for domain in DOMAIN_ORDER:
        patterns = DOMAINS[domain]
        for pattern in patterns:
            if re.search(pattern, file_path):
                # Special check for admin vs settings/scoring
                if domain == 'admin':
                    if re.search(r'settings', file_path) or re.search(r'threat-scoring', file_path):
                        continue
                return domain
    
    # Check for shared/core
    if 'client/src' in file_path or 'server/src' in file_path:
        return 'shared/core'
    
    return 'other'

def find_imported_file(current_file, import_path):
    if import_path.startswith('.'):
        # Relative import
        abs_path = os.path.normpath(os.path.join(os.path.dirname(current_file), import_path))
        # Try extensions
        for ext in ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']:
            if os.path.exists(abs_path + ext):
                return abs_path + ext
            if os.path.isdir(abs_path) and os.path.exists(os.path.join(abs_path, 'index' + ext)):
                 return os.path.join(abs_path, 'index' + ext)
    else:
        # Non-relative import - check for aliases like @/
        # Assuming @/ maps to client/src or server/src depending on where we are
        if import_path.startswith('@/'):
            if 'client/src' in current_file:
                # Need to check where @ maps to. In Vite it often maps to /src.
                # Let's try to guess.
                base = 'client/src/'
                path = import_path[2:]
                abs_path = os.path.join(base, path)
                for ext in ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']:
                    if os.path.exists(abs_path + ext):
                        return abs_path + ext
            elif 'server/src' in current_file:
                base = 'server/src/'
                path = import_path[2:]
                abs_path = os.path.join(base, path)
                for ext in ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']:
                    if os.path.exists(abs_path + ext):
                        return abs_path + ext
    return None

import_regex = re.compile(r'(?:import|from|require)\s*[\'"]([^\'"]+)[\'"]')

# Matrix[source_domain][imported_domain] = count
matrix = collections.defaultdict(lambda: collections.defaultdict(int))
multi_domain_importers = []

all_domains = DOMAIN_ORDER + ['shared/core']

# Process all files
for root, dirs, files in os.walk('.'):
    # Exclude directories
    if any(x in root for x in ['node_modules', 'dist', '.git', 'backups', 'certs', 'deploy', 'docs', 'grafana', 'imports', 'logs', 'public', 'reports', 'scripts', 'sql', 'tests']):
        continue
    
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            file_path = os.path.join(root, file)
            source_domain = get_domain(file_path)
            if source_domain == 'other':
                continue
            
            with open(file_path, 'r', errors='ignore') as f:
                content = f.read()
            
            imports = import_regex.findall(content)
            imported_domains = set()
            
            for imp in imports:
                imported_file = find_imported_file(file_path, imp)
                if imported_file:
                    imported_domain = get_domain(imported_file)
                    if imported_domain != 'other':
                        matrix[source_domain][imported_domain] += 1
                        if imported_domain != source_domain:
                            imported_domains.add(imported_domain)
                else:
                    # Could be a library or an alias we didn't resolve.
                    # Let's try to match by path string if it contains domain names.
                    for domain in all_domains:
                        if domain != 'shared/core' and domain in imp:
                            matrix[source_domain][domain] += 1
                            if domain != source_domain:
                                imported_domains.add(domain)

            # Check for multi-domain importers (3 or more domains)
            if len(imported_domains) >= 3:
                multi_domain_importers.append((file_path, sorted(list(imported_domains))))

# Print Matrix
output = "# Import Analysis Matrix (2026-04-18)\n\n"
output += "## Cross-Domain Import Matrix\n\n"

# Table Header
output += "| Source \\ Imported | " + " | ".join(all_domains) + " |\n"
output += "| --- | " + " | ".join(["---"] * len(all_domains)) + " |\n"

for src in all_domains:
    row = f"| {src} | "
    counts = []
    for dest in all_domains:
        counts.append(str(matrix[src][dest]))
    row += " | ".join(counts) + " |\n"
    output += row

output += "\n## Multi-Domain Importers (>= 3 domains)\n\n"
if multi_domain_importers:
    for file, domains in multi_domain_importers:
        output += f"- `{file}`: {', '.join(domains)}\n"
else:
    output += "None found.\n"

# Write to file
with open('reports/import-matrix-2026-04-18.md', 'w') as f:
    f.write(output)

print("Report generated in reports/import-matrix-2026-04-18.md")
