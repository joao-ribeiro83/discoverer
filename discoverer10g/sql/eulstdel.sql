REM
REM Deletes query stats older than a specified age
REM
REM
REM NK  19-March-2002    Modified for 9.0.2 (EUL5_ tables)

clear screen 
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
REM
PROMPT
PROMPT Discoverer End User Layer Query Statistics Deletion
PROMPT ===================================================
PROMPT
PROMPT This will delete query statistics data that are older than the specified 
PROMPT number of days. If you dont want to delete statistics, leave the days blank
PROMPT and press RETURN.
PROMPT

col Days_old format 9999999999 heading Older_Than
col no_of_stats format 99999999999
set heading on

select trunc(sysdate-qs_created_date,-1) Days_Old, count(*) No_of_stats
from eul5_qpp_stats
group by trunc(sysdate-qs_created_date,-1)
/

prompt
prompt

accept INDAYS prompt 'Delete statistics older than (days) :'

set termout off
col pubcol noprint new_value DAYS 
select decode('&INDAYS','',99999,to_number('&INDAYS')) pubcol
from dual
/

set termout on
set feedback on

delete from eul5_qpp_stats
where qs_created_date < sysdate-&DAYS
;
commit;

set echo off
set feedback on
set termout on
PROMPT
PROMPT Finished deleting statistics
PROMPT
accept foo prompt 'Press Enter/Return to exit' 
spool off
exit


