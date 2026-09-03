REM
REM This file allows for the granting of access to gateways.
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
accept GWID PROMPT 'Input ID of gateway to which access is to be granted( <return> to quit ) : '
PROMPT
PROMPT
accept GWUSER PROMPT 'Input the name of the user to which access is to be granted( <return> to quit ) : '
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
PROMPT You have selected the following for granting access
PROMPT

SELECT GW_ID, GW_GATEWAY_NAME, GW_PRODUCT_NAME, EGW_SCHEMA SCH
	FROM EUL_GATEWAYS
	WHERE GW_TYPE = 'EGW' AND GW_ID = &GWID;

PROMPT
Accept INDELGW PROMPT 'Do you really want to grant access to it? [N] : '
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
GRANT SELECT ON EUL_GW_SCHEMAS TO &GWUSER;
GRANT SELECT ON EUL_GW_OBJS TO &GWUSER;
GRANT SELECT ON EUL_GW_COLS TO &GWUSER;
GRANT SELECT ON EUL_GW_FILTERS TO &GWUSER;
GRANT SELECT ON EUL_GW_UKS TO &GWUSER;
GRANT SELECT ON EUL_GW_UK_COLS TO &GWUSER;
GRANT SELECT ON EUL_GW_FKS TO &GWUSER;
GRANT SELECT ON EUL_GW_FK_COLS TO &GWUSER;
GRANT SELECT ON EUL_GW_OBJ_FK_USGS TO &GWUSER;
GRANT SELECT ON EUL_GW_HIERS TO &GWUSER;
GRANT SELECT ON EUL_GW_HIER_NDS TO &GWUSER;
GRANT SELECT ON EUL_GW_HIER_N_COLS TO &GWUSER;
GRANT SELECT ON EUL_GW_HIER_SEGS TO &GWUSER;
GRANT SELECT ON EUL_GW_BAS TO &GWUSER;
GRANT SELECT ON EUL_GW_BA_OBJREFS TO &GWUSER;
GRANT SELECT ON EUL_GW_BA_UPRIVS TO &GWUSER;

accept foo prompt 'Press Enter/Return to exit' 

exit
