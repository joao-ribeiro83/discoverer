REM Copyright (c) 1995 by Oracle Corporation.  All Rights Reserved
REM 
REM File:           eulver.sql
REM Description:    discoverer EUL VERsion 
REM Notes:
REM
REM

delete from EUL5_VERSIONS
/

insert into EUL5_VERSIONS
 (VER_MIN_CODE_VER,
  VER_RELEASE,
  VER_EUL_TIMESTAMP
)
values
 ('5.0.0.0.0.0',
  '5.0.2.0.0.0',
  to_char(sysdate, 'YYYYMMDDHH24MISS'))
/

 
commit
/
