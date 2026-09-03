REM
REM This file allows for the deletion of gateways.
REM
set lines 80
set pages 5000
set verify off
set pause off
set feedback off
set echo off

PROMPT Installed external gateways:

column GW_ID format 999999
column GW_GATEWAY_NAME format a30 wrap
column GW_PRODUCT_NAME format a30 wrap
set heading on

SELECT GW_ID, GW_GATEWAY_NAME, GW_PRODUCT_NAME
	FROM EUL_GATEWAYS
	WHERE GW_TYPE = 'EGW'
 
/

set termout on

PROMPT
accept GWID PROMPT 'Input ID of gateway to be removed ( <return> to quit ) : '
PROMPT
set echo off
set termout off
set feedback off
set heading off	
set verify off

select 'start EGWQUIT'
from dual
where not exists ( select GW_ID
		  FROM   EUL_GATEWAYS
		  WHERE  GW_TYPE = 'EGW' AND to_char(GW_ID) = '&GWID'
		 )

spool EGWTEMP.SQL
/
spool off
start EGWTEMP

set termout on
set heading on

col SCH noprint new_value GWSCHEMA

PROMPT
PROMPT You have selected the following for deletion
PROMPT

SELECT GW_ID, GW_GATEWAY_NAME, GW_PRODUCT_NAME, EGW_SCHEMA SCH
	FROM EUL_GATEWAYS
	WHERE GW_TYPE = 'EGW' AND GW_ID = &GWID;

PROMPT
Accept INDELGW PROMPT 'Do you really want to delete it? [N] : '
PROMPT
set echo off
set termout off
set feedback off
set heading off	
set verify off

select 'start EGWQUIT'
from dual
where upper(nvl('&INDELGW','N')) not in ( 'Y', 'YES' )

spool EGWTEMP.SQL
/
spool off
start EGWTEMP

DELETE FROM EUL_GATEWAYS
	WHERE GW_ID = &GWID;
COMMIT;

set termout on
PROMPT
Accept INDROPGW PROMPT 'Do you want to drop the gateway objects? [N] : '
PROMPT
set echo off
set termout off
set feedback off
set heading off	
set verify off

select 'start EGWQUIT'
from dual
where upper(nvl('&INDROPGW','N')) not in ( 'Y', 'YES' )

spool EGWTEMP.SQL
/
spool off
start EGWTEMP

set termout on
PROMPT
accept GWPASS PROMPT 'Enter the password for user &GWSCHEMA : ' hide
accept GWCONN PROMPT ' Connect string [LOCAL] : '
PROMPT

CONNECT &GWSCHEMA/&GWPASS@&GWCONN

whenever sqlerror exit;
set echo off
set termout off
select null from dual;
whenever sqlerror continue;

set termout on
DROP TABLE EUL_GW_SCHEMAS;
DROP TABLE EUL_GW_OBJS;
DROP TABLE EUL_GW_COLS;
DROP TABLE EUL_GW_FILTERS;
DROP TABLE EUL_GW_UKS;
DROP TABLE EUL_GW_UK_COLS;
DROP TABLE EUL_GW_FKS;
DROP TABLE EUL_GW_FK_COLS;
DROP TABLE EUL_GW_OBJ_FK_USGS;
DROP TABLE EUL_GW_HIERS;
DROP TABLE EUL_GW_HIER_NDS;
DROP TABLE EUL_GW_HIER_N_COLS;
DROP TABLE EUL_GW_HIER_SEGS;
DROP TABLE EUL_GW_BAS;
DROP TABLE EUL_GW_BA_OBJREFS;
DROP TABLE EUL_GW_BA_UPRIVS;
DROP VIEW EUL_GW_SCHEMAS;
DROP VIEW EUL_GW_OBJS;
DROP VIEW EUL_GW_COLS;
DROP VIEW EUL_GW_FILTERS;
DROP VIEW EUL_GW_UKS;
DROP VIEW EUL_GW_UK_COLS;
DROP VIEW EUL_GW_FKS;
DROP VIEW EUL_GW_FK_COLS;
DROP VIEW EUL_GW_OBJ_FK_USGS;
DROP VIEW EUL_GW_HIERS;
DROP VIEW EUL_GW_HIER_NDS;
DROP VIEW EUL_GW_HIER_N_COLS;
DROP VIEW EUL_GW_HIER_SEGS;
DROP VIEW EUL_GW_BAS;
DROP VIEW EUL_GW_BA_OBJREFS;
DROP VIEW EUL_GW_BA_UPRIVS;

accept foo prompt 'Press Enter/Return to exit' 

exit
