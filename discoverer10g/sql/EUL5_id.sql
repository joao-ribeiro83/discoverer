REM Copyright (c) 2003 by Oracle   All Rights Reserved
REM 
REM File:           EUL5_id.sql
REM Description:    Use this script after a database clone of an EUL to reset the EUL id
REM
REM Notes:
REM
REM


update EUL5_VERSIONS set VER_EUL_TIMESTAMP = TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS')
/

commit
/

