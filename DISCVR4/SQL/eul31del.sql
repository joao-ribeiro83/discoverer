REM EUL30DT.SQL
REM Script to clear all 3.1 EUL objects
REM

REM Set up our "quit script"

set termout off
set echo off
spool tmpquit.sql

prompt set echo off
prompt set termout on
prompt prompt
prompt prompt Quitting - no changes made.
prompt prompt
prompt prompt Refer to your Installation Guide or Release Notes for more
prompt prompt information on installing or upgrading Oracle Discoverer. 
prompt prompt 
prompt accept foo prompt 'Press Enter/Return to exit' 
prompt spool off
prompt exit

spool off

REM Set up our "drop tutorial script"

set termout off
set echo off
spool tmpdtut.sql

prompt drop table video31.product cascade constraints;;
prompt drop table video31.sales_fact cascade constraints;;
prompt drop table video31.time cascade constraints;;
prompt drop table video31.store cascade constraints;;
prompt drop table video31.vid_summ_all cascade constraints;;
prompt drop table video31.vid_summ_yr cascade constraints;;
prompt drop table video31.vid_summ_dept_reg cascade constraints;;
prompt drop table video31.vid_sum_dept_reg_yr cascade constraints;;

spool off

REM Set up our "ask whether to drop tutorial script"

set termout off
set echo off
set define off
spool tmpatut.sql

prompt set echo off
prompt set termout on
prompt prompt
prompt prompt 3.1 Tutorial tables have been detected on your system.
prompt prompt
prompt accept droptut char prompt 'Do you wish to remove the 3.1 tutorial tables? [N]: ' 
prompt prompt
prompt set termout off
prompt set echo on
prompt select 'start tmpdtut'
prompt from sys.dual
prompt where nvl(upper('&droptut'),'N') in ('Y', 'YES')
prompt
prompt spool tmpifq.sql
prompt /
prompt spool off
prompt start tmpifq

spool off

clear screen 
set define on
set lines 100
set pages 5000
set feedback off
set verify off
set pause off
set termout off
set heading off
REM
set echo off
set termout on
REM
PROMPT
PROMPT Discoverer End User Layer Database Tables (3.1 Production) deinstallation
PROMPT ===========================================================================
PROMPT
PROMPT This script will remove a version 3.1 EUL and any associated database objects.
PROMPT
PROMPT It will :
PROMPT
PROMPT 1.  Ask you to enter the ORACLE SYSTEM password and connect string.    
PROMPT 2.  Ask you to enter the name and password of the 3.1 EUL owner.
PROMPT 3.  Confirm that you wish to drop the 3.1 EUL.
PROMPT 4.  Check for database jobs for users other than the 3.1 EUL owner.
PROMPT 5.  Confirm whether to drop 3.1 tutorial tables (if any).
PROMPT 6.  Log in as the 3.1 EUL owner and remove any database jobs for it.
PROMPT 7.  Remove all summary database objects for the 3.1 EUL.
PROMPT 8.  Remove all scheduled workbook database objects for the 3.1 EUL.
PROMPT 9.  Remove the 3.1 EUL tables.
PROMPT 10. Remove user and public synonyms (if any) for the 3.1 EUL tables.
PROMPT
PROMPT Default answers are shown in [] brackets.
PROMPT

REM -------------------------------------------------------------------------
REM Prompt for the SYSTEM password and database connection string

accept INSYSPASS prompt 'Enter ORACLE SYSTEM Password ................................. : ' hide
accept INDB      prompt 'Enter database connection (eg T:node:sid, ServiceName) [LOCAL] : '

REM Attempt the connection and exit thru the SQLERROR it its invalid

set echo off
set termout off

connect SYSTEM/&INSYSPASS@&INDB

set echo off
set feedback on

REM If we are not connected this will fail and exit

whenever sqlerror exit
set echo off
set termout off
select null from dual;
whenever sqlerror continue

set termout on

PROMPT
PROMPT Enter details of the ORACLE user which owns the 3.1 EUL:
PROMPT
accept INEULOWNER prompt 'Username : '
accept INEULPASS  prompt 'Password : ' hide

REM Attempt the connection and exit thru the SQLERROR it its invalid

set echo off
set termout off

connect &INEULOWNER/&INEULPASS@&INDB

set echo off
set feedback on

REM If we are not connected or if EUL_VERSIONS doesn't exist this will fail and exit

whenever sqlerror exit
set echo off
set termout off
select null from eul_versions;
whenever sqlerror continue

REM
set echo off
set termout on
set feedback off
REM
select 'Preparing to remove EUL '||VER_RELEASE||' owned by '||
user||' at '||to_char(sysdate,'HH24:MI DD-Mon-YY')
from eul_versions
/

PROMPT
PROMPT Please Note:
PROMPT ============
PROMPT If you continue the specified 3.1 End User Layer will be PERMANENTLY 
PROMPT dropped. All End User Layer information and workbooks stored in the 
PROMPT database will be deleted. 
PROMPT
PROMPT Any 4.1 End User Layer tables will NOT be affected by this process.
PROMPT 
PROMPT                     THIS PROCESS IS NON-REVERSIBLE.
PROMPT
accept askquit char prompt "Do you wish to continue [N]: "
PROMPT
PROMPT
set termout off
set echo on
rem
select 'start tmpquit'
from sys.dual
where nvl(upper('&askquit'),'N') not in ('Y', 'YES')

spool tmpifq.sql
/
spool off
start tmpifq

REM WE DIDNT QUIT ...

connect SYSTEM/&INSYSPASS@&INDB

REM
REM Check for jobs owned by non-eul owners
REM

set echo off
set termout on
select 'The following users have managed summaries which must be dropped before this EUL can be deinstalled:'
from   sys.dual
where  exists
(select null 
 from   &INEULOWNER..eul_sum_rfrsh_sets, &INEULOWNER..eul_eul_users, dba_jobs j
 where  srs_eu_id    = eu_id
 and    eu_username != upper('&INEULOWNER')
 and    srs_job_id   = j.job)
/

select 'User: ' || eu_username || ' Summary: ' || srs_name
from   &INEULOWNER..eul_sum_rfrsh_sets, &INEULOWNER..eul_eul_users, dba_jobs j
where  srs_eu_id    = eu_id
and    eu_username != upper('&INEULOWNER')
and    srs_job_id   = j.job
/

set termout off
set echo on

select 'start tmpquit.sql'
from   sys.dual
where  exists
(select null 
 from   &INEULOWNER..eul_sum_rfrsh_sets, &INEULOWNER..eul_eul_users, dba_jobs j
 where  srs_eu_id    = eu_id
 and    eu_username != upper('&INEULOWNER')
 and    srs_job_id   = j.job)

spool tmpifq.sql
/
spool off
start tmpifq.sql

REM WE DIDNT QUIT ...


REM
REM Confirm whether to drop 3.1 tutorial tables (if any).
REM

set echo off
set termout off

select 'start tmpatut.sql'
from   sys.dual
where  exists
(select 'x'
 from   dba_tables
 where  owner = 'VIDEO31'
 and    table_name in ('PRODUCT','SALES_FACT','TIME','STORE','VID_SUMM_ALL','VID_SUMM_YR','VID_SUMM_DEPT_REG','VID_SUM_DEPT_REG_YR'))

spool tmptut.sql
/
spool off
start tmptut.sql


REM drop objects used by managed summaries

set echo off
set termout on
prompt Removing summary refresh jobs ...
set termout off

connect &INEULOWNER/&INEULPASS@&INDB

set pages 600
set feedback off
spool tmpsdrop.sql

select 'EXEC DBMS_JOB.REMOVE('||SRS_JOB_ID||');' 
from   eul_sum_rfrsh_sets,user_jobs 
where  SRS_JOB_ID = JOB
/

spool off
set feedback on
set pages 600

@tmpsdrop

set echo off
set termout on
prompt Dropping internally managed summary data ...
set termout off
set pages 600
set feedback off
spool tmpsdrop.sql

select 'DROP PACKAGE ' || eu_username || '.EUL$CM31SUMMARY' || srs_id || ';'
from   eul_sum_rfrsh_sets, eul_eul_users
where  srs_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL$SR31SUMMARY' || srs_id || ';'
from   eul_sum_rfrsh_sets, eul_eul_users
where  srs_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL$SB31SUMMARY' || sumo_id || ';'
from   eul_summary_objs, eul_sum_rfrsh_sets, eul_eul_users
where  sbo_srs_id = srs_id
and    srs_eu_id  = eu_id
and    sumo_type = 'SBO'
order by 1
/

select 'DROP PROCEDURE ' || eu_username || '.EULP$SUMMARY' || sumo_id || ';'
from   eul_summary_objs, eul_sum_rfrsh_sets, eul_eul_users
where  srs_eu_id  = eu_id
and    sumo_type = 'MSDO'
order by 1
/

select 'DROP VIEW ' || eu_username || '.EUL$V131SUMMARY' || msdo.sumo_id || ';'
from   eul_summary_objs msdo, eul_summary_objs sbo, eul_sum_rfrsh_sets, eul_eul_users
where  msdo.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    msdo.sumo_type = 'MSDO'
order by 1
/

select 'DROP VIEW ' || eu_username || '.EUL$V231SUMMARY' || msdo.sumo_id || ';'
from   eul_summary_objs msdo, eul_summary_objs sbo, eul_sum_rfrsh_sets, eul_eul_users
where  msdo.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    msdo.sumo_type = 'MSDO'
order by 1
/

select 'DROP TABLE ' || eu_username || '.' || msdo.msdo_table_name || ';'
from   eul_summary_objs msdo, eul_summary_objs sbo, eul_sum_rfrsh_sets, eul_eul_users
where  msdo.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    msdo.sumo_type = 'MSDO'
order by 1
/

spool off
set feedback on
set pages 600

connect SYSTEM/&INSYSPASS@&INDB

@tmpsdrop

set pages 600
set feedback off
spool tmpsdrop.sql

select 'DROP PROCEDURE ' || owner || '.' || object_name || ';'
from   all_objects
where  object_type = 'PROCEDURE'
and    object_name like 'EUL$DELSUMMARY%'
order by 1
/

spool off
set feedback on
set pages 600

@tmpsdrop

REM drop batch jobs
set echo off
set termout on
prompt Removing scheduled workbook jobs ...
set termout off

connect &INEULOWNER/&INEULPASS@&INDB

set pages 600
set feedback off
spool tmpsdrop.sql

select 'EXEC DBMS_JOB.REMOVE('||BR_JOB_ID||');' 
from   eul_batch_reports,user_jobs 
where  BR_JOB_ID = JOB
/

spool off
set feedback on
set pages 600

@tmpsdrop


REM drop objects used by batch
set echo off
set termout on
prompt Dropping scheduled workbook data ...
set termout off
set pages 600
set feedback off
spool tmpsdrop.sql

select 'DROP PACKAGE ' || eu_username || '.EUL$BATCH_USER;'
from   eul_batch_reports, eul_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL$BATCH_REPOSITORY;'
from   eul_batch_reports, eul_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL$BATCH_PACKAGE' || to_char(br_completion_date,'YYMMDDHH24MISS') || ';'
from   eul_batch_reports, eul_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP TABLE ' || eu_username || '.' || bq.bqt_table_name || ';'
from   eul_bq_tables bq, eul_batch_reports, eul_eul_users
where  br_eu_id       = eu_id
order by 1
/

select 'DROP VIEW ' || owner || '.' || object_name || ';'
from   all_objects, eul_batch_reports, eul_eul_users
where  object_type = 'VIEW'
and    object_name like 'EUL$B%' || to_char(br_completion_date,'YYMMDDHH24MISS') || 'Q%'
and    br_eu_id = eu_id
order by 1
/

spool off
set feedback on
set pages 600

@tmpsdrop


REM drop EUL tables
set echo off
set termout on
prompt Dropping 3.1 End User Layer Tables  ...
set termout off

connect &INEULOWNER/&INEULPASS@&INDB

DROP SEQUENCE EUL_ID_SEQ;
DROP TABLE DIS_DOCS_ CASCADE CONSTRAINTS;
DROP TABLE DIS_GRANTS_ CASCADE CONSTRAINTS;
DROP TABLE EUL_ACCESS_PRIVS CASCADE CONSTRAINTS;
DROP TABLE EUL_APP_PARAMS CASCADE CONSTRAINTS;
DROP TABLE EUL_BATCH_PARAMS CASCADE CONSTRAINTS;
DROP TABLE EUL_BATCH_QUERIES CASCADE CONSTRAINTS;
DROP TABLE EUL_BATCH_REPORTS CASCADE CONSTRAINTS;
DROP TABLE EUL_BATCH_SHEETS CASCADE CONSTRAINTS;
DROP TABLE EUL_BA_OBJ_LINKS CASCADE CONSTRAINTS;
DROP TABLE EUL_BQ_DEPS CASCADE CONSTRAINTS;
DROP TABLE EUL_BQ_TABLES CASCADE CONSTRAINTS;
DROP TABLE EUL_BR_RUNS CASCADE CONSTRAINTS;
DROP TABLE EUL_BUSINESS_AREAS CASCADE CONSTRAINTS;
DROP TABLE EUL_DBH_NODES CASCADE CONSTRAINTS;
DROP TABLE EUL_DOMAINS CASCADE CONSTRAINTS;
DROP TABLE EUL_EUL_USERS CASCADE CONSTRAINTS;
DROP TABLE EUL_EXPRESSIONS CASCADE CONSTRAINTS;
DROP TABLE EUL_EXP_DEPS CASCADE CONSTRAINTS;
DROP TABLE EUL_FREQ_UNITS CASCADE CONSTRAINTS;
DROP TABLE EUL_FUNCTIONS CASCADE CONSTRAINTS;
DROP TABLE EUL_FUN_ARGUMENTS CASCADE CONSTRAINTS;
DROP TABLE EUL_FUN_CATEGORIES CASCADE CONSTRAINTS;
DROP TABLE EUL_FUN_FC_LINKS CASCADE CONSTRAINTS;
DROP TABLE EUL_GATEWAYS CASCADE CONSTRAINTS;
DROP TABLE EUL_HIERARCHIES CASCADE CONSTRAINTS;
DROP TABLE EUL_HI_NODES CASCADE CONSTRAINTS;
DROP TABLE EUL_HI_SEGMENTS CASCADE CONSTRAINTS;
DROP TABLE EUL_IG_EXP_LINKS CASCADE CONSTRAINTS;
DROP TABLE EUL_JC_JOIN_LINKS CASCADE CONSTRAINTS;
DROP TABLE EUL_JOIN_COMBS CASCADE CONSTRAINTS;
DROP TABLE EUL_KEY_CONS CASCADE CONSTRAINTS;
DROP TABLE EUL_NMSDO_JC_USGS CASCADE CONSTRAINTS;
DROP TABLE EUL_OBJS CASCADE CONSTRAINTS;
DROP TABLE EUL_OBJ_DEPS CASCADE CONSTRAINTS;
DROP TABLE EUL_OBJ_JOIN_USGS CASCADE CONSTRAINTS;
DROP TABLE EUL_PLAN_TABLE CASCADE CONSTRAINTS;
DROP TABLE EUL_QPP_STATISTICS CASCADE CONSTRAINTS;
DROP TABLE EUL_SBO_DSGN_ELEMS CASCADE CONSTRAINTS;
DROP TABLE EUL_SEGMENTS CASCADE CONSTRAINTS;
DROP TABLE EUL_SEQUENCES CASCADE CONSTRAINTS;
DROP TABLE EUL_SQ_CRRLTNS CASCADE CONSTRAINTS;
DROP TABLE EUL_SUB_QUERIES CASCADE CONSTRAINTS;
DROP TABLE EUL_SUMMARY_OBJS CASCADE CONSTRAINTS;
DROP TABLE EUL_SUMO_ITEM_USGS CASCADE CONSTRAINTS;
DROP TABLE EUL_SUM_BITMAPS CASCADE CONSTRAINTS;
DROP TABLE EUL_SUM_RFRSH_SETS CASCADE CONSTRAINTS;
DROP TABLE EUL_VERSIONS CASCADE CONSTRAINTS;
DROP VIEW DIS_ALL_DOCS;
DROP VIEW DIS_DOCS;
DROP VIEW DIS_GRANTS;
DROP VIEW EUL_ODBC_CATALOGS;
DROP VIEW EUL_ODBC_SCHEMAS;
DROP FUNCTION EUL_GET_ITEM_NAME;
DROP FUNCTION EUL_GET_OBJECT_NAME;

set echo off
set feedback off
set termout on
PROMPT Removing public synonyms (if any) ...

connect SYSTEM/&INSYSPASS@&INDB


set termout off
set pages 600
set feedback off
spool tmpsdrop.sql

select 'DROP PUBLIC SYNONYM ' || synonym_name || ';'
from   dba_synonyms
where  table_owner = upper('&INEULOWNER')
and    ( table_name like 'EUL_%' 
or       table_name like 'DIS_%'  )
/

select 'DROP SYNONYM ' || owner || '.' || synonym_name || ';'
from   dba_synonyms
where  table_owner = upper('&INEULOWNER')
and    ( table_name like 'EUL_%' 
or       table_name like 'DIS_%'  )
/

spool off

@tmpsdrop

set echo off
set feedback off
set termout on
PROMPT
PROMPT Finished removing 3.1 End User Layer.
PROMPT
disconnect
