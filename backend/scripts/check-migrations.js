#!/usr/bin/env node
/**
 * Fails when a scalar field in schema.prisma has no corresponding column
 * in any migration. Catches the "column does not exist" class of bugs
 * (schema edited without generating a migration) without depending on
 * prisma migrate diff, which reports cosmetic SQLite DDL differences
 * between migration-replayed and datamodel-generated tables.
 *
 * Usage: node scripts/check-migrations.js [--schema <path>]
 */
const fs = require('fs');
const path = require('path');

const SCALAR_TYPES = new Set([
    'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'
]);

const parseArgs = (args) => {
    const options = {};
    const schemaFlagIdx = args.indexOf('--schema');
    if (schemaFlagIdx !== -1) {
        const value = args[schemaFlagIdx + 1];
        if (!value || value.startsWith('--')) {
            console.error('Usage: node scripts/check-migrations.js [--schema <path>]');
            process.exit(1);
        }
        options.schema = path.resolve(value);
    }
    return options;
};

const parseModels = (schemaText) => {
    const models = {};
    // Strip // comments before matching: comments may contain braces
    // (e.g. "/security/{id}"), which would truncate the model body.
    const cleaned = schemaText.replace(/^[ \t]*\/\/.*$/gm, '');
    const modelRegex = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
    for (const [, modelName, body] of cleaned.matchAll(modelRegex)) {
        const columns = [];
        for (const line of body.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
            const fieldMatch = trimmed.match(/^(\w+)\s+([\w[\]?]+)/);
            if (!fieldMatch) continue;
            const [, fieldName, fieldType] = fieldMatch;
            // Strip list/nullability markers; anything that is not a scalar
            // is another model reference and not a real column.
            const baseType = fieldType.replace(/[[\]?]/g, '');
            if (!SCALAR_TYPES.has(baseType)) continue;
            columns.push(fieldName);
        }
        const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
        models[modelName] = { table: mapMatch ? mapMatch[1] : modelName, columns };
    }
    return models;
};

const loadMigrationSql = (dir) => {
    const sqls = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(dir, entry.name, 'migration.sql');
        if (fs.existsSync(file)) sqls.push(fs.readFileSync(file, 'utf8'));
    }
    return sqls.join('\n');
};

/** Columns declared inside the exact `CREATE TABLE "<table>" (...)` block */
const getCreateTableColumns = (sql, table) => {
    const blockRegex = new RegExp(`CREATE TABLE\\s+"${table}"\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
    const block = sql.match(blockRegex);
    if (!block) return [];
    const columns = [];
    for (const line of block[1].split('\n')) {
        const columnMatch = line.trim().match(/^"([^"]+)"/);
        if (columnMatch) columns.push(columnMatch[1]);
    }
    return columns;
};

/** Columns added later via `ALTER TABLE "<table>" ... ADD COLUMN "<name>"` */
const getAlteredColumns = (sql, table) => {
    const alterRegex = new RegExp(`ALTER TABLE\\s+"${table}"\\s+[^;]*?ADD COLUMN\\s+"([^"]+)"`, 'gi');
    const columns = [];
    let match;
    while ((match = alterRegex.exec(sql)) !== null) {
        columns.push(match[1]);
    }
    return columns;
};

const main = () => {
    const options = parseArgs(process.argv.slice(2));
    const backendRoot = path.join(__dirname, '..');
    const schemaPath = options.schema || path.join(backendRoot, 'prisma', 'schema.prisma');
    const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');

    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const models = parseModels(schemaText);
    const migrationSql = loadMigrationSql(migrationsDir);

    const missing = [];
    for (const [modelName, { table, columns }] of Object.entries(models)) {
        const migratedColumns = new Set([
            ...getCreateTableColumns(migrationSql, table),
            ...getAlteredColumns(migrationSql, table)
        ]);
        for (const column of columns) {
            if (!migratedColumns.has(column)) {
                missing.push(`${modelName}.${column} (table ${table})`);
            }
        }
    }

    if (missing.length > 0) {
        console.error('Schema fields with no matching migration column:');
        for (const entry of missing) console.error(`  - ${entry}`);
        console.error('\nGenerate a migration: npx prisma migrate dev --name <change>');
        process.exit(1);
    }

    console.log(`OK: all schema fields across ${Object.keys(models).length} models are covered by migrations`);
};

main();
