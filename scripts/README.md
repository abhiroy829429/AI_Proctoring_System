# Database Utilities

This directory contains utility scripts for managing the Proctoring App's database.

## Available Scripts

### `generate-test-data.js`

Generates realistic test data for the proctoring system, including sessions and events.

#### Prerequisites

1. Node.js (v14 or higher)
2. MongoDB connection string in `../backend/.env.production`
3. Required npm packages (install with `npm install` in the project root)

#### Usage

```bash
# Install dependencies if not already installed
npm install

# Run the test data generation script
node scripts/generate-test-data.js
```

#### Options

The script accepts the following command-line arguments:

- `--sessions` or `-s`: Number of sessions to generate (default: 20)
- `--events` or `-e`: Maximum number of events per session (default: 100)

Example:
```bash
node scripts/generate-test-data.js --sessions 50 --events 200
```

#### Generated Data

The script will generate:

- Random sessions with realistic metadata
- Various types of events for each session, including:
  - Session start/end events
  - Face detection events
  - Suspicious activity events
  - Browser tab/window events
  - And more...

### `db-utils.js`

A command-line utility for backing up and restoring the MongoDB database.

#### Prerequisites

1. MongoDB installed and running
2. `mongodump` and `mongorestore` tools available in PATH
3. MongoDB connection string in `../backend/.env.production`

#### Usage

```bash
# Create a backup
node scripts/db-utils.js backup

# Restore from a backup
node scripts/db-utils.js restore path/to/backup.gz

# List available backups
node scripts/db-utils.js list
```

#### Commands

- `backup [output-path]`: Create a backup of the database
  - `output-path`: Optional custom path for the backup file

- `restore <backup-file> [--drop]`: Restore the database from a backup
  - `backup-file`: Path to the backup file to restore from
  - `--drop`: Drop collections before restoring (use with caution!)

- `list`: List all available backups

#### Environment Variables

- `MONGO_URI`: MongoDB connection string (from .env.production)
- Backups are stored in the `backups` directory by default

## Common Tasks

### Generate Test Data and Create Initial Backup

```bash
# Generate test data
node scripts/generate-test-data.js --sessions 20 --events 100

# Create a backup
node scripts/db-utils.js backup
```

### Restore Production Data from Backup

```bash
# List available backups
node scripts/db-utils.js list

# Restore the latest backup (with drop to clear existing data)
node scripts/db-utils.js restore backups/your-db-2023-09-11T07-00-00-000Z.gz --drop
```

## Notes

- Backups are compressed using gzip to save space
- The `--drop` flag will delete existing collections before restoring
- Always verify backups before using them in production
- Test data generation will clear existing data before generating new data

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
