#!/usr/bin/env tsx
/**
 * KML -> PostgreSQL staging importer
 *
 * Imports WiGLE-style KML exports into app.kml_files and app.kml_points.
 * This is intentionally a staging pipeline, not a canonical observation import.
 *
 * Usage:
 *   npx tsx etl/load/kml-import.ts <kml-file-or-directory> [source_type]
 *
 * Examples:
 *   npx tsx etl/load/kml-import.ts ~/repos/download/wigle_downloads wigle
 *   npx tsx etl/load/kml-import.ts ~/repos/download/wigle_downloads/20260331-00449.kml wigle
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import '../loadEnv';

type Nullable<T> = T | null;

interface Config {
  BATCH_SIZE: number;
  DB_CONFIG: {
    user: string;
    password?: string;
    host: string;
    database: string;
    port: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}

interface ParsedPoint {
  folderName: Nullable<string>;
  name: Nullable<string>;
  networkId: Nullable<string>;
  bssid: Nullable<string>;
  encryption: Nullable<string>;
  attributes: Nullable<string>;
  observedAt: Nullable<Date>;
  signalDbm: Nullable<number>;
  accuracyM: Nullable<number>;
  networkType: Nullable<string>;
  lon: Nullable<number>;
  lat: Nullable<number>;
  rawDescription: string;
  rawKml: Record<string, unknown>;
}

const CONFIG: Config = {
  BATCH_SIZE: parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10),
  DB_CONFIG: {
    user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck_db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

class KmlImporter {
  private readonly inputPath: string;
  private readonly sourceType: string;
  private readonly pool: Pool;

  constructor(inputPath: string, sourceType: string) {
    this.inputPath = inputPath;
    this.sourceType = sourceType;
    this.pool = new Pool(CONFIG.DB_CONFIG);
  }

  async start(): Promise<void> {
    console.log('\n🗺️  KML STAGING IMPORT');
    console.log('━'.repeat(60));
    console.log(`📁 Input: ${this.inputPath}`);
    console.log(`🏷️  Source type: ${this.sourceType}`);
    console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE}\n`);

    try {
      await this.validateConnection();
      const files = this.collectInputFiles();

      if (files.length === 0) {
        throw new Error(`No .kml files found at: ${this.inputPath}`);
      }

      console.log(`Found ${files.length} KML file(s)\n`);

      let importedFiles = 0;
      let importedPoints = 0;

      for (const filePath of files) {
        const points = this.parseKmlFile(filePath);
        const fileId = await this.upsertKmlFile(filePath, points);
        await this.replacePointsForFile(fileId, points);

        importedFiles += 1;
        importedPoints += points.length;

        console.log(
          `✅ ${path.basename(filePath)} -> file_id=${fileId}, staged ${points.length.toLocaleString()} point(s)`
        );
      }

      console.log('\nImport complete');
      console.log(`Files:  ${importedFiles.toLocaleString()}`);
      console.log(`Points: ${importedPoints.toLocaleString()}`);
    } finally {
      await this.pool.end();
    }
  }

  private async validateConnection(): Promise<void> {
    const result = await this.pool.query('SELECT current_user AS user, current_database() AS db');
    console.log(`✅ PostgreSQL connected as ${result.rows[0].user} to ${result.rows[0].db}`);
  }

  private collectInputFiles(): string[] {
    const resolved = path.resolve(this.inputPath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`Input path not found: ${resolved}`);
    }

    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      return resolved.toLowerCase().endsWith('.kml') ? [resolved] : [];
    }

    return fs
      .readdirSync(resolved)
      .filter((name) => name.toLowerCase().endsWith('.kml'))
      .sort()
      .map((name) => path.join(resolved, name));
  }

  private parseKmlFile(filePath: string): ParsedPoint[] {
    const xml = fs.readFileSync(filePath, 'utf8');
    const documentName = this.extractDocumentName(xml);
    const points: ParsedPoint[] = [];

    const folderRegex = /<Folder>\s*<name>([\s\S]*?)<\/name>([\s\S]*?)<\/Folder>/g;
    let folderMatch: RegExpExecArray | null;

    while ((folderMatch = folderRegex.exec(xml)) !== null) {
      const folderName = decodeXml(folderMatch[1]).trim() || null;
      const folderBody = folderMatch[2];
      const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
      let placemarkMatch: RegExpExecArray | null;

      while ((placemarkMatch = placemarkRegex.exec(folderBody)) !== null) {
        const placemarkXml = placemarkMatch[1];
        const point = this.parsePlacemark(placemarkXml, folderName, documentName);
        if (point) points.push(point);
      }
    }

    return points;
  }

  private extractDocumentName(xml: string): Nullable<string> {
    const match = xml.match(/<Document>\s*<name>([\s\S]*?)<\/name>/);
    return match ? decodeXml(match[1]).trim() || null : null;
  }

  private parsePlacemark(
    placemarkXml: string,
    folderName: Nullable<string>,
    documentName: Nullable<string>
  ): Nullable<ParsedPoint> {
    const name = extractTag(placemarkXml, 'name');
    const description = extractTag(placemarkXml, 'description') || '';
    const coordinates = extractTag(placemarkXml, 'coordinates');

    if (!coordinates) return null;

    const coordParts = coordinates
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (coordParts.length < 2) return null;

    const lon = parseNumber(coordParts[0]);
    const lat = parseNumber(coordParts[1]);

    if (lon === null || lat === null) return null;

    const fieldMap = parseDescription(description);
    const networkType = normalizeText(fieldMap.get('Type'));
    const networkId = normalizeNetworkId(fieldMap.get('Network ID'));
    const bssid = networkType === 'WIFI' ? networkId : null;

    return {
      folderName,
      name: normalizeText(name),
      networkId,
      bssid,
      encryption: normalizeText(fieldMap.get('Encryption')),
      attributes: normalizeText(fieldMap.get('Attributes')),
      observedAt: parseDate(fieldMap.get('Time')),
      signalDbm: parseNumber(fieldMap.get('Signal')),
      accuracyM: parseNumber(fieldMap.get('Accuracy')),
      networkType,
      lon,
      lat,
      rawDescription: decodeXml(description).trim(),
      rawKml: {
        document_name: documentName,
        folder_name: folderName,
      },
    };
  }

  private async upsertKmlFile(filePath: string, points: ParsedPoint[]): Promise<number> {
    const sourceFile = path.resolve(filePath);
    const xml = fs.readFileSync(sourceFile);
    const xmlText = xml.toString('utf8');
    const sourceName = this.extractDocumentName(xmlText);
    const fileHash = createHash('sha256').update(xml).digest('hex');

    const result = await this.pool.query(
      `INSERT INTO app.kml_files (
         source_file,
         source_name,
         source_type,
         file_hash,
         placemark_count,
         raw_kml
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (source_file) DO UPDATE
       SET source_name = EXCLUDED.source_name,
           source_type = EXCLUDED.source_type,
           file_hash = EXCLUDED.file_hash,
           placemark_count = EXCLUDED.placemark_count,
           imported_at = now(),
           raw_kml = EXCLUDED.raw_kml
       RETURNING id`,
      [
        sourceFile,
        sourceName,
        this.sourceType,
        fileHash,
        points.length,
        JSON.stringify({
          file_size_bytes: xml.length,
          parser: 'etl/load/kml-import.ts',
        }),
      ]
    );

    return result.rows[0].id;
  }

  private async replacePointsForFile(fileId: number, points: ParsedPoint[]): Promise<void> {
    await this.pool.query('DELETE FROM app.kml_points WHERE kml_file_id = $1', [fileId]);

    for (let i = 0; i < points.length; i += CONFIG.BATCH_SIZE) {
      const batch = points.slice(i, i + CONFIG.BATCH_SIZE);
      await this.insertPointBatch(fileId, batch);
    }
  }

  private async insertPointBatch(fileId: number, points: ParsedPoint[]): Promise<void> {
    if (points.length === 0) return;

    const values: unknown[] = [];
    const placeholders = points
      .map((point, index) => {
        const base = index * 15;
        values.push(
          fileId,
          point.folderName,
          point.name,
          point.networkId,
          point.bssid,
          point.encryption,
          point.attributes,
          point.observedAt,
          point.signalDbm,
          point.accuracyM,
          point.networkType,
          point.rawDescription,
          JSON.stringify(point.rawKml)
        );

        const valueArgs = Array.from({ length: 13 }, (_, offset) => `$${base + offset + 1}`).join(
          ', '
        );

        const lonParam = `$${base + 14}`;
        const latParam = `$${base + 15}`;
        values.push(point.lon, point.lat);

        return `(${valueArgs}, ST_SetSRID(ST_MakePoint(${lonParam}, ${latParam}), 4326))`;
      })
      .join(', ');

    await this.pool.query(
      `INSERT INTO app.kml_points (
         kml_file_id,
         folder_name,
         name,
         network_id,
         bssid,
         encryption,
         attributes,
         observed_at,
         signal_dbm,
         accuracy_m,
         network_type,
         raw_description,
         raw_kml,
         location
       )
       VALUES ${placeholders}`,
      values
    );
  }
}

function extractTag(xml: string, tagName: string): Nullable<string> {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
  const match = xml.match(regex);
  return match ? decodeXml(match[1]).trim() : null;
}

function parseDescription(description: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = decodeXml(description)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    map.set(key, value);
  }

  return map;
}

function normalizeText(value: Nullable<string>): Nullable<string> {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNetworkId(value: Nullable<string>): Nullable<string> {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.toUpperCase();
}

function parseNumber(value: Nullable<string>): Nullable<number> {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: Nullable<string>): Nullable<Date> {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const [inputPath, sourceTypeArg] = process.argv.slice(2);

if (!inputPath) {
  console.error('Usage: npx tsx etl/load/kml-import.ts <kml-file-or-directory> [source_type]');
  process.exit(1);
}

const importer = new KmlImporter(inputPath, sourceTypeArg || 'wigle');
importer.start().catch((error) => {
  const err = error as Error;
  console.error(`\n❌ Import failed: ${err.message}`);
  process.exit(1);
});
