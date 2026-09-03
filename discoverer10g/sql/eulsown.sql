REM     Modify Summary Ownership Discoverer EUL
REM
REM	RL	27-June-1997     Created
REM PF  12-March-2000    Modified for 4.1
REM NK  19-March-2002    Modified for 9.0.2 (EUL5_ tables)


REM
REM Modifies the Summary Ownership Information which may be needed 
REM if the End User Layer is exported using the Database Export Utility
REM and Imported into a different Username. It will prompt for the owner name
REM of the summaries in the source EUL and for the new Summary owner in the 
REM target EUL. 
REM       

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
PROMPT Discoverer End User Layer Modify Summary Owners
PROMPT ===============================================
PROMPT


REM First Display a list of current Summary Owners

column oowner format a23 heading 'Current Summary Owners'
set heading on
break on report skip 1
select distinct seu.eu_username oowner
			from eul5_eul_users seu,
			     eul5_sum_rfsh_sets srs
		  	where  seu.eu_id=srs.srs_eu_id
			order by oowner
/
set heading off

REM accept a value from the User
accept OLDOWNER prompt 'Enter Current Summary Owner from list above: '

REM Check that the value is know about in the EUL

REM
REM First the Old User Value
REM
column x format a255
column y format a255
set pagesize 0
set termout off

select 'prompt' z,'prompt Error Username '||'&&OLDOWNER'||' is not known to the End User Layer - Press any key' x,
'pause' y,'exit'
from eul5_versions 
where not exists (select NULL from eul5_eul_users seu
		  where  seu.eu_username = '&&OLDOWNER')
 
spool outest.sql
/
spool off

set termout on
start outest

REM  Display a list of Potential Summary Owners

PROMPT
set heading on
column nowner format a24 heading 'Available Summary Owners'
break on report skip 1
set pagesize 5000
select distinct seu.eu_username nowner
			from eul5_eul_users seu
			order by nowner
/
set heading off
set pagesize 0

REM accept a value from the User

accept NEWOWNER  prompt  'Enter New Summary Owner from list above: '

REM
REM Check that the value is know about in the EUL
REM
set termout off
select 'prompt' z,'prompt Error Username '||'&&NEWOWNER'||' is not known to the End User Layer - Press any key' x,
'pause' y,'exit'
from eul5_versions 
where not exists (select NULL from eul5_eul_users seu
		  where  seu.eu_username = '&&NEWOWNER')
 
spool nutest.sql
/
spool off

set termout on
start nutest

set verify on
set heading on
set feedback on
spool eulsown.log


REM   Update the Internal Summary Table Definitions that point to the
REM   'Old Owner' and set them to the 'New Owner', but only where 
REM   the Summary Refresh Set is also owned by the 'Old Owner'

update eul5_summary_objs
set    SDO_TABLE_OWNER = '&&NEWOWNER'
where  SDO_TABLE_OWNER = '&&OLDOWNER'
/

REM Modify all the Summary Refresh Sets that are owned by the 'Old Owner' 
REM and Set them to the 'New Owner'

update eul5_sum_rfsh_sets
set    SRS_EU_ID = (select eu_id 
		    from   eul5_eul_users
		    where  eu_username = '&&NEWOWNER')
where  SRS_EU_ID = (select eu_id 
		    from   eul5_eul_users
		    where  eu_username = '&&OLDOWNER')
/
commit
/
spool off
