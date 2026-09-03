REM
REM Sets up the Scheduled Workbook Results Schema.
REM 
REM You must be logged in as a user who has the following privileges
REM in order to run this script :
REM
REM CREATE USER, ALTER USER, GRANT ANY PRIVILEGE, SELECT ANY TABLE
REM
REM At the SQL prompt type in 'start batchusr.sql'
REM
REM A temporary file 'tmpbatch.sql' is created which can be deleted
REM once the script has successfully run.
REM
REM This script performs the following :
REM
REM 1: Check whether logged in as system.  If not, the script will
REM    exit
REM 2: Prompts for the username and password of the Batch Repository
REM    User
REM 3: Creates the Scheduled Workbook Results Schema if required and grants privileges
REM 4: logs on as the Scheduled Workbook Results Schema
REM 5: Installs the EUL5_BATCH_REP_SECURE,EUL5_BATCH_REPOSITORY,EUL5_BATCH_DISCO_ADMINS packages
REM 6: Grants access to EUL5_BATCH_REPOSITORY TO PUBLIC.
REM 7: Grants access for Scheduled Workbook Results Schema to EUL
REM 8: Grants access to EUL5_BATCH_DISCO_ADMINS TO All the admins of the EUL.
REM
REM
REM JKD    20-Jan-02 Added two new packages.
REM KLG    27-Oct-97 Script creation
REM

clear screen 
clear buffer
set lines 80
set pages 5000
set feedback off
set verify off
set pause off
set termout off
set heading off
REM
set echo off
set termout on
PROMPT
PROMPT Discoverer Scheduled Workbook Results Schema Installation Script
PROMPT ================================================================
PROMPT This script performs the following :
PROMPT
PROMPT 1..Checks whether you are logged with the following privileges :
PROMPT ...CREATE USER, ALTER USER, GRANT ANY PRIVILEGE, SELECT ANY TABLE
PROMPT ...If the user does not have the correct privileges, this script will end.
PROMPT 2..Asks you to enter the name and password of the Scheduled Workbook Results Schema.
PROMPT ...If the user does not exist, it will be created
PROMPT 3..Grants privileges to the Scheduled Workbook Results Schema
PROMPT 4..Installs the EUL5_BATCH_REP_SECURE,EUL5_BATCH_REPOSITORY,EUL5_BATCH_DISCO_ADMINS packages
PROMPT 5..Grants execute on EUL5_BATCH_REPOSITORY TO PUBLIC.
PROMPT 6..Grants access for Scheduled Workbook Results Schema to EUL   
PROMPT 7..Grants access to EUL5_BATCH_DISCO_ADMINS TO All the admins of the EUL.
PROMPT
PROMPT Default answers are shown in [] brackets.
PROMPT
PROMPT If the script exits at this point, you are NOT logged in with the right privileges
PROMPT

REM -------------------------------------------------------------------------
REM Check whether logged in 


set feedback off
set heading off
set termout off
set verify off

select 'EXIT'
from dual
where (1 >
(select count(*) 
 from user_role_privs 
 where granted_role = 'DBA'))
AND (4 > (
 select count(*) 
 from user_sys_privs
 where privilege in ('GRANT ANY PRIVILEGE', 'CREATE USER', 'ALTER USER', 'SELECT ANY TABLE' )))
UNION
select 'accept foo prompt Exiting...'
from dual
where (1 >
(select count(*) 
 from user_role_privs 
 where granted_role = 'DBA'))
AND (4 > (
 select count(*) 
 from user_sys_privs
 where privilege in ('GRANT ANY PRIVILEGE', 'CREATE USER', 'ALTER USER', 'SELECT ANY TABLE' )))
order by 1 desc


spool tmpbatch.sql
/
spool off

set termout on

start tmpbatch.sql


PROMPT
PROMPT Logged in
PROMPT

REM ------------------------------------------------------------------
REM Prompt for Scheduled Workbook Results Schema to be installed
REM

PROMPT
PROMPT Enter details of the new Scheduled Workbook Results Schema to be created
PROMPT 

accept Batch_User prompt 'Scheduled Workbook Results Schema name : '
accept Batch_Pass prompt 'Batch Repository Password : ' hide
accept Batch_DBLink prompt 'Enter database connection (eg T:node:sid, ServiceName) [LOCAL] : '
PROMPT

set termout off

select 'create user &Batch_User identified by &Batch_Pass;'
from dual
where NOT exists
(select username from all_users
 where username = UPPER('&Batch_User'))
UNION
select 'prompt Scheduled Workbook Results Schema being created'
from dual
where NOT exists
(select username from all_users
 where username = UPPER('&Batch_User'))
UNION
select 'prompt Scheduled Workbook Results Schema already exists'
from dual
where exists
(select username from all_users
 where username = UPPER('&Batch_User'))
order by 1 desc

spool tmpbatch.sql
/
spool off

set termout on

start tmpbatch

REM ------------------------------------------------------------------
REM Check to see if Default and Temporary Tablespaces need
REM changing
REM

set termout off
col total heading "Total Mb Free" format 9999999.99
col tablespace_name heading "Tablespace"
set feedback off
set heading on
set termout on

PROMPT
PROMPT You now have the chance to change tablespace settings
PROMPT for the Scheduled Workbook Results Schema.  If you enter the
PROMPT tablespace names in incorrectly the script will exit.
PROMPT In order to continue, just re-run the script and it will
PROMPT register that the user has already been created.
PROMPT

PROMPT
PROMPT All tablespaces available on the system :
PROMPT
select tablespace_name, sum(bytes)/1024/1024 Total
from sys.dba_free_space
group by tablespace_name
/

REM ------------------------------------------------------------------
REM See what the user already has for default and temporary tablespaces
REM
set termout off
col deftab heading "Default Tablespace" format A30
col temptab heading "Temporary Tablespace" format A30
col defquota heading "Default Tablespace Quota (bytes)" format A35
col tempquota heading "Temporary Tablespace Quota (bytes)" format A35
set feedback off
set heading on
set termout on

PROMPT
PROMPT Scheduled Workbook Results Schema - &Batch_User
PROMPT Default and Temporary Tablespace Information :
PROMPT
select dba_users.default_tablespace "deftab", 
decode(to_char(t1.max_bytes), '-1', 'Unlimited', NULL, 'No Quota Set', to_char(t1.max_bytes)) "defquota"
from dba_ts_quotas t1, dba_users
where dba_users.default_tablespace = t1.tablespace_name(+)
and dba_users.username = t1.username(+) 
and dba_users.username = UPPER('&Batch_User')
/

PROMPT
select dba_users.temporary_tablespace "temptab", 
decode(to_char(t1.max_bytes), '-1', 'Unlimited', NULL, 'No Quota Set', to_char(t1.max_bytes)) "tempquota"
from dba_ts_quotas t1, dba_users
where dba_users.temporary_tablespace = t1.tablespace_name(+)
and dba_users.username = t1.username(+) 
and dba_users.username = UPPER('&Batch_User')
/

PROMPT
accept changeReqd prompt 'Do you wish to alter the Default and Temporary Tablespaces for &Batch_User ? [N] '
PROMPT

set termout off
set heading off
undef CHANGE_REQD
undef LINE_1
undef LINE_2
undef LINE_3
define defaultTab = SYSTEM
define tempTab = SYSTEM
col newChange noprint new_value CHANGE_REQD
col line1 noprint new_value LINE_1
col line2 noprint new_value LINE_2
col line3 noprint new_value LINE_3

select decode('&changeReqd', 'Y', 'Y', 'y', 'Y', 'YES', 'Y', 'Yes', 'Y', 'yes','Y', '&changeReqd') newChange
from dual
/
select decode('&CHANGE_REQD', 'Y', 
             'accept defaultTab prompt ''''Default Tablespace ? ''''',
             '') line1
from dual
/
select decode('&CHANGE_REQD', 'Y', 
              'accept tempTab prompt ''''Temporary Tablespace ? ''''',
              '') line2
from dual
/

select '&LINE_1' from dual
UNION
select '&LINE_2' from dual
order by 1 asc

spool tmpbatch.sql
/
spool off

set termout on
start tmpbatch.sql
set termout off

PROMPT
PROMPT

select 'accept foo prompt ''Tablespace names incorrect - Press Enter/Return to Exit ...'''
from dual
where not exists
(select null
 from sys.dba_tablespaces tb1, sys.dba_tablespaces tb2
 where tb1.tablespace_name = '&defaultTab'
 and tb2.tablespace_name = '&tempTab')
and '&CHANGE_REQD' = 'Y'
UNION
select 'exit'
from dual
where not exists
(select null
 from sys.dba_tablespaces tb1, sys.dba_tablespaces tb2
 where tb1.tablespace_name = '&defaultTab'
 and tb2.tablespace_name = '&tempTab')
and '&CHANGE_REQD' = 'Y'
order by 1 asc

spool tmpbatch.sql
/
spool off

set termout on
start tmpbatch.sql
set termout off

select decode('&CHANGE_REQD', 'Y',
              'alter user &Batch_User default tablespace &defaultTab
               temporary tablespace &tempTab
               quota unlimited on &defaultTab
               quota unlimited on &tempTab;',
              '')
from dual

spool tmpbatch.sql
/
spool off

set termout on
start tmpbatch.sql


REM ------------------------------------------------------------------
REM Grant privileges to the Scheduled Workbook Results Schema
REM

PROMPT 
PROMPT Granting Privileges ...
PROMPT

REM ------------------------------------------------------------------
REM cevans - EXECUTE ANY PROCEDURE to set up Apps security context
REM

grant create table, create session, create view, create procedure,
select any table, execute any procedure to &Batch_User;

PROMPT
PROMPT Privileges Granted to Scheduled Workbook Results Schema :
PROMPT Create Table
PROMPT Create Session
PROMPT Create View
PROMPT Create Procedure
PROMPT Select Any Table
PROMPT Execute Any Procedure
PROMPT
PROMPT Select Any Table may be changed manually, but the 
PROMPT Scheduled Workbook Results Schema must have access to underlying
PROMPT User data tables to be used in Scheduled Workbooks
PROMPT Execute Any Procedure may also be changed, but if
PROMPT Using an Applications EUL the Scheduled Workbook Results Schema
PROMPT Must have access to APPS_INITIALIZE()

REM ------------------------------------------------------------------
REM Log in as the Scheduled Workbook Results Schema
REM

connect &Batch_User/&Batch_Pass@&Batch_DBLink;

PROMPT
PROMPT Logged in as Scheduled Workbook Results Schema
PROMPT

REM ------------------------------------------------------------------
REM Check to see if the package EUL5_BATCH_REP_SECURE exists
REM If it does, prompt for whether it should be overwritten
REM

set termout off
define pkgCheck = Y

select 'prompt EUL5_BATCH_REP_SECURE already exists '
from dual
where exists
(select distinct name
 from user_source
 where name = 'EUL5_BATCH_REP_SECURE')
UNION
select 'accept pkgCheck prompt ''Do you wish to replace EUL5_BATCH_REP_SECURE ? [N] '''
from dual
where exists
(select distinct name
 from user_source
 where name = 'EUL5_BATCH_REP_SECURE')
order by 1 desc

spool tmpbatch.sql
/
spool off

set termout on
start tmpbatch.sql
set termout off

select decode('&pkgCheck','N','EXIT',
              'n','EXIT','NO','EXIT',
              'No','EXIT','no','EXIT','')
from dual
UNION
select decode('&pkgCheck','N','accept foo prompt Exiting...',
              'n','accept foo prompt Exiting...','NO','accept foo prompt Exiting...',
              'no','accept foo prompt Exiting...','No','accept foo prompt Exiting...','')
from dual
order by 1 asc

spool tmpbatch.sql
/
spool off

set termout on
start tmpbatch.sql

REM ------------------------------------------------------------------
REM Create the package EUL5_BATCH_REP_SECURE
REM

PROMPT 
PROMPT Creating the package EUL5_BATCH_REP_SECURE ...
PROMPT

set termout off

-- =================================================================================
-- EUL5_BATCH_REP_SECURE SPECIFICATION
-- =================================================================================

CREATE OR REPLACE PACKAGE EUL5_BATCH_REP_SECURE AUTHID DEFINER AS

FUNCTION IsReportValid(eulSchemaName IN VARCHAR2,
                       batchReportId IN NUMBER) RETURN BOOLEAN;

PROCEDURE GetUserLimits(eulSchemaName IN VARCHAR2,
                        batchReportId IN NUMBER,
                        userName      OUT VARCHAR2,
                        commitSize    OUT NUMBER,
                        rowFetchLimit OUT NUMBER);

PROCEDURE SetExpiredRuns(eulSchemaName IN VARCHAR2,
                         userName      IN VARCHAR2);

PROCEDURE SetBatchReportRunInProgress(eulSchemaName    IN VARCHAR2,
                                      batchReportId    IN NUMBER,
                                      batchReportRunNo OUT NUMBER,
                                      batchReportRunId OUT NUMBER);

PROCEDURE ExecuteQuery(eulSchemaName     IN VARCHAR2,
                       timeStamp         IN VARCHAR2,
                       batchReportRunId  IN NUMBER,
                       batchReportRunNo  IN NUMBER,
                       userName          IN VARCHAR2,
                       batchQueryId      IN NUMBER,
                       batchQueryNo      IN NUMBER,
                       createTableCols   IN VARCHAR2,
                       insertStatement   IN varchar2,
                       commitSize        IN NUMBER,
                       rowFetchLimit     IN NUMBER,
                       sumoId            IN NUMBER := NULL);

PROCEDURE ScheduleRun(eulSchemaName    IN VARCHAR2,
                      timeStamp        IN VARCHAR2,
                      batchReportId    IN NUMBER,
                      batchReportRunId IN NUMBER,
                      batchReportRunNo IN NUMBER,
                      error            IN BOOLEAN,
                      startDate        IN DATE);

PROCEDURE ChangeTableSelectAccess(tableName   IN VARCHAR2,
                                 userName    IN VARCHAR2,
                                 doGrant     IN BOOLEAN);

FUNCTION GetViewName(timeStamp    IN VARCHAR2,
                     batchQueryNo IN NUMBER,
                     base         IN BOOLEAN) RETURN VARCHAR2 ;

-- A D M I N I S T R A T O R   M E T H O D S
PROCEDURE CreateView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery  IN VARCHAR2,
                     cols      IN VARCHAR2,
                     base      IN BOOLEAN);

PROCEDURE CreateLargeView(sqlTable IN DBMS_SQL.VARCHAR2S);

PROCEDURE DropViews(timeStamp IN VARCHAR2,
                    queryNo   IN NUMBER);

PROCEDURE DropTable(tableName IN VARCHAR2);

PROCEDURE DropPackage(timeStamp IN VARCHAR2);

PROCEDURE InitializePackage(timeStamp     IN VARCHAR2,
                            eulSchemaName IN VARCHAR2,
                            batchReportId IN NUMBER,
			    preExec       IN VARCHAR2 := '');

PROCEDURE AddQuery(batchQueryId    IN NUMBER,
                   queryNo         IN NUMBER,
                   createTableCols IN VARCHAR2,
                   insertStatement IN VARCHAR2,
                   summaryId       IN NUMBER := NULL);

PROCEDURE CreatePackage(timeStamp IN VARCHAR2);

PROCEDURE SubmitJob(jobNo         OUT NUMBER,
                    timeStamp     IN VARCHAR2,
                    runDate       IN DATE);

PROCEDURE RemoveJob(jobNo            IN NUMBER,
                    handleExceptions IN BOOLEAN := FALSE);

PROCEDURE SetNextDate(jobNo    IN NUMBER,
                      nextDate IN DATE);

PROCEDURE GetVersion(version OUT NUMBER);

PROCEDURE IsGrantedEUL(eulSchemaName IN VARCHAR2);

END EUL5_BATCH_REP_SECURE;
/
-- =================================================================================
-- EUL5_BATCH_REP_SECURE BODY
-- =================================================================================
CREATE OR REPLACE PACKAGE BODY EUL5_BATCH_REP_SECURE AS

-- Global Batch States
BATCH_STATE_SUBMITTED        NUMBER(1) := 1;
BATCH_STATE_IN_PROGRESS      NUMBER(1) := 2;
BATCH_STATE_SUBMISSION_ERROR NUMBER(1) := 3;
BATCH_STATE_RUN_ERROR        NUMBER(1) := 4;
BATCH_STATE_REPORT_DELETED   NUMBER(1) := 5;
BATCH_STATE_EUL_CHANGED      NUMBER(1) := 6;
BATCH_STATE_EXPIRED          NUMBER(1) := 7;
BATCH_STATE_ROW_LIMIT        NUMBER(1) := 8;
BATCH_STATE_READY            NUMBER(1) := 9;

-- Global create package variables
PACKAGE_BODY                 VARCHAR2(32767);
PACKAGE_SPEC                 VARCHAR2(2000);

-- =====================================================================
-- PROCEDURE: DynamicExecute
-- DESCRIPTION: Dynamically executes a SQL statement.
PROCEDURE DynamicExecute(sqlStatement IN VARCHAR2) IS
    cur    INTEGER;
    ignore INTEGER;
BEGIN
    -- NOTE: The return value for EXECUTE is only valid for insert,
    --       update and delete. For DDL statements it should be ignored.
    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    ignore := DBMS_SQL.EXECUTE(cur);
    DBMS_SQL.CLOSE_CURSOR(cur);
END;

-- =====================================================================
-- PROCEDURE: ReplaceEULSchema()
-- DESCRIPTION:  Replaces occurences of <EUL_SCHEMA> with schema name.
PROCEDURE ReplaceEULSchema(eulSchemaName IN VARCHAR2,
                           sqlStatement IN OUT VARCHAR2,
                           bError       IN BOOLEAN := FALSE) IS
BEGIN

    sqlStatement := REPLACE(sqlStatement, '<EUL_SCHEMA>', eulSchemaName);

END ReplaceEULSchema;


-- =====================================================================
-- PROCEDURE: SetStatusExpired()
-- DESCRIPTION:  Set the status of a Batch Report Run to Expired
-- TRANSACTIONS: Transaction block around the SetstatusExpired.
PROCEDURE SetStatusExpired(eulSchemaName IN VARCHAR2,
                           batchReportRunId IN NUMBER) IS

    sqlStatement VARCHAR2(2000);
BEGIN
    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'          || chr(10) ||
                    'SET brr_state = ' || to_char(BATCH_STATE_EXPIRED)   || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    DynamicExecute(sqlStatement);

    -- EXCEPTIONS PROPOGATE UPWARDS

END SetStatusExpired;

-- =====================================================================
-- PROCEDURE: SetStatusSubmissionError()
-- DESCRIPTION:  Set the status of a Batch Report Run to Submission Error
PROCEDURE SetStatusSubmissionError(eulSchemaName IN VARCHAR2,
                                   batchReportRunId IN NUMBER,
								   sqlCode          IN NUMBER,
								   sqlErrm          IN VARCHAR2) IS
    sqlStatement VARCHAR2(2000);
    cur          INTEGER;
    ignore       INTEGER;
BEGIN

    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'                 || chr(10) ||
                    'SET brr_state = ' || to_char(BATCH_STATE_SUBMISSION_ERROR) || ',' || chr(10) ||
					'    brr_svr_err_code = ' || to_char(sqlCode) ||
                    ',   brr_svr_err_text = :sqlErrm'                  || chr(10) ||
                    ',   brr_run_date = SYSDATE ' || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.BIND_VARIABLE(cur, 'sqlErrm', sqlErrm);
    ignore := DBMS_SQL.EXECUTE(cur);
    DBMS_SQL.CLOSE_CURSOR(cur);

    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN;

END SetStatusSubmissionError;

-- =====================================================================
-- PROCEDURE: SetBatchReportCompletionInfo()
-- DESCRIPTION: Sets the elapsed time, next run date and job number.
PROCEDURE SetBatchReportCompletionInfo(eulSchemaName    IN VARCHAR2,
                                       batchReportId    IN NUMBER,
                                       batchReportRunId IN NUMBER,
                                       startDate        IN DATE,
                                       throwException   IN BOOLEAN := FALSE,
                                       nextRunDate      IN DATE := NULL,
                                       jobNo            IN NUMBER := NULL) IS

    cur          INTEGER;
    ignore       INTEGER;
    sqlStatement VARCHAR2(2000);
BEGIN

    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'                                          || chr(10) ||
                    'SET brr_act_elap_time = round(to_number((SYSDATE - :startDate) * 86400), 0)'  || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.BIND_VARIABLE(cur, 'startDate', startDate);
    ignore := DBMS_SQL.EXECUTE(cur);

    COMMIT;
    IF(jobNo IS NOT NULL) THEN
    	sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_batch_reports'    || chr(10) ||
                    'SET br_next_run_date = :nextRunDate,'     || chr(10) ||
                    '    br_job_id = ' || to_char(jobNo)       || chr(10) ||
                    'WHERE br_id = ' || to_char(batchReportId);

    	ReplaceEULSchema(eulSchemaName, sqlStatement);

    	DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    	DBMS_SQL.BIND_VARIABLE(cur, 'nextRunDate', nextRunDate);
    	ignore := DBMS_SQL.EXECUTE(cur);
    	DBMS_SQL.CLOSE_CURSOR(cur);
   END IF;
    IF (throwException = FALSE) THEN
        COMMIT;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        IF (throwException = TRUE) THEN
            RAISE;
        END IF;

END SetBatchReportCompletionInfo;

-- =====================================================================
-- PROCEDURE: SetStatusReady()
-- DESCRIPTION: Update the status to Ready
--              ready, elapsed time and job no.
--              If an error then updates the elapsed time.
PROCEDURE SetStatusReady(eulSchemaName    IN VARCHAR2,
                         batchReportRunId IN NUMBER) IS

    sqlStatement VARCHAR2(2000);
BEGIN

    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'      || chr(10) ||
                    'SET brr_state = ' || to_char(BATCH_STATE_READY) || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    DynamicExecute(sqlStatement);

EXCEPTION
    WHEN OTHERS THEN
        RETURN;

END SetStatusReady;

-- =====================================================================
-- PROCEDURE: SetExpiredRuns()
-- DESCRIPTION:  Sets the status of the expired Batch Report Runs for
--               the current user. Only set Batch Report Runs to expired
--               if they are ready. All error status' are kept in tact
--               ready for viewing.
-- TRANSACTIONS: Transaction block around the SetStatusExpired.
PROCEDURE SetExpiredRuns(eulSchemaName IN VARCHAR2,
                         userName      IN VARCHAR2) IS

    cur              INTEGER;
    ignore           INTEGER;
    sqlStatement     VARCHAR2(2000);
    batchReportRunId NUMBER(22);
    noRows           NUMBER := 1;

BEGIN

    sqlStatement := 'SELECT brr.brr_id'                                                      || chr(10) ||
                    'FROM <EUL_SCHEMA>.eul5_br_runs brr,'                           || chr(10) ||
                    '<EUL_SCHEMA>.eul5_batch_reports br, <EUL_SCHEMA>.eul5_eul_users eu'       || chr(10) ||
                    'WHERE eu.eu_username = ''' || userName || ''''                          || chr(10) ||
                    'AND eu.eu_id = br.br_eu_id'                                             || chr(10) ||
                    'AND br.br_id = brr.brr_br_id'                                           || chr(10) ||
                    'AND brr.brr_state = ' || to_char(BATCH_STATE_READY)                     || chr(10) ||
                    'AND brr.brr_run_date + br.br_expiry < SYSDATE';

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, batchReportRunId);
    ignore := DBMS_SQL.EXECUTE(cur);

    LOOP
        IF DBMS_SQL.FETCH_ROWS(cur) > 0 THEN
            DBMS_SQL.COLUMN_VALUE(cur, 1, batchReportRunId);
            BEGIN
                SetStatusExpired(eulSchemaName, batchReportRunId);
                noRows := noRows + 1;
                COMMIT;
            EXCEPTION
                WHEN OTHERS THEN
                -- Rollback and attempt the next expiry update
                ROLLBACK;
            END;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    DBMS_SQL.CLOSE_CURSOR(cur);

END SetExpiredRuns;

-- =====================================================================
-- PROCEDURE: DropTable()
-- DESCRIPTION: Generic drop table routine.
PROCEDURE DropTable(tableName IN VARCHAR2) IS

    tableSQL VARCHAR2(50);

BEGIN
    tableSQL := 'DROP TABLE ' || tableName;
    DynamicExecute(tableSQL);

END DropTable;

-- =====================================================================
-- PROCEDURE: DeleteBatchQueryEntries()
-- DESCRIPTION: Delete the Batch Query row ans associated result set
--              table.
PROCEDURE DeleteBatchQueryEntries(eulSchemaName IN VARCHAR2,
                                  batchReportRunId IN NUMBER) IS

    curSelect           INTEGER;
    curDelete           INTEGER;
    ignore              INTEGER;
    sqlSelect           VARCHAR2(2000);
    sqlDelete           VARCHAR2(2000);
    batchQueryTableId   NUMBER(22);
    batchQueryTableName VARCHAR2(128);

BEGIN

    sqlSelect := 'SELECT bqt_id, bqt_table_name'              || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_bq_tables'   || chr(10) ||
                 'WHERE bqt_brr_id = ' || to_char(batchReportRunId);

    sqlDelete := 'DELETE FROM <EUL_SCHEMA>.eul5_bq_tables' || chr(10) ||
                 'WHERE bqt_id = :batchQueryTableId';

    ReplaceEULSchema(eulSchemaName, sqlSelect);
    ReplaceEULSchema(eulSchemaName, sqlDelete);

    curSelect := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(curSelect, sqlSelect, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(curSelect, 1, batchQueryTableId);
    DBMS_SQL.DEFINE_COLUMN(curSelect, 2, batchQueryTableName, 128);
    ignore := DBMS_SQL.EXECUTE(curSelect);

    curDelete := DBMS_SQL.OPEN_CURSOR;

    DBMS_SQL.PARSE(curDelete, sqlDelete, DBMS_SQL.V7);

    LOOP
        IF DBMS_SQL.FETCH_ROWS(curSelect) > 0 THEN
            DBMS_SQL.COLUMN_VALUE(curSelect, 1, batchQueryTableId);
            DBMS_SQL.COLUMN_VALUE(curSelect, 2, batchQueryTableName);

            BEGIN
                -- Delete the entry in Batch Query Table
                DBMS_SQL.BIND_VARIABLE(curDelete, 'batchQueryTableId', batchQueryTableId);
                ignore := DBMS_SQL.EXECUTE(curDelete);

                -- Drop the associated table
                -- DDL - Implicit COMMIT or ROLLBACK
                dropTable(batchQueryTableName);
            EXCEPTION
                WHEN OTHERS THEN
                    ROLLBACK;   -- Dummy rollback - Not necessary
            END;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    DBMS_SQL.CLOSE_CURSOR(curSelect);
    DBMS_SQL.CLOSE_CURSOR(curDelete);

END DeleteBatchQueryEntries;

-- =====================================================================
-- PROCEDURE: SetStatusRowLimit()
-- DESCRIPTION: Set the status of Report Run to Row Limit Exceeded
-- TRANSACTIONS: Ignore all exceptions
PROCEDURE SetStatusRowLimit(eulSchemaName IN VARCHAR2,
                            batchReportRunId IN NUMBER) IS

    sqlStatement VARCHAR2(2000);

BEGIN

    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'             || chr(10) ||
                    'SET brr_state = ' || to_char(BATCH_STATE_ROW_LIMIT)    || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);
    DynamicExecute(sqlStatement);

    COMMIT;

    DeleteBatchQueryEntries(eulSchemaName, batchReportRunId);

    EXCEPTION
        WHEN OTHERS THEN
            RETURN;

END SetStatusRowLimit;

-- =====================================================================
-- PROCEDURE: SetStatusRunError()
-- DESCRIPTION: Set the status of a Batch Report Run to Run Error
-- TRANSACTIONS: Ignore all exceptions
PROCEDURE SetStatusRunError(eulSchemaName    IN VARCHAR2,
                            batchReportRunId IN NUMBER,
                            sqlCode          IN NUMBER,
                            sqlErrm          IN VARCHAR2) IS

    sqlStatement VARCHAR2(32767);
    cur          INTEGER;
    ignore       INTEGER;

BEGIN
    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'             || chr(10) ||
                    'SET brr_state = ' || BATCH_STATE_RUN_ERROR || ','      || chr(10) ||
                    '   brr_svr_err_code = ' || to_char(sqlCode) ||
                    ',   brr_svr_err_text = :sqlErrm'                  || chr(10) ||
                    ',   brr_run_date = SYSDATE' || chr(10) ||
                    'WHERE brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.BIND_VARIABLE(cur, 'sqlErrm', sqlErrm);
    ignore := DBMS_SQL.EXECUTE(cur);
    DBMS_SQL.CLOSE_CURSOR(cur);

    COMMIT;

    DeleteBatchQueryEntries(eulSchemaName, batchReportRunId);

    EXCEPTION
        WHEN OTHERS THEN
            RETURN;

END SetStatusRunError;

-- =====================================================================
-- PROCEDURE: SetStatusReady()
-- DESCRIPTION: Update the status to Ready
--              ready, elapsed time and job no.
--              If an error then updates the elapsed time.
PROCEDURE InitializeJobNextRun(eulSchemaName    IN VARCHAR2,
                               batchReportRunId IN NUMBER) IS

    sqlStatement VARCHAR2(2000);

BEGIN

    sqlStatement := 'UPDATE <EUL_SCHEMA>.eul5_batch_reports'  || chr(10) ||
                    'SET br_job_id = NULL,'                  || chr(10) ||
                    '    br_next_run_date = NULL'            || chr(10) ||
                    'WHERE br_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);
    DynamicExecute(sqlStatement);

    COMMIT;

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;

END InitializeJobNextRun;

-- =====================================================================
-- FUNCTION: IsReportValid()
-- DESCRIPTION: Checks Batch Report Run to ensure that the state of the
--              EUL has not changed. Checks that Batch Report has not
--              been set to deleted.

FUNCTION IsReportValid(eulSchemaName IN VARCHAR2,
                       batchReportId IN NUMBER) RETURN BOOLEAN IS

    cur             INTEGER;
    sqlEULChanged   VARCHAR2(2000);
    sqlRunDeleted   VARCHAR2(2000);
    sqlTotalRuns    VARCHAR2(2000);
    ignore          INTEGER;
    countEULChanged NUMBER;
    countRunDeleted NUMBER;
    countTotalRuns  NUMBER;
    reportValid     BOOLEAN := TRUE;

BEGIN
    cur := DBMS_SQL.OPEN_CURSOR;

    sqlEULChanged := 'SELECT count(*)'                                          || chr(10) ||
                     'FROM <EUL_SCHEMA>.eul5_batch_reports br,'                  || chr(10) ||
                     '     <EUL_SCHEMA>.eul5_br_runs brr'              || chr(10) ||
                     'WHERE br.br_id = ' || to_char(batchReportId)              || chr(10) ||
                     'AND br.br_id = brr.brr_br_id'                             || chr(10) ||
                     'AND brr.brr_state = ' || to_char(BATCH_STATE_EUL_CHANGED);

    sqlRunDeleted := 'SELECT count(*)'                                          || chr(10) ||
                     'FROM <EUL_SCHEMA>.eul5_br_runs'                  || chr(10) ||
                     'WHERE brr_state = ' || to_char(BATCH_STATE_REPORT_DELETED);

    sqlTotalRuns := 'SELECT count(*)'                                           || chr(10) ||
                    'FROM <EUL_SCHEMA>.eul5_br_runs';

    ReplaceEULSchema(eulSchemaName, sqlEULChanged);
    ReplaceEULSchema(eulSchemaName, sqlRunDeleted);
    ReplaceEULSchema(eulSchemaName, sqlTotalRuns);

    DBMS_SQL.PARSE(cur, sqlEULChanged, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, countEULChanged);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, countEULChanged);

    IF (countEULChanged > 0) THEN
        reportValid := FALSE;
    ELSE
        -- Check that the report has not been deleted
        -- Total the number of runs deleted
        DBMS_SQL.PARSE(cur, sqlRunDeleted, DBMS_SQL.V7);
        DBMS_SQL.DEFINE_COLUMN(cur, 1, countRunDeleted);
        ignore := DBMS_SQL.EXECUTE(cur);
        ignore := DBMS_SQL.FETCH_ROWS(cur);
        DBMS_SQL.COLUMN_VALUE(cur, 1, countRunDeleted);

        -- Total the number of runs
        DBMS_SQL.PARSE(cur, sqlTotalRuns, DBMS_SQL.V7);
        DBMS_SQL.DEFINE_COLUMN(cur, 1, countTotalRuns);
        ignore := DBMS_SQL.EXECUTE(cur);
        ignore := DBMS_SQL.FETCH_ROWS(cur);
        DBMS_SQL.COLUMN_VALUE(cur, 1, countTotalRuns);

        IF (countRunDeleted = countTotalRuns) THEN
            reportValid := FALSE;
        END IF;
    END IF;

    DBMS_SQL.CLOSE_CURSOR(cur);

    IF (reportValid = FALSE) THEN
        InitializeJobNextRun(eulSchemaName, batchReportId);
        RETURN FALSE;
    END IF;

    RETURN TRUE;

END IsReportValid;

-- =====================================================================
-- PROCEDURE: GetUserLimits
-- DESCRIPTION: Retrieve the commit size and the row limit.
--              Report Id can be used to retrieve the user name.
PROCEDURE GetUserLimits(eulSchemaName IN VARCHAR2,
                        batchReportId IN NUMBER,
                        userName      OUT VARCHAR2,
                        commitSize    OUT NUMBER,
                        rowFetchLimit OUT NUMBER) IS

    cur              INTEGER;
    ignore           INTEGER;
    sqlStatement     VARCHAR2(2000);
    tmpCommitSize    NUMBER(22);
    tmpRowFetchLimit NUMBER(22);
    tmpUserName      VARCHAR2(128);

BEGIN

    cur := DBMS_SQL.OPEN_CURSOR;

    sqlStatement := 'SELECT eu.eu_batch_cmt_sz, eu.eu_row_fetch_lmt, eu.eu_username' || chr(10) ||
                    'FROM <EUL_SCHEMA>.eul5_eul_users eu, <EUL_SCHEMA>.eul5_batch_reports br' || chr(10) ||
                    'WHERE br.br_id = ' || batchReportId                                    || chr(10) ||
                    'AND br.br_eu_id = eu.eu_id';

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, tmpCommitSize);
    DBMS_SQL.DEFINE_COLUMN(cur, 2, tmpRowFetchLimit);
    DBMS_SQL.DEFINE_COLUMN(cur, 3, tmpUserName, 128);

    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, tmpCommitSize);
    DBMS_SQL.COLUMN_VALUE(cur, 2, tmpRowFetchLimit);
    DBMS_SQL.COLUMN_VALUE(cur, 3, tmpUserName);

    DBMS_SQL.CLOSE_CURSOR(cur);

    userName := tmpUserName;
    commitSize := tmpCommitSize;
    rowFetchLimit := tmpRowFetchLimit;

END GetUserLimits;

-- =====================================================================
-- PROCEDURE: setBatchReportRunInProgress
-- DESCRIPTION: Set the status to 'In Progress' and update the Run Date.
-- TRANSACTIONS:
PROCEDURE SetBatchReportRunInProgress(eulSchemaName    IN VARCHAR2,
                                      batchReportId    IN NUMBER,
                                      batchReportRunNo OUT NUMBER,
                                      batchReportRunId OUT NUMBER) IS

    cur                 INTEGER;
    ignore              INTEGER;
    sqlSelect           VARCHAR2(2000);
    sqlUpdate           VARCHAR2(2000);
    locBatchReportRunId NUMBER(22);
    locBatchReportRunNo NUMBER(22);

BEGIN
    cur := DBMS_SQL.OPEN_CURSOR;

    sqlSelect := 'SELECT brr_id, brr_run_number'                 || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_br_runs'       || chr(10) ||
                 'WHERE brr_br_id = ' || to_char(batchReportId)  || chr(10) ||
                 'ORDER BY brr_run_number DESC';

    ReplaceEULSchema(eulSchemaName, sqlSelect);

    DBMS_SQL.PARSE(cur, sqlSelect, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, locBatchReportRunId);
    DBMS_SQL.DEFINE_COLUMN(cur, 2, locBatchReportRunNo);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, locBatchReportRunId);
    DBMS_SQL.COLUMN_VALUE(cur, 2, locBatchReportRunNo);

    sqlUpdate := 'UPDATE <EUL_SCHEMA>.eul5_br_runs'                   || chr(10) ||
                 'SET brr_state = ' || to_char(BATCH_STATE_IN_PROGRESS) || ',' || chr(10) ||
                 '    brr_run_date = SYSDATE'                                  || chr(10) ||
                 '    WHERE brr_id = ' || to_char(locBatchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlUpdate);

    DBMS_SQL.PARSE(cur, sqlUpdate, DBMS_SQL.V7);
    ignore := DBMS_SQL.EXECUTE(cur);
    DBMS_SQL.CLOSE_CURSOR(cur);

    COMMIT;

    batchReportRunNo := locBatchReportRunNo;
    batchReportRunId := locBatchReportRunId;

    EXCEPTION
        WHEN OTHERS THEN
            -- Attempt to set the status of the Batch Report Run to Run Error
            SetStatusRunError(eulSchemaName, locBatchReportRunId, SQLCODE, SUBSTR(SQLERRM, 1, 240));
            -- Raise to be caught in the client and skip query execution
            RAISE;

END SetBatchReportRunInProgress;

-- =====================================================================
-- FUNCTION: CreateObjectPrefix
-- DESCRIPTION: Create the Object prefix string:
--              EUL5_BYYMMDDHHMISSQQQQQQQ
--                                123456
FUNCTION CreateObjectPrefix(timeStamp    IN VARCHAR2,
                            batchQueryNo IN NUMBER) RETURN VARCHAR2 IS

BEGIN

    RETURN 'EUL5_B' || timeStamp || 'Q' || batchQueryNo;

END CreateObjectPrefix;

-- =====================================================================
-- FUNCTION: CreateTableName()
-- DESCRIPTION: Create the table name from the formula:
--              EUL5_BATCH <BQ_ID> RUN <BRR_RUN>.
FUNCTION CreateTableName(timeStamp        IN VARCHAR2,
                         batchQueryNo     IN NUMBER,
                         batchReportRunNo IN NUMBER) RETURN VARCHAR2 IS

    tableName VARCHAR2(30);

BEGIN
    tableName := CreateObjectPrefix(timeStamp, batchQueryNo);

    tableName := tableName || 'R' || to_char(batchReportRunNo);

    RETURN tableName;

END CreateTableName;

-- =====================================================================
-- PROCEDURE: CreateTableSQL()
-- DESCRIPTION: Create the result set table from the formula:
PROCEDURE CreateTableSQL(timeStamp        IN VARCHAR2,
                         batchQueryNo     IN NUMBER,
                         batchReportRunNo IN NUMBER,
                         createTableCols  IN VARCHAR2,
                         tableName        OUT VARCHAR2,
                         createTableSQL   OUT VARCHAR2) IS

    locTableName      VARCHAR2(30);
    locCreateTableSQL VARCHAR2(32767);

BEGIN

    locTableName := CreateTableName(timeStamp, batchQueryNo, batchReportRunNo);

    locCreateTableSQL := 'CREATE TABLE ' || locTableName || ' (' || createTableCols || ')';

    tableName := locTableName;
    createTableSQL := locCreateTableSQL;

END CreateTableSQL;

-- =====================================================================
-- PROCEDURE: DeleteBatchReportRun()
-- DESCRIPTION: Delete specified batch report run and batch query table.
PROCEDURE DeleteBatchReportRun(eulSchemaName IN VARCHAR2,
                               batchReportRunId IN NUMBER) IS

  sqlSelect           VARCHAR2(2000);
BEGIN
  DeleteBatchQueryEntries(eulSchemaName, batchReportRunId);
  sqlSelect := 'DELETE FROM <EUL_SCHEMA>.eul5_br_runs ' || chr(10) ||
               'WHERE BRR_ID = ' || to_char(batchReportRunId);
  ReplaceEULSchema(eulSchemaName, sqlSelect);
  DynamicExecute(sqlSelect);
END DeleteBatchReportRun;

-- =====================================================================
-- PROCEDURE: DeleteReusedRuns()
-- DESCRIPTION: Delete the all runs except specified
PROCEDURE DeleteReusedRuns(eulSchemaName IN VARCHAR2,
                           excludeReportRunId IN NUMBER) IS
  sqlSelect   VARCHAR2(2000);
  SelectCur   INTEGER;
  ignore      INTEGER;
  reportRunId INTEGER;
BEGIN
  sqlSelect := 'SELECT brr_id ' || chr(10) ||
               'FROM <EUL_SCHEMA>.eul5_br_runs ' || chr(10) ||
               'WHERE brr_id <> ' || to_char(excludeReportRunId) || chr(10) ||
               'AND brr_br_id = (SELECT brr_br_id FROM <EUL_SCHEMA>.eul5_br_runs ' || chr(10) ||
               'WHERE brr_id = ' || to_char(excludeReportRunId) || ')';

  ReplaceEULSchema(eulSchemaName, sqlSelect);
  SelectCur := DBMS_SQL.OPEN_CURSOR;
  DBMS_SQL.PARSE(SelectCur, sqlSelect, DBMS_SQL.V7);
  DBMS_SQL.DEFINE_COLUMN(SelectCur, 1, reportRunId);
  ignore := DBMS_SQL.EXECUTE(SelectCur);
  LOOP
    EXIT WHEN DBMS_SQL.FETCH_ROWS(SelectCur) = 0;
    DBMS_SQL.COLUMN_VALUE(SelectCur, 1, reportRunId);
    DeleteBatchReportRun(eulSchemaName, reportRunId);
  END LOOP;
  DBMS_SQL.CLOSE_CURSOR(SelectCur);
END DeleteReusedRuns;

-- =====================================================================
-- PROCEDURE: ReuseBatchQueryTable()
-- DESCRIPTION: Search for an entry in Batch Query Tables
FUNCTION ReuseBatchQueryTable(eulSchemaName    IN VARCHAR2,
                               batchReportRunId IN NUMBER,
                               batchQueryId     IN NUMBER,
                               tableName IN OUT VARCHAR2) RETURN BOOLEAN IS

    sqlSelect         VARCHAR2(2000);
    sqlUpdate         VARCHAR2(2000);
    sqlDelete         VARCHAR2(2000);
    SelectCur         INTEGER;
    ignore              INTEGER;
    reuseBatchReportRunId NUMBER;
    reuseBatchQueryTableId NUMBER;

BEGIN

    sqlSelect := 'SELECT bqt_table_name, bqt_id, brr_id ' || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_bq_tables, <EUL_SCHEMA>.eul5_br_runs' || chr(10) ||
                 'WHERE (bqt_brr_id = brr_id) AND (brr_state NOT IN (' || chr(10) ||
                 to_char(BATCH_STATE_SUBMITTED) || ', ' || chr(10) ||
                 to_char(BATCH_STATE_IN_PROGRESS) || ', ' || chr(10) ||
                 to_char(BATCH_STATE_SUBMISSION_ERROR) || ', ' || chr(10) ||
                 to_char(BATCH_STATE_RUN_ERROR) || ', ' || chr(10) ||
                 to_char(BATCH_STATE_EUL_CHANGED) || ')) ' || chr(10) ||
                 ' AND (bqt_bq_id = ' || to_char(batchQueryId) || ') ' || chr(10) ||
                 ' AND (brr_id <> ' || to_char(batchReportRunId) || ') ' || chr(10) ||
                 ' AND (brr_br_id = (SELECT brr_br_id FROM <EUL_SCHEMA>.eul5_br_runs ' || chr(10) ||
                 '                   WHERE brr_id = ' || to_char(batchReportRunId) || ')) ' || chr(10) ||
                 'ORDER BY brr_run_number DESC'; 

    ReplaceEULSchema(eulSchemaName, sqlSelect);

    SelectCur := DBMS_SQL.OPEN_CURSOR;

    DBMS_SQL.PARSE(SelectCur, sqlSelect, DBMS_SQL.V7);

    DBMS_SQL.DEFINE_COLUMN(SelectCur, 1, tableName, 64);
    DBMS_SQL.DEFINE_COLUMN(SelectCur, 2, reuseBatchQueryTableId);
    DBMS_SQL.DEFINE_COLUMN(SelectCur, 3, reuseBatchReportRunId);

    ignore := DBMS_SQL.EXECUTE(SelectCur);

    IF (DBMS_SQL.FETCH_ROWS(SelectCur) = 0) THEN
      RETURN (FALSE);
    END IF;

    DBMS_SQL.COLUMN_VALUE(SelectCur, 1, tableName);
    DBMS_SQL.COLUMN_VALUE(SelectCur, 2, reuseBatchQueryTableId);
    DBMS_SQL.COLUMN_VALUE(SelectCur, 3, reuseBatchReportRunId);

    DBMS_SQL.CLOSE_CURSOR(SelectCur);

    -- DDL - Implicit commit or rollback
    DynamicExecute('TRUNCATE TABLE ' || tableName || ' REUSE STORAGE');

    sqlUpdate := 'UPDATE <EUL_SCHEMA>.eul5_bq_tables' || chr(10) ||
                  'SET bqt_brr_id = ' || to_char(batchReportRunId) || chr(10) ||
                  'WHERE bqt_id = ' || to_char(reuseBatchQueryTableId);

    ReplaceEULSchema(eulSchemaName, sqlUpdate);

    DynamicExecute(sqlUpdate);

    sqlDelete := 'DELETE FROM <EUL_SCHEMA>.eul5_br_runs' || chr(10) ||
                  'WHERE brr_id = ' || to_char(reuseBatchReportRunId) || chr(10) ||
                  'AND NOT EXISTS (SELECT bqt_id FROM <EUL_SCHEMA>.eul5_bq_tables WHERE ' || chr(10) ||
                                   'bqt_brr_id = ' || to_char(reuseBatchReportRunId) || ')';

    ReplaceEULSchema(eulSchemaName, sqlDelete);

    DynamicExecute(sqlDelete);

    DeleteReusedRuns(eulSchemaName, batchReportRunId);

    RETURN (TRUE);

    EXCEPTION
      WHEN OTHERS THEN
          -- No rollback because if truncate table fails we have an implicit rollback.
          SetStatusRunError(eulSchemaName, batchReportRunId, SQLCODE, SUBSTR(SQLERRM, 1, 240));
          -- Raise an exception to be caught by client and skip query execution
          RAISE;

END ReuseBatchQueryTable;

-- =====================================================================
-- PROCEDURE: InsertBatchQueryTable()
-- DESCRIPTION: Insert a new row into Batch Query Table and create the
--              Result Set table
FUNCTION InsertBatchQueryTable(eulSchemaName    IN VARCHAR2,
                               timeStamp        IN VARCHAR2,
                               userName         IN VARCHAR2,
                               batchReportRunId IN NUMBER,
                               batchReportRunNo IN NUMBER,
                               batchQueryId     IN NUMBER,
                               batchQueryNo     IN NUMBER,
                               createTableCols  IN VARCHAR2) RETURN VARCHAR2 IS

    locTableName      VARCHAR2(30);
    locCreateTableSQL VARCHAR2(32767);
    sqlInsert         VARCHAR2(2000);

BEGIN

DECLARE
	probably_apps_username EXCEPTION;
	PRAGMA EXCEPTION_INIT(probably_apps_username, -1917);

BEGIN
    -- Create the table SQL
    CreateTableSQL(timeStamp, batchQueryNo, batchReportRunNo, createTableCols, locTableName, locCreateTableSQL);

    -- Add a row into Batch Query Table
    sqlInsert := 'INSERT INTO <EUL_SCHEMA>.eul5_bq_tables(bqt_id, bqt_bq_id, bqt_brr_id, bqt_table_name, bqt_element_state, bqt_created_by, bqt_created_date)' || chr(10) ||
                 'VALUES (<EUL_SCHEMA>.eul5_id_seq.nextval, ' || to_char(batchQueryId) || ', ' || to_char(batchReportRunId) || ', '''
                 || locTableName || ''', 0, USER, SYSDATE)';

    ReplaceEULSchema(eulSchemaName, sqlInsert);

    DynamicExecute(sqlInsert);

    -- DDL - Implicit commit or rollback
    DynamicExecute(locCreateTableSQL);

    -- Grant execute on the result set table to the user 
    DynamicExecute('GRANT SELECT ON ' || locTableName || ' TO "' || userName || '"');

    RETURN locTableName;

    EXCEPTION
	WHEN probably_apps_username THEN
		-- The GRANT was to a non existent user. Probably an APPS user
		-- of the form #123. Silently ignore as the APPS database user
		-- seems to have SELECT ANY TABLE
		RETURN locTableName;

        WHEN OTHERS THEN
            -- No rollback because if create table fails we have an implicit rollback.
            -- If the insert fails we have a statement level rollback.
            SetStatusRunError(eulSchemaName, batchReportRunId, SQLCODE, SUBSTR(SQLERRM, 1, 240));
            -- Raise an exception to be caught by client and skip query execution
            RAISE;
END;
END InsertBatchQueryTable;

-- =====================================================================
-- PROCEDURE: GetViewName()
-- DESCRIPTION: Build the view string based on:
--              EUL5_BATCH <Batch Query Id> VIEW <BSE>/<SUM>
--              The Batch Query Id is unique across the EUL.
FUNCTION GetViewName(timeStamp    IN VARCHAR2,
                     batchQueryNo IN NUMBER,
                     base         IN BOOLEAN) RETURN VARCHAR2 IS

    viewName VARCHAR2(30);

BEGIN
    viewName := CreateObjectPrefix(timeStamp, batchQueryNo);

    IF (base = TRUE) THEN
        viewName := viewName || 'V1';
    ELSE
        viewName := viewName || 'V2';
    END IF;

    RETURN viewName;

END GetViewName;

-- =====================================================================
-- FUNCTION: GetSummaryState()
-- DESCRIPTION: Retrieves the state of the Summary used.
--              If an error occurs, ie the Summary has been deleted an
--              exception will be produced. The failed state (4) is
--              returned.
FUNCTION GetSummaryState(eulSchemaName    IN VARCHAR2,
                         sumoId IN number) RETURN NUMBER IS

    cur    INTEGER;
    ignore INTEGER;

    retState     NUMBER;
    sqlStatement VARCHAR2(2000);

BEGIN
    cur := DBMS_SQL.OPEN_CURSOR;

    sqlStatement := 'SELECT NVL(ems_state, 0)'            || chr(10) ||
                    'FROM <EUL_SCHEMA>.eul5_summary_objs' || chr(10) ||
                    'WHERE sumo_id = ' || to_char(sumoId);

    ReplaceEULSchema(eulSchemaName, sqlStatement);

    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, retState);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, retState);
    DBMS_SQL.CLOSE_CURSOR(cur);

    RETURN retState;

    -- The row may not exist
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 4;

END GetSummaryState;

-- =====================================================================
-- FUNCTION: IsMVSummary()
-- DESCRIPTION: Determines whether the summary references a
--              materialized view.
FUNCTION IsMVSummary(eulSchemaName IN VARCHAR2,
                     sumoId IN number) RETURN BOOLEAN IS
  cur    INTEGER;
  ignore INTEGER;
  sqlStatement VARCHAR2(2000);
  serverMV NUMBER;
BEGIN
  cur := DBMS_SQL.OPEN_CURSOR;
  sqlStatement := 'SELECT DECODE(sumo_type, ''SMS'', 1, 0)'       || chr(10) ||
                  'FROM <EUL_SCHEMA>.eul5_summary_objs'            || chr(10) ||
                  'WHERE sumo_id = ' || to_char(sumoId);

  ReplaceEULSchema(eulSchemaName, sqlStatement);

  DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.v7);
  DBMS_SQL.DEFINE_COLUMN(cur, 1, serverMV);
  ignore := DBMS_SQL.EXECUTE(cur);
  ignore := DBMS_SQL.FETCH_ROWS(cur);
  DBMS_SQL.COLUMN_VALUE(cur, 1, serverMV);
  DBMS_SQL.CLOSE_CURSOR(cur);
  IF (serverMV = 1) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END IsMVSummary;

-- =====================================================================
-- FUNCTION: GetSummaryState()
-- DESCRIPTION: If the sumoId is not NULL then we can attempt to execute
--              against a Summary.
--              If an error occurs, ie the Summary has been deleted an
--              exception will be produced. The failed state (4) is
--              returned.
FUNCTION UseSummary(eulSchemaName IN VARCHAR2,
                    sumoId IN NUMBER) RETURN BOOLEAN IS

    summState NUMBER;
BEGIN
    IF sumoId IS NOT NULL THEN
        IF (IsMVSummary(eulSchemaName, sumoId) = TRUE) THEN
          RETURN TRUE;
        END IF;
        summState := GetSummaryState(eulSchemaName, sumoId);

        IF (summState = 3) OR (summState = 6) OR (summState = 0) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;

END UseSummary;

-- =====================================================================
-- PROCEDURE: GrantQueryTableAccess()
-- DESCRIPTION: Retrieves the list of grantees for the corresponding scheduled workbook
--              and grants SELECT access on the query table.
PROCEDURE GrantQueryTableAccess(eulSchemaName     IN VARCHAR2,
                       batchReportRunId  IN NUMBER,
                       queryTableName    IN VARCHAR2) IS

    sqlSelect           VARCHAR2(2000);
    userName            VARCHAR2(100);
    SelectCur           INTEGER;
    ignore               INTEGER;
    err_num NUMBER;
    err_msg VARCHAR2(100);

BEGIN
    sqlSelect := 'SELECT usr.eu_username' || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_br_runs brr, <EUL_SCHEMA>.eul5_batch_reports br, <EUL_SCHEMA>.eul5_documents doc,' || chr(10) ||
                 '<EUL_SCHEMA>.eul5_access_privs ap, <EUL_SCHEMA>.eul5_eul_users usr' || chr(10) ||
                 'WHERE brr.brr_id = ' || to_char(batchReportRunId) || chr(10) ||
                 'AND brr.brr_br_id = br.br_id' || chr(10) ||
                 'AND br.br_name = doc.doc_name' || chr(10) ||
                 'AND br.br_eu_id = doc.doc_eu_id' || chr(10) ||
                 'AND doc.doc_id = ap.gd_doc_id' || chr(10) ||
                 'AND ap.ap_eu_id = usr.eu_id';

    ReplaceEULSchema(eulSchemaName, sqlSelect);

    SelectCur := DBMS_SQL.OPEN_CURSOR;

    DBMS_SQL.PARSE(SelectCur, sqlSelect, DBMS_SQL.V7);

    DBMS_SQL.DEFINE_COLUMN(SelectCur, 1, userName, 64);

    ignore := DBMS_SQL.EXECUTE(SelectCur);

    LOOP
      EXIT WHEN DBMS_SQL.FETCH_ROWS(SelectCur) = 0;
      DBMS_SQL.COLUMN_VALUE(SelectCur, 1, userName);

      ChangeTableSelectAccess(queryTableName, userName, TRUE);

    END LOOP;

    DBMS_SQL.CLOSE_CURSOR(SelectCur);

EXCEPTION
    WHEN OTHERS THEN
      err_num := SQLCODE;
      err_msg := SUBSTR(SQLERRM, 1, 100);

END GrantQueryTableAccess;

-- =====================================================================
-- PROCEDURE: ChangeTableSelectAccess()
-- DESCRIPTION: Grants or revokes SELECT access on a specified table to a specified user.
-- If doGrant boolean parameter is TRUE then grant else revoke, SELECT privilege.
PROCEDURE ChangeTableSelectAccess(tableName     IN VARCHAR2,
                        userName    IN VARCHAR2,
                        doGrant     IN BOOLEAN) IS

    sqlGrant            VARCHAR2(2000);
    grantCur            INTEGER;
    ignore               INTEGER;
    err_num NUMBER;
    err_msg VARCHAR2(100);

BEGIN
    IF (doGrant = TRUE) THEN
      sqlGrant := 'GRANT SELECT ON ' || tableName || ' TO ' || userName;
    ELSE
      sqlGrant := 'REVOKE SELECT ON ' || tableName || ' FROM ' || userName;
    END IF;

    grantCur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(grantCur, sqlGrant, DBMS_SQL.V7);

    ignore := DBMS_SQL.EXECUTE(grantCur);
    DBMS_SQL.CLOSE_CURSOR(grantCur);

EXCEPTION
    WHEN OTHERS THEN
      err_num := SQLCODE;
      err_msg := SUBSTR(SQLERRM, 1, 100);

END ChangeTableSelectAccess;

-- =====================================================================
-- PROCEDURE: TryExecuteQuery()
-- DESCRIPTION: Attempts to execute the query. If a summary can be used
--              then the state is checked. If not valid then goes against
--              base data.
--              If a summary fails then attempts against the base.
-- TRANSACTIONS: Exceptions trapped, and if against base then error status
--               updated and exception raised. If against summary then
--               base data attempted.
PROCEDURE TryExecuteQuery (eulSchemaName      IN VARCHAR2,
                           timeStamp          IN VARCHAR2,
                           batchReportRunId   IN NUMBER,
                           batchQueryId       IN NUMBER,
                           batchQueryNo       IN NUMBER,
                           resultSetTableName IN VARCHAR2,
                           insertStatement    IN VARCHAR2,
                           commitSize         IN NUMBER,
                           rowFetchLimit      IN NUMBER,
                           sumoId             IN NUMBER,
                           summaryUsed        IN BOOLEAN DEFAULT TRUE) IS

    ExceededRow EXCEPTION;
    PRAGMA EXCEPTION_INIT (ExceededRow, -20001);

    querySQL VARCHAR2(32767);

    usedSummary BOOLEAN := summaryUsed;

BEGIN
    querySQL  :=  'DECLARE'                                                                                     || chr(10) ||
                  '   Rows_Processed INTEGER := 0;'                                                             || chr(10) ||
                  '   Exceeded_Row   EXCEPTION;'                                                                || chr(10) ||
                  '   PRAGMA EXCEPTION_INIT (Exceeded_Row, -20001);'                                            || chr(10) ||
                  '   CURSOR c1 IS'                                                                             || chr(10) ||
                  '   SELECT * FROM ';

    IF (usedSummary = TRUE) AND (UseSummary(eulSchemaName, sumoId)) THEN
        -- Attempt to use the Summary
        querySQL := querySQL || GetViewName(timeStamp, batchQueryNo, FALSE);
    ELSE
        usedSummary := FALSE;
        querySQL := querySQL || GetViewName(timeStamp, batchQueryNo, TRUE);
    END IF;

    querySQL := querySQL || ';' || chr(10) ||
                      'BEGIN'                                                                                       || chr(10) ||
                      '   FOR batch_rec IN c1 LOOP'                                                                 || chr(10) ||
                      '       INSERT INTO ' || resultSetTableName || ' VALUES(' || insertStatement ||');'           || chr(10);
    IF (commitSize IS NOT NULL) AND (commitSize > 0) THEN
        querySQL := querySQL ||
                      '       IF MOD(Rows_Processed, ' || to_char(commitSize) || ') = 0 THEN'                       || chr(10) ||
                      '           COMMIT;'                                                                          || chr(10) ||
                      '       END IF;'                                                                              || chr(10);
    END IF;
    IF (rowFetchLimit IS NOT NULL) AND (rowFetchLimit > 0) THEN
        querySQL := querySQL ||
                      '       Rows_Processed := Rows_Processed + 1;'                                             || chr(10) ||
                      '       IF Rows_Processed = ' || to_char(rowFetchLimit) || ' THEN'                         || chr(10) ||
                      '           RAISE Exceeded_Row;'                                                           || chr(10) ||
                      '       END IF;'                                                                           || chr(10);
    END IF;
    querySQL := querySQL ||
                      '   END LOOP;'                                                                                || chr(10) ||
                      '   COMMIT;'                                                                                  || chr(10) ||
                      '   EXCEPTION'                                                                                || chr(10) ||
                      '       WHEN Exceeded_Row THEN'                                                               || chr(10) ||
                      '           ROLLBACK;'                                                                        || chr(10) ||
                      '           RAISE;'                                                                           || chr(10) ||
                      '       WHEN OTHERS THEN'                                                                     || chr(10) ||
                      '           ROLLBACK;'                                                                        || chr(10) ||
                      '           RAISE;'                                                                           || chr(10) ||
                      'END;';

    DynamicExecute(querySQL);
    -- dynamic_execute('BEGIN TST_PROC; END;');

    EXCEPTION
        WHEN ExceededRow THEN
            ROLLBACK;
            SetStatusRowLimit(eulSchemaName, batchReportRunId);
            -- RAISE THE EXCEPTION TO BE CAUGHT IN THE CLIENT
            RAISE;
        WHEN OTHERS THEN
            ROLLBACK;
            IF usedSummary = TRUE THEN
                -- Attempt against the base data
                TryExecuteQuery(eulSchemaName,
                                timeStamp,
                                batchReportRunId,
                                batchQueryId,
                                batchQueryNo,
                                resultSetTableName,
                                insertStatement,
                                commitSize,
                                rowFetchLimit,
                                sumoId,
                                FALSE);
            ELSE
                SetStatusRunError(eulSchemaName, batchReportRunId, SQLCODE, SUBSTR(SQLERRM, 1, 240));
                RAISE;
            END IF;

END TryExecuteQuery;

-- =====================================================================
-- FUNCTION: IsOverwriteResults()
-- DESCRIPTION: Returns TRUE if batch report has the flag set to
--              overwrite result sets.
FUNCTION IsOverwriteResults(eulSchemaName        IN VARCHAR2,
                           batchReportRunId  IN NUMBER) RETURN BOOLEAN IS

    sqlSelect       VARCHAR2(2000);
    overwriteFlag NUMBER(1);
    cur             INTEGER;
    ignore          INTEGER;

BEGIN
    sqlSelect := 'SELECT br_overwrite_rslts '	  || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_batch_reports, <EUL_SCHEMA>.eul5_br_runs ' || chr(10) ||
                 'WHERE brr_br_id = br_id '	  || chr(10) ||
                 'AND brr_id = ' || to_char(batchReportRunId);

    ReplaceEULSchema(eulSchemaName, sqlSelect);

    cur := DBMS_SQL.OPEN_CURSOR;

    DBMS_SQL.PARSE(cur, sqlSelect, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, overwriteFlag);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, overwriteFlag);

    DBMS_SQL.CLOSE_CURSOR(cur);

    IF overwriteFlag = 0 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;

END IsOverwriteResults;

-- =====================================================================
-- PROCEDURE: ExecuteQuery()
-- DESCRIPTION: This procedure is overloaded. The parameter sumoId defaults
--              to NULL. The procedure will therefore operate against the
--              base object or the Summary Derived object.
PROCEDURE ExecuteQuery(eulSchemaName     IN VARCHAR2,
                       timeStamp         IN VARCHAR2,
                       batchReportRunId  IN NUMBER,
                       batchReportRunNo  IN NUMBER,
                       userName          IN VARCHAR2,
                       batchQueryId      IN NUMBER,
                       batchQueryNo      IN NUMBER,
                       createTableCols   IN VARCHAR2,
                       insertStatement   IN varchar2,
                       commitSize        IN NUMBER,
                       rowFetchLimit     IN NUMBER,
                       sumoId            IN NUMBER := NULL) IS

    resultSetTableName VARCHAR2(30);
    overwriteResults BOOLEAN;
    foundTable BOOLEAN := FALSE;

BEGIN
    overwriteResults := IsOverwriteResults(eulSchemaName, batchReportRunId);

    IF (overwriteResults = TRUE) AND (batchReportRunNo > 1) THEN
      foundTable := ReuseBatchQueryTable(eulSchemaName,
                                                 batchReportRunId,
                                                 batchQueryId,
                                                 resultSetTableName);
    END IF;
    
    -- Create the table and insert row into the Batch Query Table
    -- One transaction - Exceptions handled within batch_query_table
    IF (foundTable = FALSE) THEN  
      resultSetTableName := InsertBatchQueryTable(eulSchemaName,
                                                  timeStamp,
                                                  userName,
                                                  batchReportRunId,
                                                  batchReportRunNo,
                                                  batchQueryId,
                                                  batchQueryNo,
                                                  createTableCols);

      -- Grant select on the newly created query table to all
      -- grantees of the scheduled workbook
      GrantQueryTableAccess(eulSchemaName,
                            batchReportRunId,
                            resultSetTableName);
    END IF;


    -- Try to execute the query
    TryExecuteQuery (eulSchemaName,
                     timeStamp,
                     batchReportRunId,
                     batchQueryId,
                     batchQueryNo,
                     resultSetTableName,
                     insertStatement,
                     commitSize,
                     rowFetchLimit,
                     sumoId);

END ExecuteQuery;

-- =====================================================================
-- FUNCTION: IsRescheduled()
-- DESCRIPTION: Retrieves the schedule information and returns whether
--              the Report is rescheduled.
FUNCTION IsRescheduled(eulSchemaName        IN VARCHAR2,
                       batchReportId        IN NUMBER,
                       refreshFrequencyUnit IN OUT VARCHAR2,
                       numFrequencyUnits    OUT NUMBER,
                       nextRunDate          IN OUT DATE) RETURN BOOLEAN IS

    sqlSelect       VARCHAR2(2000);
    tmpNumFreqUnits NUMBER(22);
    automaticRefreshFlag NUMBER(1);
    cur             INTEGER;
    ignore          INTEGER;

BEGIN
    sqlSelect := 'SELECT br.br_num_freq_units, rfu.rfu_sql_expression, br.br_next_run_date, '	  || chr(10) ||
		     'br.br_auto_refresh'        									  || chr(10) ||
                 'FROM <EUL_SCHEMA>.eul5_batch_reports br, <EUL_SCHEMA>.eul5_freq_units rfu' || chr(10) ||
                 'WHERE br.br_id = ' || to_char(batchReportId)                                          || chr(10) ||
                 'AND br.br_rfu_id = rfu.rfu_id';

    ReplaceEULSchema(eulSchemaName, sqlSelect);

    cur := DBMS_SQL.OPEN_CURSOR;

    DBMS_SQL.PARSE(cur, sqlSelect, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(cur, 1, tmpNumFreqUnits);
    DBMS_SQL.DEFINE_COLUMN(cur, 2, refreshFrequencyUnit, 240);
    DBMS_SQL.DEFINE_COLUMN(cur, 3, nextRunDate);
    DBMS_SQL.DEFINE_COLUMN(cur, 4, automaticRefreshFlag);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, tmpNumFreqUnits);
    DBMS_SQL.COLUMN_VALUE(cur, 2, refreshFrequencyUnit);
    DBMS_SQL.COLUMN_VALUE(cur, 3, nextRunDate);
    DBMS_SQL.COLUMN_VALUE(cur, 4, automaticRefreshFlag);

    DBMS_SQL.CLOSE_CURSOR(cur);

    numFrequencyUnits := tmpNumFreqUnits;

    refreshFrequencyUnit := REPLACE(refreshFrequencyUnit, '''''', '?');
    refreshFrequencyUnit := REPLACE(refreshFrequencyUnit, '''', '');
    refreshFrequencyUnit := REPLACE(refreshFrequencyUnit, '?', '''');
    refreshFrequencyUnit := REPLACE(refreshFrequencyUnit, '&', ':');

    IF automaticRefreshFlag = 0 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;

END IsRescheduled;

-- =====================================================================
-- PROCEDURE: CalculateNextRunDate()
-- DESCRIPTION: Calculate the next run date based on the refresh
--              frequency unit and the num of units.
--              Time slippage is removed.
PROCEDURE CalculateNextRunDate(refreshFrequencyUnit IN VARCHAR2,
                               numFrequencyUnits    IN NUMBER,
                               calcRunDate          IN OUT DATE) IS

    dateExpression VARCHAR2(2000);
    curDate        INTEGER;
    ignore         INTEGER;
    noRows         INTEGER;

BEGIN

    dateExpression := 'SELECT ' || refreshFrequencyUnit || ' FROM DUAL';

    curDate := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(curDate, dateExpression, DBMS_SQL.V7);
    DBMS_SQL.DEFINE_COLUMN(curDate, 1, calcRunDate);

    LOOP
        DBMS_SQL.BIND_VARIABLE(curDate, 'bind_num_units', numFrequencyUnits);
        DBMS_SQL.BIND_VARIABLE(curDate, 'bind_date', calcRunDate);
        ignore := DBMS_SQL.EXECUTE(curDate);

        noRows := DBMS_SQL.FETCH_ROWS(curDate);
        DBMS_SQL.COLUMN_VALUE(curDate, 1, calcRunDate);

        IF (calcRunDate > SYSDATE) THEN
            EXIT;
        END IF;
    END LOOP;

    DBMS_SQL.CLOSE_CURSOR(curDate);

END CalculateNextRunDate;

-- =====================================================================
-- PROCEDURE: InsertBatchReportRunSubmitted()
-- DESCRIPTION: Inserts a new batch report run and set status to Submitted.
PROCEDURE InsertBatchReportRunSubmitted(eulSchemaName IN VARCHAR2,
                                        batchReportId IN NUMBER,
                                        currentbatchReportRunNo IN NUMBER) IS

    batchReportRunId     NUMBER(22);
    nextBatchReportRunNo NUMBER;
    sqlInsert            VARCHAR2(2000);

BEGIN
    nextBatchReportRunNo := currentbatchReportRunNo + 1;

    sqlInsert := 'INSERT INTO <EUL_SCHEMA>.eul5_br_runs'      || chr(10) ||
                 '(brr_id, brr_br_id, brr_run_number, brr_state, brr_element_state, brr_created_by, brr_created_date)'      || chr(10) ||
                 'VALUES(<EUL_SCHEMA>.eul5_id_seq.nextval,'                          || chr(10) ||
                         batchReportId || ','                          || chr(10) ||
                         nextBatchReportRunNo || ','                   || chr(10) ||
                         BATCH_STATE_SUBMITTED || ',0,USER,SYSDATE)';

    ReplaceEULSchema(eulSchemaName, sqlInsert);

    DynamicExecute(sqlInsert);

END;

-- =====================================================================
-- PROCEDURE: SubmitJob()
-- DESCRIPTION: Submit the package to the job queue.
--              If client is calling this then the job no will have to
--              be updated.
PROCEDURE SubmitJob(jobNo         OUT NUMBER,
                    timeStamp     IN VARCHAR2,
                    runDate       IN DATE) IS

    packageSQL    VARCHAR2(50);

    newDate DATE;
BEGIN
    -- Create the package string - EUL5_BATCH_PACKAGE <Batch Report Id>.EXECUTE;
    packageSQL := 'EUL5_BATCH_PACKAGE' || timeStamp || '.RUN;';

    -- Submit the Job
    DBMS_JOB.SUBMIT(jobNo,
                    packageSQL,
                    runDate);

END SubmitJob;

-- =====================================================================
-- PROCEDURE: RemoveJob()
-- DESCRIPTION: Remove the associated job from the job queue.
--              Client will have to remove job no from the Batch Report.
--              Exceptions to be trapped in the client
PROCEDURE RemoveJob(jobNo            IN NUMBER,
                    handleExceptions IN BOOLEAN := FALSE) IS

BEGIN

    -- Remove the job
    DBMS_JOB.REMOVE(jobNo);

EXCEPTION
    WHEN OTHERS THEN
        IF (handleExceptions = TRUE) THEN
            RETURN;
        END IF;

        RAISE;

END RemoveJob;

-- =====================================================================
-- PROCEDURE: SetNextDate()
-- DESCRIPTION: Change the next run date of a job.
PROCEDURE SetNextDate(jobNo    IN NUMBER,
                      nextDate IN DATE) IS
BEGIN

    DBMS_JOB.NEXT_DATE(jobNo, nextDate);

END SetNextDate;

-- =====================================================================
-- PROCEDURE: ScheduleRun()
-- DESCRIPTION: Schedule the next run.
PROCEDURE ScheduleRun(eulSchemaName    IN VARCHAR2,
                      timeStamp        IN VARCHAR2,
                      batchReportId    IN NUMBER,
                      batchReportRunId IN NUMBER,
                      batchReportRunNo IN NUMBER,
                      error            IN BOOLEAN,
                      startDate        IN DATE) IS

    numFrequencyUnits    NUMBER(22);
    refreshFrequencyUnit VARCHAR2(240);
    nextRunDate          DATE;
    jobNo                NUMBER(22);

BEGIN

    IF (IsRescheduled(eulSchemaName, batchReportId, refreshFrequencyUnit, numFrequencyUnits, nextRunDate)
        = FALSE) THEN
        IF (error = FALSE) THEN
            SetStatusReady(eulSchemaName, batchReportRunId);
            COMMIT;
        END IF;

        SetBatchReportCompletionInfo(eulSchemaName,
                                     batchReportId,
                                     batchReportRunId,
                                     StartDate);
        -- Do not resubmit - END OF PROCESSING
        RETURN;
    END IF;

    -- Scheduled report

    -- Calc the next run date

    CalculateNextRunDate(refreshFrequencyUnit, numFrequencyUnits, nextRunDate);

    -- TRANSACTION - On error delete the job from Job Queue
    BEGIN
        -- Submit the package for reschedule

        SubmitJob(jobNo, timeStamp, nextRunDate);

        -- Insert a new Batch Report Run with status of Submitted
        InsertBatchReportRunSubmitted(eulSchemaName, batchReportId, batchReportRunNo);

        IF (error = FALSE) THEN
            SetStatusReady(eulSchemaName, batchReportRunId);
        END IF;

        -- Set the Job No
        -- Exception handling flag set to TRUE
        SetBatchReportCompletionInfo(eulSchemaName,
                                     batchReportId,
                                     batchReportRunId,
                                     startDate,
                                     TRUE,
                                     nextRunDate,
                                     jobNo);

        COMMIT;

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            -- Remove the Job from the job queue and handle exceptions
            RemoveJob(jobNo, TRUE);

            -- Attempt to update the completion information
            SetBatchReportCompletionInfo(eulSchemaName,
                                         batchReportId,
                                         batchReportRunId,
                                         StartDate);
            -- Set to submission error
            SetStatusSubmissionError(eulSchemaName, batchReportRunId, SQLCODE, SUBSTR(SQLERRM, 1, 240));
    END;

END ScheduleRun;

-- =====================================================================
-- A D M I N I S T R A T I O N  M E T H O D S
-- =====================================================================

-- =====================================================================
-- PROCEDURE: CreateView()
-- DESCRIPTION: Dynamically create the view.
--              The client will have to replace ' with '' before calling.
PROCEDURE CreateView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery  IN VARCHAR2,
					 cols      IN VARCHAR2,
                     base      IN BOOLEAN) IS

    viewSQL  VARCHAR2(32767);   -- Maximum value

BEGIN

    -- Create and not 'Create or replace' for timestamp validation
    viewSQL := 'CREATE VIEW ' || GetViewName(timeStamp, queryNo, base) || cols || ' AS ' || sqlQuery;

    DynamicExecute(viewSQL);

    -- EXCEPTIONS TO PROPOGATE TO CLIENT

END;

-- =====================================================================
-- PROCEDURE: CreateLargeView()
-- DESCRIPTION: Dynamically creates the view whose sql definition is more than 32k.
--              The client will have to replace ' with '' before calling.
PROCEDURE CreateLargeView(sqlTable IN DBMS_SQL.VARCHAR2S) IS

cur    INTEGER;
ignore INTEGER;

BEGIN

  cur := DBMS_SQL.OPEN_CURSOR;
  DBMS_SQL.PARSE(cur, sqlTable,sqlTable.FIRST, sqlTable.LAST,FALSE, DBMS_SQL.NATIVE);
  ignore := DBMS_SQL.EXECUTE(cur);
  DBMS_SQL.CLOSE_CURSOR(cur);

END;


-- ===================================================================
-- PROCEDURE: DropViews()
-- DESCRIPTION: Attempts to dynamically drop both the base view and the
--              summary view.
PROCEDURE DropViews(timeStamp IN VARCHAR2,
                    queryNo   IN NUMBER) IS

    viewSQL VARCHAR2(100);
BEGIN
    -- Attempt to drop the view - base and summary
    -- Ignore table or view does not exist
    BEGIN
        -- Base
        viewSQL := 'DROP VIEW ' || GetViewName(timeStamp, queryNo, TRUE);
        DynamicExecute(viewSQL);
    EXCEPTION
        WHEN OTHERS THEN
            IF (SQLCODE = -942) THEN
                RETURN;
            END IF;
            RAISE;
    END;

    BEGIN
        -- Summary
        viewSQL := 'DROP VIEW ' || GetViewName(timeStamp, queryNo, FALSE);
        DynamicExecute(viewSQL);
    EXCEPTION
        WHEN OTHERS THEN
            IF (SQLCODE = -942) THEN
                RETURN;
            END IF;
            RAISE;
    END;
END DropViews;

-- =====================================================================
-- PROCEDURE: DropPackage()
-- DESCRIPTION: Attempts to dynamically drop a Procedure.
PROCEDURE DropPackage(timeStamp IN VARCHAR2) IS

    dropSQL VARCHAR2(200);

BEGIN
    dropSQL := 'DROP PACKAGE EUL5_BATCH_PACKAGE' || timeStamp;

    DynamicExecute(dropSQL);

    EXCEPTION
        WHEN OTHERS THEN
            IF (SQLCODE = -4043) THEN
                RETURN;
            END IF;
            RAISE;
END DropPackage;

-- =====================================================================
-- PROCEDURE: InitializePackage()
-- DESCRIPTION:
PROCEDURE InitializePackage(timeStamp     IN VARCHAR2,
                            eulSchemaName IN VARCHAR2,
                            batchReportId IN NUMBER,
			    preExec       IN VARCHAR2) IS
BEGIN

    PACKAGE_SPEC :=
    'CREATE OR REPLACE PACKAGE EUL5_BATCH_PACKAGE' || timeStamp ||
    ' AS'                                                        || chr(10) ||
    '   PROCEDURE RUN;'                                          || chr(10) ||
    'END EUL5_BATCH_PACKAGE' || timeStamp || ';';

    PACKAGE_BODY :=
    'CREATE OR REPLACE PACKAGE BODY EUL5_BATCH_PACKAGE' || timeStamp || ' AS'   || chr(10) ||
    'PROCEDURE RUN IS'                                                         || chr(10) ||
    '   eulSchemaName    VARCHAR2(128) := ''' || eulSchemaName || ''';'        || chr(10) ||
    '   timeStamp        VARCHAR2(12) := ''' || timeStamp || ''';'             || chr(10) ||
    '   batchReportId    NUMBER(22) := ' || batchReportId || ';'               || chr(10) ||
    '   batchReportRunNo NUMBER(22);'                                          || chr(10) ||
    '   batchReportRunId NUMBER(22);'                                          || chr(10) ||
    '   userName         VARCHAR2(129);'                                       || chr(10) ||
    '   rowFetchLimit    NUMBER(22);'                                          || chr(10) ||
    '   batchCommitSize  NUMBER(22);'                                          || chr(10) ||
    '   startDate        DATE := SYSDATE;'                                     || chr(10) ||
    '   error            BOOLEAN := FALSE;'                                    || chr(10) ||
    'BEGIN'                                                                    || chr(10) ||
    preExec                                                                    || chr(10) ||
    '   BEGIN'                                                                 || chr(10) ||
    '      IF (EUL5_BATCH_REPOSITORY.IsReportValid(eulSchemaName,'              || chr(10) ||
    '                                          batchReportId) = FALSE) THEN'   || chr(10) ||
    '           RETURN;'                                                       || chr(10) ||
    '      END IF;'                                                            || chr(10) ||
    '      EUL5_BATCH_REPOSITORY.GetUserLimits(eulSchemaName,'                  || chr(10) ||
    '                                      batchReportId,'                     || chr(10) ||
    '                                      userName,'                          || chr(10) ||
    '                                      batchCommitSize,'                   || chr(10) ||
    '                                      rowFetchLimit);'                    || chr(10) ||
    '      EUL5_BATCH_REPOSITORY.SetExpiredRuns(eulSchemaName,'                 || chr(10) ||
    '                                       userName);'                        || chr(10) ||
    '      EUL5_BATCH_REPOSITORY.SetBatchReportRunInProgress(eulSchemaName,'    || chr(10) ||
    '                                                    batchReportId,'       || chr(10) ||
    '                                                    batchReportRunNo,'    || chr(10) ||
    '                                                    batchReportRunId);'   || chr(10);

END InitializePackage;

-- =====================================================================
-- PROCEDURE: AddQuery()
-- DESCRIPTION:
PROCEDURE AddQuery(batchQueryId    IN NUMBER,
                   queryNo         IN NUMBER,
                   createTableCols IN VARCHAR2,
                   insertStatement IN VARCHAR2,
                   summaryId       IN NUMBER := NULL) IS
BEGIN

    PACKAGE_BODY := PACKAGE_BODY || chr(10) ||
    '      EUL5_BATCH_REPOSITORY.ExecuteQuery(eulSchemaName,'                || chr(10) ||
    '                                     timeStamp,'                       || chr(10) ||
    '                                     batchReportRunId,'                || chr(10) ||
    '                                     batchReportRunNo,'                || chr(10) ||
    '                                     userName,'                        || chr(10) ||
    '                                     ' || batchQueryId || ','          || chr(10) ||
    '                                     ' || queryNo || ','               || chr(10) ||
    '                                     ''' || createTableCols || ''','   || chr(10) ||
    '                                     ''' || insertStatement || ''','   || chr(10) ||
    '                                     batchCommitSize,'                 || chr(10) ||
    '                                     rowFetchLimit,'                   || chr(10);

    IF summaryId IS NULL THEN
        PACKAGE_BODY := PACKAGE_BODY ||
        '                                     NULL);'                       || chr(10);
    ELSE
        PACKAGE_BODY := PACKAGE_BODY ||
        '                                     ' || summaryId || ');'        || chr(10);
    END IF;

END AddQuery;

-- =====================================================================
-- PROCEDURE: CreatePackage()
-- DESCRIPTION:
PROCEDURE CreatePackage(timeStamp IN VARCHAR2) IS
BEGIN

    PACKAGE_BODY := PACKAGE_BODY || chr(10) ||
    '   EXCEPTION'                                                          || chr(10) ||
    '      WHEN OTHERS THEN'                                                || chr(10) ||
    '         error := TRUE;'                                               || chr(10) ||
    '   END;'                                                               || chr(10) ||
    '   EUL5_BATCH_REPOSITORY.ScheduleRun(eulSchemaName,'                    || chr(10) ||
    '                                 timeStamp,'                           || chr(10) ||
    '                                 batchReportId,'                       || chr(10) ||
    '                                 batchReportRunId,'                    || chr(10) ||
    '                                 batchReportRunNo,'                    || chr(10) ||
    '                                 error,'                               || chr(10) ||
    '                                 startDate);'                          || chr(10) ||
    'END RUN;'                                                              || chr(10) ||
    'END EUL5_BATCH_PACKAGE' || timeStamp || ';'                             || chr(10);

    -- Create the package specification and body
    DynamicExecute(PACKAGE_SPEC);
    DynamicExecute(PACKAGE_BODY);

END CreatePackage;

-- =====================================================================
-- PROCEDURE: GetVersion()
-- DESCRIPTION: Returns the current version of the package for upgrade
--              purposes.
PROCEDURE GetVersion(version OUT NUMBER) IS
BEGIN

    version := 312;

END GetVersion;

-- =====================================================================
-- PROCEDURE: IsEULAvailable()
-- DESCRIPTION: Indicates whether the EUL is granted to the package.
PROCEDURE IsGrantedEUL(eulSchemaName IN VARCHAR2) IS

    sqlEULSelect VARCHAR2(2000);
    cur          INTEGER;

BEGIN
    -- Dummy select from eul table
    sqlEULSelect := 'SELECT ver_name FROM <EUL_SCHEMA>.eul5_versions';

    ReplaceEULSchema(eulSchemaName, sqlEULSelect);

    -- An exception may be thrown to the client when parsing
    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlEULSelect, DBMS_SQL.V7);

END IsGrantedEUL;

END EUL5_BATCH_REP_SECURE;
/



set termout on
PROMPT 
PROMPT Creating the package EUL5_BATCH_DISCO_ADMINS ...
PROMPT
set termout off



CREATE OR REPLACE PACKAGE EUL5_BATCH_DISCO_ADMINS AUTHID DEFINER AS

PROCEDURE DropTable(tableName IN VARCHAR2);

END EUL5_BATCH_DISCO_ADMINS;
/


CREATE OR REPLACE PACKAGE BODY EUL5_BATCH_DISCO_ADMINS AS
-- =====================================================================
-- PROCEDURE: DropTable()
-- DESCRIPTION: Generic drop table routine.
PROCEDURE DropTable(tableName IN VARCHAR2) IS
    tTableName  VARCHAR2(60);
BEGIN
    
    tTableName := REPLACE(tableName,'''','''''');

    IF tTableName NOT LIKE 'EUL5_B%'
    THEN
        raise_application_error(-20101, 'Table name ' || tTableName || ' not a valid batch table');
    END IF;	

--  Since admins only will have access to this , just drop the table
    EUL5_BATCH_REP_SECURE.DropTable(tTableName);

END DropTable;

END EUL5_BATCH_DISCO_ADMINS;
/



set termout on
PROMPT 
PROMPT Creating the package EUL5_BATCH_REPOSITORY ...
PROMPT
set termout off

-- =================================================================================
-- EUL5_BATCH_REPOSITORY SPECIFICATION
-- =================================================================================

CREATE OR REPLACE PACKAGE EUL5_BATCH_REPOSITORY AUTHID CURRENT_USER AS

FUNCTION IsReportValid(eulSchemaName IN VARCHAR2,
                       batchReportId IN NUMBER) RETURN BOOLEAN;

PROCEDURE GetUserLimits(eulSchemaName IN VARCHAR2,
                        batchReportId IN NUMBER,
                        userName      OUT VARCHAR2,
                        commitSize    OUT NUMBER,
                        rowFetchLimit OUT NUMBER);

PROCEDURE SetExpiredRuns(eulSchemaName IN VARCHAR2,
                         userName      IN VARCHAR2);

PROCEDURE SetBatchReportRunInProgress(eulSchemaName    IN VARCHAR2,
                                      batchReportId    IN NUMBER,
                                      batchReportRunNo OUT NUMBER,
                                      batchReportRunId OUT NUMBER);

PROCEDURE ExecuteQuery(eulSchemaName     IN VARCHAR2,
                       timeStamp         IN VARCHAR2,
                       batchReportRunId  IN NUMBER,
                       batchReportRunNo  IN NUMBER,
                       userName          IN VARCHAR2,
                       batchQueryId      IN NUMBER,
                       batchQueryNo      IN NUMBER,
                       createTableCols   IN VARCHAR2,
                       insertStatement   IN varchar2,
                       commitSize        IN NUMBER,
                       rowFetchLimit     IN NUMBER,
                       sumoId            IN NUMBER := NULL);

PROCEDURE ScheduleRun(eulSchemaName    IN VARCHAR2,
                      timeStamp        IN VARCHAR2,
                      batchReportId    IN NUMBER,
                      batchReportRunId IN NUMBER,
                      batchReportRunNo IN NUMBER,
                      error            IN BOOLEAN,
                      startDate        IN DATE);

PROCEDURE ChangeTableSelectAccess(tableName   IN VARCHAR2,
                                 userName    IN VARCHAR2,
                                 doGrant     IN BOOLEAN);

-- A D M I N I S T R A T O R   M E T H O D S
PROCEDURE CreateView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery  IN VARCHAR2,
		     cols      IN VARCHAR2,
                     base      IN BOOLEAN);
										 

PROCEDURE CreateLargeView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery1 IN VARCHAR2,
                     sqlQuery2 IN VARCHAR2 :=NULL,
                     cols      IN VARCHAR2,
                     base      IN BOOLEAN);

PROCEDURE DropViews(timeStamp IN VARCHAR2,
                    queryNo   IN NUMBER);

PROCEDURE DropTable(tableName IN VARCHAR2);

PROCEDURE DropPackage(timeStamp IN VARCHAR2);

PROCEDURE InitializePackage(timeStamp     IN VARCHAR2,
                            eulSchemaName IN VARCHAR2,
                            batchReportId IN NUMBER,
			    preExec       IN VARCHAR2 := '');

PROCEDURE AddQuery(batchQueryId    IN NUMBER,
                   queryNo         IN NUMBER,
                   createTableCols IN VARCHAR2,
                   insertStatement IN VARCHAR2,
                   summaryId       IN NUMBER := NULL);

PROCEDURE CreatePackage(timeStamp IN VARCHAR2);

PROCEDURE SubmitJob(jobNo         OUT NUMBER,
                    timeStamp     IN VARCHAR2,
                    runDate       IN DATE);

PROCEDURE RemoveJob(jobNo            IN NUMBER,
                    handleExceptions IN BOOLEAN := FALSE);

PROCEDURE SetNextDate(jobNo    IN NUMBER,
                      nextDate IN DATE);

PROCEDURE GetVersion(version OUT NUMBER);

PROCEDURE GetMinorVersion(minorVersion OUT NUMBER);

PROCEDURE IsGrantedEUL(eulSchemaName IN VARCHAR2);

END EUL5_BATCH_REPOSITORY;
/

-- =================================================================================
-- EUL5_BATCH_REPOSITORY BODY
-- =================================================================================
CREATE OR REPLACE PACKAGE BODY EUL5_BATCH_REPOSITORY AS

-- =====================================================================
-- PROCEDURE: CheckTablePrivileges()
-- DESCRIPTION: Checks whether the given table is a valid EUL Batch Table.
--     Also checks the permission of current user on that table.

PROCEDURE CheckTablePrivileges(tableName IN VARCHAR2) IS
    cur INTEGER;
    testPerm VARCHAR2(80);
BEGIN

    IF tableName NOT LIKE 'EUL5_B%'
    THEN
        raise_application_error(-20101, 'Table name ' || tableName || ' not a valid batch table');
    END IF;

    testPerm := 'SELECT COUNT(*) FROM ' || '&Batch_User' || '.' || tableName ;

    cur := DBMS_SQL.OPEN_CURSOR;
    BEGIN
       DBMS_SQL.PARSE(cur, testPerm, DBMS_SQL.V7);
    EXCEPTION
       WHEN OTHERS THEN
          DBMS_SQL.CLOSE_CURSOR(cur);
          raise_application_error(-20102, 'Insufficient privileges on ' || tableName);
    END; 

    DBMS_SQL.CLOSE_CURSOR(cur);

END CheckTablePrivileges;

-- =====================================================================
-- PROCEDURE: SetExpiredRuns()
-- DESCRIPTION:  Sets the status of the expired Batch Report Runs for
--               the current user. Only set Batch Report Runs to expired
--               if they are ready. All error status' are kept in tact
--               ready for viewing.
-- TRANSACTIONS: Transaction block around the SetStatusExpired.
PROCEDURE SetExpiredRuns(eulSchemaName IN VARCHAR2,
                         userName      IN VARCHAR2) IS
    tEulSchemaName VARCHAR2(60);
    tUserName VARCHAR2(60);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    tUserName := REPLACE(userName,'''',''''''); 

    EUL5_BATCH_REP_SECURE.SetExpiredRuns(tEulSchemaName,
                                         tUserName);

END SetExpiredRuns;

-- =====================================================================
-- FUNCTION: IsReportValid()
-- DESCRIPTION: Checks Batch Report Run to ensure that the state of the
--              EUL has not changed. Checks that Batch Report has not
--              been set to deleted.

FUNCTION IsReportValid(eulSchemaName IN VARCHAR2,
                       batchReportId IN NUMBER) RETURN BOOLEAN IS
    tEulSchemaName VARCHAR2(60);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    
    RETURN EUL5_BATCH_REP_SECURE.IsReportValid(tEulSchemaName,
                                               batchReportId);

END IsReportValid;

-- =====================================================================
-- PROCEDURE: GetUserLimits
-- DESCRIPTION: Retrieve the commit size and the row limit.
--              Report Id can be used to retrieve the user name.
PROCEDURE GetUserLimits(eulSchemaName IN VARCHAR2,
                        batchReportId IN NUMBER,
                        userName      OUT VARCHAR2,
                        commitSize    OUT NUMBER,
                        rowFetchLimit OUT NUMBER) IS
    tEulSchemaName VARCHAR2(60);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    
    EUL5_BATCH_REP_SECURE.GetUserLimits(tEulSchemaName,
                                        batchReportId,
                                        userName,
                                        commitSize,
                                        rowFetchLimit);

END GetUserLimits;

-- =====================================================================
-- PROCEDURE: setBatchReportRunInProgress
-- DESCRIPTION: Set the status to 'In Progress' and update the Run Date.
-- TRANSACTIONS:
PROCEDURE SetBatchReportRunInProgress(eulSchemaName    IN VARCHAR2,
                                      batchReportId    IN NUMBER,
                                      batchReportRunNo OUT NUMBER,
                                      batchReportRunId OUT NUMBER) IS
    tEulSchemaName VARCHAR2(60);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    
    EUL5_BATCH_REP_SECURE.SetBatchReportRunInProgress(tEulSchemaName,
                                         batchReportId,
                                         batchReportRunNo,
                                         batchReportRunId);

END SetBatchReportRunInProgress;

-- =====================================================================
-- PROCEDURE: ExecuteQuery()
-- DESCRIPTION: This procedure is overloaded. The parameter sumoId defaults
--              to NULL. The procedure will therefore operate against the
--              base object or the Summary Derived object.
PROCEDURE ExecuteQuery(eulSchemaName     IN VARCHAR2,
                       timeStamp         IN VARCHAR2,
                       batchReportRunId  IN NUMBER,
                       batchReportRunNo  IN NUMBER,
                       userName          IN VARCHAR2,
                       batchQueryId      IN NUMBER,
                       batchQueryNo      IN NUMBER,
                       createTableCols   IN VARCHAR2,
                       insertStatement   IN VARCHAR2,
                       commitSize        IN NUMBER,
                       rowFetchLimit     IN NUMBER,
                       sumoId            IN NUMBER := NULL) IS
     sqlStatement     VARCHAR2(300);
     tmpUserName      VARCHAR2(128);
     cur INTEGER;
     ignore INTEGER;		       
     tEulSchemaName   VARCHAR2(60);
     tTimeStamp       VARCHAR2(20);
     tUserName        VARCHAR2(60);
     tCreateTableCols VARCHAR2(32767);
     tInsertStatement VARCHAR2(32767);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    tTimeStamp := REPLACE(timeStamp,'''','''''');
    tUserName := REPLACE(userName,'''',''''''); 

    tCreateTableCols := REPLACE(createTableCols,'''',''''''); 
    tInsertStatement := REPLACE(insertStatement,'''',''''''); 

    -- check for the permission of the creator.
    sqlStatement := 'SELECT eu.eu_username FROM <EUL_SCHEMA>.eul5_eul_users eu,' || chr(10) || 
                     '<EUL_SCHEMA>.eul5_batch_reports br' || chr(10) || 
                     'WHERE  br.br_eu_id = eu.eu_id AND br.br_id =' || chr(10) ||  
                     '( select brr_br_id from <EUL_SCHEMA>.eul5_br_runs where brr_id =' ||
                     batchReportRunId || chr(10) || 
                     'and brr_run_number =' || chr(10) || batchReportRunNo || ')';
    
    sqlStatement := REPLACE(sqlStatement, '<EUL_SCHEMA>', tEulSchemaName);
    
    cur := DBMS_SQL.OPEN_CURSOR;
    
    DBMS_SQL.PARSE(cur, sqlStatement, DBMS_SQL.V7);
    
    DBMS_SQL.DEFINE_COLUMN(cur, 1, tmpUserName, 128);
    ignore := DBMS_SQL.EXECUTE(cur);
    ignore := DBMS_SQL.FETCH_ROWS(cur);
    DBMS_SQL.COLUMN_VALUE(cur, 1, tmpUserName);

    DBMS_SQL.CLOSE_CURSOR(cur);

    if tUserName != tmpusername 
    then
        raise_application_error(-20103, 'invalid username ' || tUserName );
    end if;

    EUL5_BATCH_REP_SECURE.ExecuteQuery(tEulSchemaName,
                       tTimeStamp,
                       batchReportRunId,
                       batchReportRunNo,
                       tUserName,
                       batchQueryId,
                       batchQueryNo,
                       tCreateTableCols,
                       tInsertStatement,
                       commitSize,
                       rowFetchLimit,
                       sumoId) ;

END ExecuteQuery;

-- =====================================================================
-- PROCEDURE: ChangeTableSelectAccess()
-- DESCRIPTION: Grants or revokes SELECT access on a specified table to a specified user.
-- If doGrant boolean parameter is TRUE then grant else revoke, SELECT privilege.
PROCEDURE ChangeTableSelectAccess(tableName     IN VARCHAR2,
                        userName    IN VARCHAR2,
                        doGrant     IN BOOLEAN) IS
    tTableName VARCHAR2(60);
    tUserName VARCHAR2(60);
BEGIN

    tTableName := REPLACE(tableName,'''','''''');
    tUserName := REPLACE(userName,'''',''''''); 

    CheckTablePrivileges(tTableName);

    EUL5_BATCH_REP_SECURE.ChangeTableSelectAccess(tTableName,
                                                  tUserName,
                                                  doGrant);

END ChangeTableSelectAccess;

-- =====================================================================
-- PROCEDURE: SubmitJob()
-- DESCRIPTION: Submit the package to the job queue.
--              If client is calling this then the job no will have to
--              be updated.
PROCEDURE SubmitJob(jobNo         OUT NUMBER,
                    timeStamp     IN VARCHAR2,
                    runDate       IN DATE) IS
    tTimeStamp VARCHAR2(20);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');
    
    EUL5_BATCH_REP_SECURE.SubmitJob(jobno,
                                    tTimeStamp,
                                    runDate);

END SubmitJob;

-- =====================================================================
-- PROCEDURE: RemoveJob()
-- DESCRIPTION: Remove the associated job from the job queue.
--              Client will have to remove job no from the Batch Report.
--              Exceptions to be trapped in the client
PROCEDURE RemoveJob(jobNo            IN NUMBER,
                    handleExceptions IN BOOLEAN := FALSE) IS
BEGIN

    EUL5_BATCH_REP_SECURE.RemoveJob(jobNo,
                                    handleExceptions);

END RemoveJob;

-- =====================================================================
-- PROCEDURE: SetNextDate()
-- DESCRIPTION: Change the next run date of a job.
PROCEDURE SetNextDate(jobNo    IN NUMBER,
                      nextDate IN DATE) IS
BEGIN

    EUL5_BATCH_REP_SECURE.SetNextDate(jobNo,
                                      nextDate);

END SetNextDate;

-- =====================================================================
-- PROCEDURE: ScheduleRun()
-- DESCRIPTION: Schedule the next run.
PROCEDURE ScheduleRun(eulSchemaName    IN VARCHAR2,
                      timeStamp        IN VARCHAR2,
                      batchReportId    IN NUMBER,
                      batchReportRunId IN NUMBER,
                      batchReportRunNo IN NUMBER,
                      error            IN BOOLEAN,
                      startDate        IN DATE) IS
    tEulSchemaName VARCHAR2(60);
    tTimeStamp     VARCHAR2(20);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');
    tTimeStamp := REPLACE(timeStamp,'''','''''');
    
    EUL5_BATCH_REP_SECURE.ScheduleRun(tEulSchemaName,
                                      tTimeStamp,
                                      batchReportId,
                                      batchReportRunId,
                                      batchReportRunNo,
                                      error,
                                      startDate);

END ScheduleRun;

-- =====================================================================
-- A D M I N I S T R A T I O N  M E T H O D S
-- =====================================================================

-- FUNCTION: NextRow()
-- DESCRIPTION: Breaks a Varchar string in Chunks of 256 Characters

FUNCTION NextRow(buffer IN VARCHAR2,
            	   lstart IN OUT BINARY_INTEGER,
            	   len IN BINARY_INTEGER) RETURN VARCHAR2 IS
   
	 maxlen BINARY_INTEGER :=255;
   localStart BINARY_INTEGER := lstart;
   substrng  VARCHAR2(255);

BEGIN

    lstart := LEAST (len + 1, lstart + maxlen);
    substrng := SUBSTR (buffer, localStart, maxlen);
    RETURN SUBSTR (buffer, localStart, maxlen);

END NextRow;

-- =====================================================================
-- PROCEDURE: FillSqlTable()
-- DESCRIPTION:  Fills the Sql Table which will be passed for parsing
PROCEDURE FillSqlTable (buffer IN VARCHAR2,
		        sqlTable IN OUT DBMS_SQL.VARCHAR2S) IS

  len BINARY_INTEGER;
  lstart BINARY_INTEGER :=1;

BEGIN

  IF buffer IS NOT NULL THEN

    len :=  LENGTH ( buffer );

    -- Break the buffer in chunks of 256 and Insert it
    -- in index-by table based on the DBMS_SQL TYPE.

LOOP

   sqlTable (NVL (sqlTable.LAST, 0)+1) := NextRow (buffer, lstart, len);

   EXIT WHEN lstart > len;

END LOOP;

END IF;

END FillSqlTable;


-- =====================================================================
-- PROCEDURE: CreateLargeView
-- DESCRIPTION: Creates a view having sql definition more than 32kb.Write the sql
--              in a clob and then breaks it in chunks of 256 chars for parsing
PROCEDURE CreateLargeView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery1 IN VARCHAR2,
                     sqlQuery2 IN VARCHAR2 :=NULL,
           	         cols      IN VARCHAR2,
                     base      IN BOOLEAN) IS

	cur              INTEGER;
	createViewSql    CLOB;
	tempViewDef      VARCHAR2(250);
	buffer           VARCHAR2(32002);
	sqlTable         DBMS_SQL.VARCHAR2S;
	leng             INTEGER;
	tTimeStamp       VARCHAR2(20);
  tCols            VARCHAR2(32767);

	BEGIN

		tTimeStamp := REPLACE(timeStamp,'''','''''');
    tCols := REPLACE(cols,'''','''''');
		tempViewDef := 'CREATE VIEW ' || EUL5_BATCH_REP_SECURE.GetViewName(tTimeStamp, queryNo, base) || tCols || ' AS  ' ;

		DBMS_LOB.CREATETEMPORARY(createViewSql,TRUE);
		DBMS_LOB.Open(createViewSql,dbms_lob.lob_readwrite);
		DBMS_LOB.WRITEAPPEND(createViewSql,LENGTHB(tempViewDef),tempViewDef);
		DBMS_LOB.WRITEAPPEND(createViewSql,LENGTHB(sqlQuery1),sqlQuery1);

		IF sqlQuery2 IS NOT NULL THEN
			DBMS_LOB.WRITEAPPEND(createViewSql, LENGTHB(SqlQuery2),sqlQuery2);
		END IF;

		leng := DBMS_LOB.GETLENGTH(createViewSql); 

		IF leng > 32000 THEN

		for j in 1..CEIL(DBMS_LOB.getlength(createViewSql) / 32000)

		loop

			buffer := DBMS_LOB.substr(createViewSql, 32000,(j-1) * 32000+ 1);

			FillSqlTable (buffer,sqlTable);

		end loop;

		ELSE

		DBMS_LOB.Read(createViewSql,leng,1,buffer);
		
		FillSqlTable (buffer,sqlTable);

		END IF;

		DBMS_LOB.CLOSE (createViewSql);
		DBMS_LOB.FREETEMPORARY(createViewSql);

		cur := DBMS_SQL.OPEN_CURSOR;
		DBMS_SQL.PARSE(cur, sqlTable,sqlTable.FIRST, sqlTable.LAST,FALSE, DBMS_SQL.NATIVE);
		DBMS_SQL.CLOSE_CURSOR(cur);

		EUL5_BATCH_REP_SECURE.CreateLargeView(sqlTable);
		
	END ;

-- =====================================================================
-- PROCEDURE: CreateView()
-- DESCRIPTION: Dynamically create the view.
PROCEDURE CreateView(timeStamp IN VARCHAR2,
                     queryNo   IN NUMBER,
                     sqlQuery  IN VARCHAR2,
                     cols      IN VARCHAR2,
                     base      IN BOOLEAN) IS
    cur INTEGER;
    tTimeStamp     VARCHAR2(20);
    tCols          VARCHAR2(32767);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');
    tCols := REPLACE(cols,'''','''''');
    
    cur := DBMS_SQL.OPEN_CURSOR;
    DBMS_SQL.PARSE(cur, sqlQuery, DBMS_SQL.V7);
    DBMS_SQL.CLOSE_CURSOR(cur);

    EUL5_BATCH_REP_SECURE.CreateView(tTimeStamp,
                                     queryNo,
                                     sqlQuery,
                                     tCols,
                                     base);
END;

-- =====================================================================
-- PROCEDURE: DropViews()
-- DESCRIPTION: Attempts to dynamically drop both the base view and the
--              summary view.
PROCEDURE DropViews(timeStamp IN VARCHAR2,
                    queryNo   IN NUMBER) IS
    tTimeStamp     VARCHAR2(20);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');

    EUL5_BATCH_REP_SECURE.DropViews(tTimeStamp,
                                    queryNo);

END DropViews;

-- =====================================================================
-- PROCEDURE: DropTable()
-- DESCRIPTION: Generic drop table routine.
PROCEDURE DropTable(tableName IN VARCHAR2) IS
    tTableName VARCHAR2(80);
BEGIN

    tTableName := REPLACE(tableName,'''','''''');

    CheckTablePrivileges(tTableName);

    EUL5_BATCH_REP_SECURE.DropTable(tTableName);

END DropTable;

-- =====================================================================
-- PROCEDURE: DropPackage()
-- DESCRIPTION: Attempts to dynamically drop a Procedure.
PROCEDURE DropPackage(timeStamp IN VARCHAR2) IS
    tTimeStamp     VARCHAR2(20);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');

    EUL5_BATCH_REP_SECURE.DropPackage(tTimeStamp);

END DropPackage;

-- =====================================================================
-- PROCEDURE: InitializePackage()
-- DESCRIPTION:
PROCEDURE InitializePackage(timeStamp     IN VARCHAR2,
                            eulSchemaName IN VARCHAR2,
                            batchReportId IN NUMBER,
                            preExec       IN VARCHAR2) IS
    tEulSchemaName VARCHAR2(60);
    tTimeStamp     VARCHAR2(20);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');
    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');

    EUL5_BATCH_REP_SECURE.InitializePackage(tTimeStamp,
                                            tEulSchemaName,
                                            batchReportId,
                                            preExec);

END InitializePackage;

-- =====================================================================
-- PROCEDURE: AddQuery()
-- DESCRIPTION:
PROCEDURE AddQuery(batchQueryId    IN NUMBER,
                   queryNo         IN NUMBER,
                   createTableCols IN VARCHAR2,
                   insertStatement IN VARCHAR2,
                   summaryId       IN NUMBER := NULL) IS
    tCreateTableCols VARCHAR2(32767);
    tInsertStatement VARCHAR2(32767);
BEGIN

    tCreateTableCols := REPLACE(createTableCols,'''','''''');
    tInsertStatement := REPLACE(insertStatement,'''','''''');

    EUL5_BATCH_REP_SECURE.AddQuery(batchQueryId,
                                   queryNo,
                                   tCreateTableCols,
                                   tInsertStatement,
                                   summaryId);

END AddQuery;

-- =====================================================================
-- PROCEDURE: CreatePackage()
-- DESCRIPTION:
PROCEDURE CreatePackage(timeStamp IN VARCHAR2) IS
    tTimeStamp     VARCHAR2(20);
BEGIN

    tTimeStamp := REPLACE(timeStamp,'''','''''');

    EUL5_BATCH_REP_SECURE.CreatePackage(tTimeStamp);

END CreatePackage;

-- =====================================================================
-- PROCEDURE: GetVersion()
-- DESCRIPTION: Returns the current version of the package for upgrade
--              purposes.
PROCEDURE GetVersion(version OUT NUMBER) IS
BEGIN

    EUL5_BATCH_REP_SECURE.GetVersion(version);

END GetVersion;

-- =====================================================================
-- PROCEDURE: GetMinorVersion()
-- DESCRIPTION: Returns the minor current version of the package for upgrade
--              purposes.
PROCEDURE GetMinorVersion(minorVersion OUT NUMBER) IS
BEGIN

   minorVersion := 1;

END GetMinorVersion;


-- =====================================================================
-- PROCEDURE: IsEULAvailable()
-- DESCRIPTION: Indicates whether the EUL is granted to the package.
PROCEDURE IsGrantedEUL(eulSchemaName IN VARCHAR2) IS
    tEulSchemaName  VARCHAR2(60);
BEGIN

    tEulSchemaName := REPLACE(eulSchemaName,'''','''''');

    EUL5_BATCH_REP_SECURE.IsGrantedEUL(tEulSchemaName);

END IsGrantedEUL;

END EUL5_BATCH_REPOSITORY;
/



REM -----------------------------------------------------------------
REM grant access on EUL5_BATCH_REPOSITORY to PUBLIC
REM

PROMPT
PROMPT Granting access to EUL5_BATCH_REPOSITORY for all users
PROMPT
set termout off

grant execute on EUL5_BATCH_REPOSITORY to PUBLIC;

set termout on

PROMPT
PROMPT Granting Scheduled Workbook Results Schema access to EUL
PROMPT
PROMPT A Scheduled Workbook Results Schema can only have access to one EUL
PROMPT

accept EUL_Owner prompt 'EUL Owner Username : '
accept EUL_Pass prompt 'EUL Owner Password : ' hide

REM Grant the Execute permission to the EULOwner , so that he can propagate it 
REM to other Batch Respository users.

PROMPT Granting execute on EUL5_BATCH_DISCO_ADMINS To EUL Owner.

grant execute on EUL5_BATCH_DISCO_ADMINS to &EUL_Owner WITH GRANT OPTION;

connect &EUL_Owner/&EUL_Pass@&Batch_DBLink;

PROMPT
PROMPT Connected to EUL, granting access to Scheduled Workbook Results Schema ...
PROMPT

set termout off

grant select, insert, update, delete on EUL5_ACCESS_PRIVS to &Batch_User;
grant select, insert, update, delete on EUL5_APP_PARAMS to &Batch_User; 
grant select, insert, update, delete on EUL5_ASMP_CONS to &Batch_User; 
grant select, insert, update, delete on EUL5_ASMP_LOGS to &Batch_User;
grant select, insert, update, delete on EUL5_ASM_POLICIES to &Batch_User;
grant select, insert, update, delete on EUL5_BAS to &Batch_User;
grant select, insert, update, delete on EUL5_BATCH_PARAMS to &Batch_User;
grant select, insert, update, delete on EUL5_BATCH_QUERIES to &Batch_User;
grant select, insert, update, delete on EUL5_BATCH_REPORTS to &Batch_User;
grant select, insert, update, delete on EUL5_BATCH_SHEETS to &Batch_User;
grant select, insert, update, delete on EUL5_BA_OBJ_LINKS to &Batch_User;
grant select, insert, update, delete on EUL5_BQ_DEPS to &Batch_User;
grant select, insert, update, delete on EUL5_BQ_TABLES to &Batch_User;
grant select, insert, update, delete on EUL5_BR_RUNS to &Batch_User;
grant select, insert, update, delete on EUL5_DBH_NODES to &Batch_User;
grant select, insert, update, delete on EUL5_DOCUMENTS to &Batch_User;
grant select, insert, update, delete on EUL5_DOMAINS to &Batch_User;
grant select, insert, update, delete on EUL5_ELEM_XREFS to &Batch_User;
grant select, insert, update, delete on EUL5_EUL_USERS to &Batch_User;
grant select, insert, update, delete on EUL5_EXPRESSIONS to &Batch_User;
grant select, insert, update, delete on EUL5_EXP_DEPS to &Batch_User;
grant select, insert, update, delete on EUL5_FREQ_UNITS to &Batch_User;
grant select, insert, update, delete on EUL5_FUNCTIONS to &Batch_User;
grant select, insert, update, delete on EUL5_FUN_ARGUMENTS to &Batch_User;
grant select, insert, update, delete on EUL5_FUN_CTGS to &Batch_User;
grant select, insert, update, delete on EUL5_FUN_FC_LINKS to &Batch_User;
grant select, insert, update, delete on EUL5_GATEWAYS to &Batch_User;
grant select, insert, update, delete on EUL5_HIERARCHIES to &Batch_User;
grant select, insert, update, delete on EUL5_HI_NODES to &Batch_User;
grant select, insert, update, delete on EUL5_HI_SEGMENTS to &Batch_User;
grant select, insert, update, delete on EUL5_IG_EXP_LINKS to &Batch_User;
grant select, insert, update, delete on EUL5_IHS_FK_LINKS to &Batch_User;
grant select, insert, update, delete on EUL5_KEY_CONS to &Batch_User;
grant select, insert, update, delete on EUL5_OBJS to &Batch_User;
grant select, insert, update, delete on EUL5_OBJ_DEPS to &Batch_User;
grant select, insert, update, delete on EUL5_OBJ_JOIN_USGS to &Batch_User;
grant select, insert, update, delete on EUL5_PLAN_TABLE to &Batch_User;
grant select, insert, update, delete on EUL5_QPP_STATS to &Batch_User;
grant select, insert, update, delete on EUL5_SEGMENTS to &Batch_User;
grant select, insert, update, delete on EUL5_SEQUENCES to &Batch_User;
grant select, insert, update, delete on EUL5_SQ_CRRLTNS to &Batch_User;
grant select, insert, update, delete on EUL5_SUB_QUERIES to &Batch_User;
grant select, insert, update, delete on EUL5_SUMMARY_OBJS to &Batch_User;
grant select, insert, update, delete on EUL5_SUMO_EXP_USGS to &Batch_User;
grant select, insert, update, delete on EUL5_SUM_BITMAPS to &Batch_User;
grant select, insert, update, delete on EUL5_SUM_RFSH_SETS to &Batch_User;
grant select, insert, update, delete on EUL5_VERSIONS to &Batch_User;

grant select, insert, update, delete on EUL5_NAMED_ELEMS to &Batch_User;
grant select, insert, update, delete on EUL5_ODBC_CATALOGS to &Batch_User;
grant select, insert, update, delete on EUL5_ODBC_SCHEMAS to &Batch_User;

grant select on EUL5_ID_SEQ to &Batch_User;
grant execute on eul5_get_object_name to &Batch_User;
grant execute on eul5_get_item_name to &Batch_User;


set feedback off
set verify off
set pause off
set termout off
set heading off
set echo off

select distinct 'GRANT EXECUTE ON &Batch_User..EUL5_BATCH_DISCO_ADMINS TO ' || EU_USERNAME || chr(10) || ' WITH GRANT OPTION;' from eul5_eul_users,eul5_access_privs where eul5_eul_users.eu_id IN ( select ap_eu_id from eul5_access_privs where gp_app_id = 1006 ) and eul5_access_privs.GP_APP_ID = 1015 and EU_USERNAME != UPPER('&EUL_Owner');

spool tmpbatch.sql
/
spool off

start tmpbatch.sql

PROMPT 
PROMPT Permissions granted on EUL5_BATCH_DISCO_ADMINS to all Discoverer Admins
PROMPT

REM -----------------------------------------------------------------
REM Installation of Scheduled Workbook Results Schema Complete
REM

set termout on

PROMPT 
PROMPT Scheduled Workbook Results Schema Installation Process Finished
PROMPT
accept foo prompt 'Press Enter/Return to Exit'
exit
