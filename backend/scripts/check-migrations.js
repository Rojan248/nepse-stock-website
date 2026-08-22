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

const args = process.argv.slice(2);
const schemaFlagIdx = args.indexOf('--schema');
const backendRoot = path.join(__dirname, '..');
const schemaPath = schemaFlagIdx !== -1
    ? path.resolve(args[schemaFlagIdx + 1])
    : path.join(backendRoot, 'prisma', 'schema.prisma');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');

const SCALAR_TYPES = new Set([
    'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'
]);

const parseModels = (schemaText) => {
    const models = {};
    const modelRegex = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
    for (const [, modelName, body] of schemaText.matchAll(modelRegex)) {
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

const main = () => {
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const models = parseModels(schemaText);
    const migrationSql = loadMigrationSql(migrationsDir);

    const missing = [];
    for (const [modelName, { table, columns }] of Object.entries(models)) {
        for (const column of columns) {
            const quoted = `"${column}"`;
            const quotedTable = `"${table}"`;
            const appearsInTable = new RegExp(
                `CREATE TABLE\\s+${quotedTable}[\\s\\S]*?${quoted}`, 'i'
            ).test(migrationSql) || new RegExp(
                `ALTER TABLE\\s+${quotedTable}[\\s\\S]*?ADD COLUMN\\s+${quoted}`, 'i'
            ).test(migrationSql);

            // Fall back to a global check: SQLite migrations may reference the
            // column while recreating a differently-named artifact.
            if (!appearsInTable && !migrationSql.includes(quoted)) {
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
