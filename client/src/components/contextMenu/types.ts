export type Network = {
  bssid: string;
  ssid?: string | null;
  threat_level?: string | null;
};

export type ContextMenuState = {
  x: number;
  y: number;
};

export type NetworkContextMenuProps = {
  networks?: Network[];
};

export type NetworkNote = {
  id: number;
  note_type: string;
  created_at: string;
  content: string;
};

export type NotesByBssid = Record<string, NetworkNote[]>;
