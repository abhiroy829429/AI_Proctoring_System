const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '../backend/.env.production' });

const BACKUP_DIR = path.join(__dirname, '../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Backup the MongoDB database
 * @param {string} connectionString - MongoDB connection string
 * @param {string} dbName - Database name
 * @param {string} [outputPath] - Custom output path for the backup
 * @returns {Promise<string>} Path to the backup file
 */
async function backupDatabase(connectionString, dbName, outputPath) {
  return new Promise((resolve, reject) => {
    const backupName = outputPath || path.join(BACKUP_DIR, `${dbName}-${TIMESTAMP}.gz`);
    const command = `mongodump --uri="${connectionString}" --archive="${backupName}" --gzip`;
    
    console.log(`Starting backup to ${backupName}...`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', error);
        return reject(error);
      }
      if (stderr) {
        console.warn('Backup warning:', stderr);
      }
      console.log('Backup completed successfully');
      resolve(backupName);
    });
  });
}

/**
 * Restore the MongoDB database from a backup
 * @param {string} connectionString - MongoDB connection string
 * @param {string} backupPath - Path to the backup file
 * @param {boolean} [drop] - Whether to drop the database before restore
 * @returns {Promise<void>}
 */
async function restoreDatabase(connectionString, backupPath, drop = false) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(backupPath)) {
      return reject(new Error(`Backup file not found: ${backupPath}`));
    }
    
    const dropFlag = drop ? '--drop' : '';
    const command = `mongorestore --uri="${connectionString}" --archive="${backupPath}" --gzip ${dropFlag}`;
    
    console.log(`Starting restore from ${backupPath}...`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Restore failed:', error);
        return reject(error);
      }
      if (stderr) {
        console.warn('Restore warning:', stderr);
      }
      console.log('Restore completed successfully');
      resolve();
    });
  });
}

/**
 * List all available backups
 * @returns {Array<{name: string, path: string, size: string, date: Date}>}
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  
  return fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.gz'))
    .map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: formatFileSize(stats.size),
        date: stats.mtime,
        sizeInBytes: stats.size
      };
    })
    .sort((a, b) => b.date - a.date); // Newest first
}

/**
 * Format file size in human-readable format
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Command-line interface
async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI is not defined in .env file');
    process.exit(1);
  }
  
  const dbName = new URL(process.env.MONGO_URI).pathname.replace(/^\//, '');
  
  switch (command) {
    case 'backup':
      try {
        const outputPath = args[0] ? path.resolve(args[0]) : undefined;
        const backupPath = await backupDatabase(process.env.MONGO_URI, dbName, outputPath);
        console.log(`Backup created at: ${backupPath}`);
      } catch (error) {
        console.error('Backup failed:', error.message);
        process.exit(1);
      }
      break;
      
    case 'restore':
      if (!args[0]) {
        console.error('Error: Please specify a backup file to restore');
        process.exit(1);
      }
      
      try {
        const backupPath = path.resolve(args[0]);
        const drop = args.includes('--drop');
        
        console.log(`Restoring from backup: ${backupPath}`);
        if (drop) {
          console.warn('WARNING: This will DROP existing collections before restoring!');
        }
        
        await restoreDatabase(process.env.MONGO_URI, backupPath, drop);
        console.log('Restore completed successfully');
      } catch (error) {
        console.error('Restore failed:', error.message);
        process.exit(1);
      }
      break;
      
    case 'list':
      const backups = listBackups();
      if (backups.length === 0) {
        console.log('No backups found');
        break;
      }
      
      console.log('\nAvailable backups:');
      console.log('='.repeat(80));
      console.log('  Date'.padEnd(30) + 'Size'.padEnd(15) + 'File');
      console.log('-'.repeat(80));
      
      backups.forEach((backup, index) => {
        console.log(
          `  ${backup.date.toISOString()}`.padEnd(30) +
          `${backup.size}`.padEnd(15) +
          backup.name
        );
      });
      
      console.log('\nTotal backups:', backups.length);
      break;
      
    default:
      console.log('\nDatabase Utility Tool');
      console.log('====================\n');
      console.log('Usage:');
      console.log('  node scripts/db-utils.js backup [output-path]');
      console.log('  node scripts/db-utils.js restore <backup-file> [--drop]');
      console.log('  node scripts/db-utils.js list');
      console.log('\nOptions:');
      console.log('  --drop    Drop collections before restore (use with caution!)');
      console.log('\nEnvironment:');
      console.log(`  MONGO_URI: ${process.env.MONGO_URI ? '***' : 'Not set'}`);
      console.log(`  Backup dir: ${BACKUP_DIR}`);
      process.exit(1);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  backupDatabase,
  restoreDatabase,
  listBackups,
  formatFileSize
};
