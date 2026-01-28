import { LogArchiveService } from '../src/services/backup/logArchive.service';

async function main() {
  const service = new LogArchiveService();
  await service.archiveLast15DaysLogs();
  await service.cleanupDatabaseLogs(90);
  await service.cleanupOldArchives(3650);
  await service.cleanup();
}

main().catch((err) => {
  console.error('[LOG-ARCHIVE] Failed:', err);
  process.exit(1);
});
