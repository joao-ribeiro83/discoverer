REM This script sets up privileges required for Summary Management (and ASM) in 
REM Discoverer Administration Edition 4.1 

Define Username = &Username

set termout off


PROMPT Performing grants...

REM Core Summary Managemnt Privs
grant CREATE TABLE to &Username;
grant CREATE VIEW to &Username;
grant CREATE PROCEDURE to &Username;

REM These privs are only required if using Oracle 8.1.6 and above
grant analyze any to &Username;
grant create any materialized view to &Username;
grant drop any materialized view to &Username;
grant alter any materialized view to &Username;
grant global query rewrite to &Username;
undef Username

set termout on

