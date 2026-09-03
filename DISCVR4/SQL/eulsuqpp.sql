REM EULSUQPP.SQL
REM Script to setup the necessary grants for QPP
REM

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
PROMPT Discoverer End User Layer 4.1 QPP Setup
PROMPT =======================================
PROMPT
PROMPT For optimal usage of Query Prediction, Discoverer users need access to the 
PROMPT following system views:
PROMPT   V$SQL
PROMPT
PROMPT This script will perform the necessary grants required for Query Prediction.
PROMPT
PROMPT It will :
PROMPT
PROMPT 1.  Ask you to enter the ORACLE SYS password and connect string.    
PROMPT 2.  Perform the necessary grants
PROMPT 3.  Disconnect
PROMPT
PROMPT Default answers are shown in [] brackets.
PROMPT

REM -------------------------------------------------------------------------
REM Prompt for the SYS password and database connection string

accept INSYSPASS prompt 'Enter ORACLE SYS Password .................................... : ' hide
accept INDB      prompt 'Enter database connection (eg T:node:sid, ServiceName) [LOCAL] : '

REM Attempt the connection and exit thru the SQLERROR it its invalid

set echo off
set termout off

REM If we are not connected this will fail and exit

whenever sqlerror exit
connect SYS/&INSYSPASS@&INDB

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
PROMPT Performing grants...
PROMPT
grant select on v_$session to public;
grant select on v_$sesstat to public;
grant select on v_$parameter to public;
grant select on v_$sql to public;

set echo off
set feedback off
set termout on
PROMPT
PROMPT Finished grants - disconnecting...
PROMPT
disconnect
