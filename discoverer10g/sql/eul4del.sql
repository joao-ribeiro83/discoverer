REM EUL4DEL.SQL
REM Script to clear all 4.1 or 4.2 EUL objects
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

prompt drop table video4.product cascade constraints;;
prompt drop table video4.sales_fact cascade constraints;;
prompt drop table video4.times cascade constraints;;
prompt drop table video4.store cascade constraints;;
prompt drop table video4.target_sales cascade constraints;;
prompt drop table video4.video_summ_all cascade constraints;;
prompt drop table video4.video_summ_yr cascade constraints;;
prompt drop table video4.video_summ_dept_reg cascade constraints;;
prompt drop table video4.video_sum_dept_reg_yr cascade constraints;;

spool off

REM Set up our "ask whether to drop tutorial script"

set termout off
set echo off
set define off
spool tmpatut.sql

prompt set echo off
prompt set termout on
prompt prompt
prompt prompt 4.1 Tutorial tables have been detected on your system.
prompt prompt
prompt accept droptut char prompt 'Do you wish to remove the 4.1 tutorial tables? [N]: ' 
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
PROMPT Discoverer End User Layer Database Tables (4.x Production) deinstallation
PROMPT ===========================================================================
PROMPT
PROMPT This script will remove a version 4.x EUL and any associated database objects.
PROMPT
PROMPT It will :
PROMPT
PROMPT 1.  Ask you to enter the ORACLE SYSTEM password and connect string.    
PROMPT 2.  Ask you to enter the name and password of the 4.x EUL owner.
PROMPT 3.  Confirm that you wish to drop the 4.x EUL.
PROMPT 4.  Check for database jobs for users other than the 4.x EUL owner.
PROMPT 5.  Confirm whether to drop 4.1 tutorial tables (if any).
PROMPT 6.  Log in as the 4.x EUL owner and remove any database jobs for it.
PROMPT 7.  Remove all summary database objects for the 4.x EUL.
PROMPT 8.  Remove all scheduled workbook database objects for the 4.x EUL.
PROMPT 9.  Remove the 4.x EUL tables.
PROMPT 10. Remove user and public synonyms (if any) for the 4.x EUL tables.
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

whenever sqlerror exit
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
PROMPT Enter details of the ORACLE user which owns the 4.x EUL:
PROMPT
accept INEULOWNER prompt 'Username : '
accept INEULPASS  prompt 'Password : ' hide

REM Attempt the connection and exit thru the SQLERROR it its invalid

set echo off
set termout off

whenever sqlerror exit
connect &INEULOWNER/&INEULPASS@&INDB

set echo off
set feedback on

REM If we are not connected or if EUL4_VERSIONS doesn't exist this will fail and exit

whenever sqlerror exit
set echo off
set termout off
select null from eul4_versions;
whenever sqlerror continue

REM
set echo off
set termout on
set feedback off
REM
select 'Preparing to remove EUL '||VER_RELEASE||' owned by '||
user||' at '||to_char(sysdate,'HH24:MI DD-Mon-YY')
from eul4_versions
/

PROMPT
PROMPT Please Note:
PROMPT ============
PROMPT If you continue the specified 4.x End User Layer will be PERMANENTLY 
PROMPT dropped. All End User Layer information and workbooks stored in the 
PROMPT database will be deleted. 
PROMPT
PROMPT Any 5.x End User Layer tables will NOT be affected by this process.
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
 from   &INEULOWNER..eul4_sum_rfsh_sets, &INEULOWNER..eul4_eul_users, dba_jobs j
 where  srs_eu_id    = eu_id
 and    eu_username != upper('&INEULOWNER')
 and    srs_job_id   = j.job)
/

select 'User: ' || eu_username || ' Summary: ' || srs_name
from   &INEULOWNER..eul4_sum_rfsh_sets, &INEULOWNER..eul4_eul_users, dba_jobs j
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
 from   &INEULOWNER..eul4_sum_rfsh_sets, &INEULOWNER..eul4_eul_users, dba_jobs j
 where  srs_eu_id    = eu_id
 and    eu_username != upper('&INEULOWNER')
 and    srs_job_id   = j.job)

spool tmpifq.sql
/
spool off
start tmpifq.sql

REM WE DIDNT QUIT ...


REM
REM Confirm whether to drop 4.1 tutorial tables (if any).
REM

set echo off
set termout off

select 'start tmpatut.sql'
from   sys.dual
where  exists
(select 'x'
 from   dba_tables
 where  owner = 'VIDEO4'
 and    table_name in ('PRODUCT','SALES_FACT','TIMES','STORE','TARGET_SALES','VIDEO_SUMM_ALL','VIDEO_SUMM_YR','VIDEO_SUMM_DEPT_REG','VIDEO_SUM_DEPT_REG_YR'))

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
from   eul4_sum_rfsh_sets,user_jobs 
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

select 'DROP PACKAGE ' || eu_username || '.EUL4_CSUMMARY' || srs_id || ';'
from   eul4_sum_rfsh_sets, eul4_eul_users
where  srs_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL4_SRSUMMARY' || srs_id || ';'
from   eul4_sum_rfsh_sets, eul4_eul_users
where  srs_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL4_SBSUMMARY' || sumo_id || ';'
from   eul4_summary_objs, eul4_sum_rfsh_sets, eul4_eul_users
where  sbo_srs_id = srs_id
and    srs_eu_id  = eu_id
and    sumo_type = 'SBO'
order by 1
/

select 'DROP VIEW ' || eu_username || '.EUL4_V1SUMMARY' || ems.sumo_id || ';'
from   eul4_summary_objs ems, eul4_summary_objs sbo, eul4_sum_rfsh_sets, eul4_eul_users
where  ems.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    ems.sumo_type = 'EMS'
order by 1
/

select 'DROP VIEW ' || eu_username || '.EUL4_V2SUMMARY' || ems.sumo_id || ';'
from   eul4_summary_objs ems, eul4_summary_objs sbo, eul4_sum_rfsh_sets, eul4_eul_users
where  ems.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    ems.sumo_type = 'EMS'
order by 1
/

select 'DROP TABLE ' || eu_username || '.' || ems.sdo_table_name || ';'
from   eul4_summary_objs ems, eul4_summary_objs sbo, eul4_sum_rfsh_sets, eul4_eul_users
where  ems.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    ems.sumo_type IN ('EMS','SMS')
and    srs_state <> 6
order by 1
/

select 'DROP MATERIALIZED VIEW ' || eu_username || '.' || sms.sdo_table_name || ';'
from   eul4_summary_objs sms, eul4_summary_objs sbo, eul4_sum_rfsh_sets, eul4_eul_users
where  sms.sdo_sbo_id = sbo.sumo_id
and    sbo.sbo_srs_id  = srs_id
and    srs_eu_id       = eu_id
and    sms.sumo_type = 'SMS'
order by 1
/

spool off
set feedback on
set pages 600

connect SYSTEM/&INSYSPASS@&INDB

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
from   eul4_batch_reports,user_jobs 
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

select 'DROP PACKAGE ' || eu_username || '.EUL4_BATCH_USER;'
from   eul4_batch_reports, eul4_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL4_BATCH_REPOSITORY;'
from   eul4_batch_reports, eul4_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP PACKAGE ' || eu_username || '.EUL4_BATCH_PACKAGE' || to_char(br_completion_date,'YYMMDDHH24MISS') || ';'
from   eul4_batch_reports, eul4_eul_users
where  br_eu_id = eu_id
order by 1
/

select 'DROP TABLE ' || eu_username || '.' || bq.bqt_table_name || ';'
from   eul4_bq_tables bq, eul4_batch_reports, eul4_eul_users
where  br_eu_id       = eu_id
order by 1
/

select 'DROP VIEW ' || owner || '.' || object_name || ';'
from   all_objects, eul4_batch_reports, eul4_eul_users
where  object_type = 'VIEW'
and    object_name like 'EUL4_B%' || to_char(br_completion_date,'YYMMDDHH24MISS') || 'Q%'
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
prompt Dropping 4.x End User Layer Tables  ...
set termout off

connect &INEULOWNER/&INEULPASS@&INDB

DROP SEQUENCE EUL4_ID_SEQ;                                                                                                                                                                              
DROP TABLE EUL4_ACCESS_PRIVS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_APP_PARAMS CASCADE CONSTRAINTS;                                                                                                                                                         
DROP TABLE EUL4_ASMP_CONS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_ASMP_LOGS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_ASM_POLICIES CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_BAS CASCADE CONSTRAINTS;                                                                                                                                                                
DROP TABLE EUL4_BATCH_PARAMS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_BATCH_QUERIES CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_BATCH_REPORTS CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_BATCH_SHEETS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_BA_OBJ_LINKS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_BQ_DEPS CASCADE CONSTRAINTS;                                                                                                                                                            
DROP TABLE EUL4_BQ_TABLES CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_BR_RUNS CASCADE CONSTRAINTS;                                                                                                                                                            
DROP TABLE EUL4_DBH_NODES CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_DOCUMENTS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_DOMAINS CASCADE CONSTRAINTS;                                                                                                                                                            
DROP TABLE EUL4_ELEM_XREFS CASCADE CONSTRAINTS;                                                                                                                                                         
DROP TABLE EUL4_EUL_USERS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_EXPRESSIONS CASCADE CONSTRAINTS;                                                                                                                                                        
DROP TABLE EUL4_EXP_DEPS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_FREQ_UNITS CASCADE CONSTRAINTS;                                                                                                                                                         
DROP TABLE EUL4_FUNCTIONS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_FUN_ARGUMENTS CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_FUN_CTGS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_FUN_FC_LINKS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_GATEWAYS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_HIERARCHIES CASCADE CONSTRAINTS;                                                                                                                                                        
DROP TABLE EUL4_HI_NODES CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_HI_SEGMENTS CASCADE CONSTRAINTS;                                                                                                                                                        
DROP TABLE EUL4_IG_EXP_LINKS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_IHS_FK_LINKS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_KEY_CONS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_OBJS CASCADE CONSTRAINTS;                                                                                                                                                               
DROP TABLE EUL4_OBJ_DEPS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_OBJ_JOIN_USGS CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_PLAN_TABLE CASCADE CONSTRAINTS;                                                                                                                                                         
DROP TABLE EUL4_QPP_STATS CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_SEGMENTS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP TABLE EUL4_SEQUENCES CASCADE CONSTRAINTS;                                                                                                                                                          
DROP TABLE EUL4_SQ_CRRLTNS CASCADE CONSTRAINTS;                                                                                                                                                         
DROP TABLE EUL4_SUB_QUERIES CASCADE CONSTRAINTS;                                                                                                                                                        
DROP TABLE EUL4_SUMMARY_OBJS CASCADE CONSTRAINTS;                                                                                                                                                       
DROP TABLE EUL4_SUMO_EXP_USGS CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_SUM_BITMAPS CASCADE CONSTRAINTS;                                                                                                                                                        
DROP TABLE EUL4_SUM_RFSH_SETS CASCADE CONSTRAINTS;                                                                                                                                                      
DROP TABLE EUL4_VERSIONS CASCADE CONSTRAINTS;                                                                                                                                                           
DROP VIEW EUL4_NAMED_ELEMS;                                                                                                                                                                             
DROP VIEW EUL4_ODBC_CATALOGS;                                                                                                                                                                           
DROP VIEW EUL4_ODBC_SCHEMAS;                                                                                                                                                                            
DROP FUNCTION EUL4_GET_ITEM_NAME;
DROP FUNCTION EUL4_GET_OBJECT_NAME;

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
and    ( table_name like 'EUL4_%' )
/

select 'DROP SYNONYM ' || owner || '.' || synonym_name || ';'
from   dba_synonyms
where  table_owner = upper('&INEULOWNER')
and    ( table_name like 'EUL4_%' )
/

spool off

@tmpsdrop

set echo off
set feedback off
set termout on
PROMPT
PROMPT Finished removing 4.x End User Layer.
PROMPT
disconnect


