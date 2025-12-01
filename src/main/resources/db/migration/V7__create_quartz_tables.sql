-- V7__create_quartz_tables.sql
-- Quartz 2.x style tables (MySQL) - non-FK variant; idempotent (IF NOT EXISTS)
-- Adjust lengths / engine / charset if you have special requirements.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS QRTZ_JOB_DETAILS (
                                                SCHED_NAME VARCHAR(120) NOT NULL,
                                                JOB_NAME VARCHAR(200) NOT NULL,
                                                JOB_GROUP VARCHAR(200) NOT NULL,
                                                DESCRIPTION VARCHAR(250) NULL,
                                                JOB_CLASS_NAME VARCHAR(250) NOT NULL,
                                                IS_DURABLE BIT NOT NULL,
                                                IS_NONCONCURRENT BIT NOT NULL,
                                                IS_UPDATE_DATA BIT NOT NULL,
                                                REQUESTS_RECOVERY BIT NOT NULL,
                                                JOB_DATA BLOB NULL,
                                                PRIMARY KEY (SCHED_NAME, JOB_NAME, JOB_GROUP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_TRIGGERS (
                                             SCHED_NAME VARCHAR(120) NOT NULL,
                                             TRIGGER_NAME VARCHAR(200) NOT NULL,
                                             TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                             JOB_NAME VARCHAR(200) NOT NULL,
                                             JOB_GROUP VARCHAR(200) NOT NULL,
                                             DESCRIPTION VARCHAR(250) NULL,
                                             NEXT_FIRE_TIME BIGINT NULL,
                                             PREV_FIRE_TIME BIGINT NULL,
                                             PRIORITY INT NULL,
                                             TRIGGER_STATE VARCHAR(16) NOT NULL,
                                             TRIGGER_TYPE VARCHAR(8) NOT NULL,
                                             START_TIME BIGINT NOT NULL,
                                             END_TIME BIGINT NULL,
                                             CALENDAR_NAME VARCHAR(200) NULL,
                                             MISFIRE_INSTR SMALLINT NULL,
                                             JOB_DATA BLOB NULL,
                                             PRIMARY KEY (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP),
                                             INDEX IDX_QRTZ_TRIGGERS_NEXT_FIRE_TIME (SCHED_NAME, NEXT_FIRE_TIME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_SIMPLE_TRIGGERS (
                                                    SCHED_NAME VARCHAR(120) NOT NULL,
                                                    TRIGGER_NAME VARCHAR(200) NOT NULL,
                                                    TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                                    REPEAT_COUNT BIGINT NOT NULL,
                                                    REPEAT_INTERVAL BIGINT NOT NULL,
                                                    TIMES_TRIGGERED BIGINT NOT NULL,
                                                    PRIMARY KEY (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_CRON_TRIGGERS (
                                                  SCHED_NAME VARCHAR(120) NOT NULL,
                                                  TRIGGER_NAME VARCHAR(200) NOT NULL,
                                                  TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                                  CRON_EXPRESSION VARCHAR(120) NOT NULL,
                                                  TIME_ZONE_ID VARCHAR(80),
                                                  PRIMARY KEY (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_BLOB_TRIGGERS (
                                                  SCHED_NAME VARCHAR(120) NOT NULL,
                                                  TRIGGER_NAME VARCHAR(200) NOT NULL,
                                                  TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                                  BLOB_DATA BLOB NULL,
                                                  PRIMARY KEY (SCHED_NAME, TRIGGER_NAME, TRIGGER_GROUP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_FIRED_TRIGGERS (
                                                   SCHED_NAME VARCHAR(120) NOT NULL,
                                                   ENTRY_ID VARCHAR(95) NOT NULL,
                                                   TRIGGER_NAME VARCHAR(200) NOT NULL,
                                                   TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                                   INSTANCE_NAME VARCHAR(200) NOT NULL,
                                                   FIRED_TIME BIGINT NOT NULL,
                                                   SCHED_TIME BIGINT NOT NULL,
                                                   PRIORITY INT NOT NULL,
                                                   STATE VARCHAR(16) NOT NULL,
                                                   JOB_NAME VARCHAR(200) NULL,
                                                   JOB_GROUP VARCHAR(200) NULL,
                                                   IS_NONCONCURRENT BIT NULL,
                                                   REQUESTS_RECOVERY BIT NULL,
                                                   PRIMARY KEY (SCHED_NAME, ENTRY_ID),
                                                   INDEX IDX_QRTZ_FT_TRIG_INST_NAME (SCHED_NAME, INSTANCE_NAME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_PAUSED_TRIGGER_GRPS (
                                                        SCHED_NAME VARCHAR(120) NOT NULL,
                                                        TRIGGER_GROUP VARCHAR(200) NOT NULL,
                                                        PRIMARY KEY (SCHED_NAME, TRIGGER_GROUP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_SCHEDULER_STATE (
                                                    SCHED_NAME VARCHAR(120) NOT NULL,
                                                    INSTANCE_NAME VARCHAR(200) NOT NULL,
                                                    LAST_CHECKIN_TIME BIGINT NOT NULL,
                                                    CHECKIN_INTERVAL BIGINT NOT NULL,
                                                    PRIMARY KEY (SCHED_NAME, INSTANCE_NAME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS QRTZ_LOCKS (
                                          SCHED_NAME VARCHAR(120) NOT NULL,
                                          LOCK_NAME VARCHAR(40) NOT NULL,
                                          PRIMARY KEY (SCHED_NAME, LOCK_NAME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
