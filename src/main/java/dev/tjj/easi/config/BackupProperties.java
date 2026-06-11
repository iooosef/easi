package dev.tjj.easi.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Binds backup storage configuration from application.properties. */
@Configuration
@ConfigurationProperties(prefix = "app.backup")
public class BackupProperties {

    private String backupDir = "backups";
    private String pgDump = "pg_dump";
    private String pgRestore = "pg_restore";
    private String psql = "psql";

    public String getBackupDir() { return backupDir; }
    public void setBackupDir(String backupDir) { this.backupDir = backupDir; }

    public String getPgDump() { return pgDump; }
    public void setPgDump(String pgDump) { this.pgDump = pgDump; }

    public String getPgRestore() { return pgRestore; }
    public void setPgRestore(String pgRestore) { this.pgRestore = pgRestore; }

    public String getPsql() { return psql; }
    public void setPsql(String psql) { this.psql = psql; }
}
