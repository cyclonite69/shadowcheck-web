const buildContextMenuDemoHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Right-Click Context Menu Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; }
        .network-row { cursor: context-menu; }
        .network-row:hover { background: #f9f9f9; }
        .context-menu {
            position: absolute; background: white; border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; display: none;
        }
        .context-menu-item {
            padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;
        }
        .context-menu-item:hover { background: #f0f0f0; }
        .modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 2000;
        }
        .modal-content {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 20px; border-radius: 5px; width: 400px;
        }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;
        }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <h1>🛡️ Right-Click Context Menu Test</h1>
    <p><strong>Instructions:</strong> Right-click on any network row below to see the context menu.</p>
    
    <table>
        <thead>
            <tr><th>BSSID</th><th>SSID</th><th>Threat Level</th><th>Notes</th></tr>
        </thead>
        <tbody>
            <tr class="network-row" data-bssid="00:00:00:00:6E:36">
                <td>00:00:00:00:6E:36</td><td>TestNetwork</td><td>HIGH</td><td id="notes-00:00:00:00:6E:36">0</td>
            </tr>
            <tr class="network-row" data-bssid="AA:BB:CC:DD:EE:FF">
                <td>AA:BB:CC:DD:EE:FF</td><td>(hidden)</td><td>MED</td><td id="notes-AA:BB:CC:DD:EE:FF">0</td>
            </tr>
            <tr class="network-row" data-bssid="11:22:33:44:55:66">
                <td>11:22:33:44:55:66</td><td>CoffeeShop_WiFi</td><td>LOW</td><td id="notes-11:22:33:44:55:66">0</td>
            </tr>
        </tbody>
    </table>

    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu">
        <div class="context-menu-item" onclick="openNoteModal()">📝 Add Note</div>
        <div class="context-menu-item" onclick="attachMedia()">📎 Attach Media</div>
        <div class="context-menu-item" onclick="closeContextMenu()">❌ Close</div>
    </div>

    <!-- Note Modal -->
    <div id="noteModal" class="modal">
        <div class="modal-content">
            <h3>Add Note</h3>
            <div class="form-group">
                <label>BSSID: <span id="modalBssid" style="font-family: monospace; color: blue;"></span></label>
            </div>
            <div class="form-group">
                <label>Note Type:</label>
                <select id="noteType">
                    <option value="general">General</option>
                    <option value="threat">Threat</option>
                    <option value="location">Location</option>
                    <option value="device_info">Device Info</option>
                </select>
            </div>
            <div class="form-group">
                <label>Note:</label>
                <textarea id="noteContent" rows="4" placeholder="Enter your note..."></textarea>
            </div>
            <div class="form-group">
                <label>Attach File:</label>
                <input type="file" id="fileInput" multiple accept="image/*,video/*,.pdf">
            </div>
            <div>
                <button class="btn btn-primary" onclick="saveNote()">Save Note</button>
                <button class="btn btn-secondary" onclick="closeNoteModal()">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        let currentBssid = null;

        document.addEventListener('contextmenu', function(e) {
            const row = e.target.closest('.network-row');
            if (row) {
                e.preventDefault();
                currentBssid = row.dataset.bssid;
                
                const menu = document.getElementById('contextMenu');
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        });

        document.addEventListener('click', function() {
            document.getElementById('contextMenu').style.display = 'none';
        });

        function openNoteModal() {
            document.getElementById('modalBssid').textContent = currentBssid;
            document.getElementById('noteModal').style.display = 'block';
            closeContextMenu();
        }

        function closeNoteModal() {
            document.getElementById('noteModal').style.display = 'none';
            document.getElementById('noteContent').value = '';
        }

        function closeContextMenu() {
            document.getElementById('contextMenu').style.display = 'none';
        }

        function attachMedia() {
            document.getElementById('fileInput').click();
            closeContextMenu();
        }

        async function saveNote() {
            const content = document.getElementById('noteContent').value.trim();
            const noteType = document.getElementById('noteType').value;
            
            if (!content) {
                alert('Please enter a note');
                return;
            }

            try {
                const response = await fetch('/api/admin/network-notes/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bssid: currentBssid,
                        content: content,
                        note_type: noteType,
                        user_id: 'demo_user'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    const fileInput = document.getElementById('fileInput');
                    if (fileInput.files.length > 0) {
                        for (const file of fileInput.files) {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('bssid', currentBssid);
                            
                            await fetch('/api/admin/network-notes/' + data.note_id + '/media', {
                                method: 'POST',
                                body: formData
                            });
                        }
                    }

                    const noteCell = document.getElementById('notes-' + currentBssid);
                    const currentCount = parseInt(noteCell.textContent) || 0;
                    noteCell.textContent = currentCount + 1;
                    
                    alert('Note saved successfully!');
                    closeNoteModal();
                } else {
                    alert('Failed to save note');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error saving note');
            }
        }
    </script>
</body>
</html>
`;

module.exports = { buildContextMenuDemoHtml };
