-- EUL5_APPS.sql
--
-- Before you can use the the EUL5.eex Business Area and its workbooks you need to run this script
-- This Script needs to be run as the EUL Owner. 
-- This script can be run as many times as you like, it has no impact on your EUL.
--
-- Updated By     	Comments								  Date
-- -----------------    --------------------------------------------------  ------------
--  MJTAYLOR 		Created								17-OCT-01
--
--
--
--
--
--
set feedback off
set verify off
undefine FNDNAM
--
--
drop view EUL5_FND_USER 
/
prompt  
prompt  
prompt You need to run this script as the EUL Owner. 
Prompt Please Enter the 'FNDNAM' used in your apps connection 
prompt It does not matter what case you enter it in, Do not include any passwords (eg. APPS)
prompt
create view EUL5_FND_USER as (select user_name,user_id from &&FNDNAM..fnd_user)
/
drop view EUL5_FND_RESPONSIBILITY_VL 
/
create view EUL5_FND_RESPONSIBILITY_VL as (select responsibility_name, responsibility_id,application_id from &&FNDNAM..fnd_responsibility_vl)
/
--
CREATE OR REPLACE FUNCTION EUL5_GET_APPS_USERRESP(apps_id in varchar2,User_Resp in Varchar2:='U') RETURN VARCHAR2 IS 
APPS_USER VARCHAR2(100);

 resp		varchar2(100);
 usr		varchar2(100);
 appid		varchar2(100);
 userid		varchar2(100);
 secondhash	INTEGER;
--
 BEGIN
 IF instr(apps_id,'#',1,1)=0 then
 	APPS_USER:=apps_id; 
 ELSE
--
	IF User_Resp='R' then
		secondhash:=instr(apps_id,'#',1,2);
		IF secondhash = 0 then
		 APPS_USER:=apps_id||' - Error. This is an invalid Apps Id';
		ELSE			
			userid:=substr(apps_id,2,(secondhash - 2));
			appid:= substr(apps_id,(secondhash +1),(length(apps_id)-secondhash));
--
			BEGIN
      		SELECT responsibility_name INTO resp
			FROM EUL5_fnd_responsibility_vl 
			WHERE responsibility_id = userid
			AND application_id = appid;
--
			EXCEPTION
				WHEN OTHERS THEN
				resp:='*** Undefined Error 1 ***';
			END;			
			IF resp IS NULL then
				resp:='*** Error Cannot Find Apps Responsiblity for '||apps_id||' Is this an Apps User Id? ***';
			END IF;

        		APPS_USER:=resp;
		END IF;
	ELSE
		secondhash:=instr(apps_id,'#',1,2);
		IF secondhash <> 0 then
		 APPS_USER:=apps_id||' - Error. Responsibility not a User? Put R in Function Argument';
		ELSE
			userid:=substr(apps_id,2,length(apps_id)-1);
--			
			BEGIN
			SELECT user_name INTO usr
			FROM EUL5_fnd_user
			WHERE user_id = userid;
--
			EXCEPTION
				WHEN OTHERS THEN
				usr:='*** Undefined Error 2 ***';
			END;			
			IF usr IS NULL then
				usr:='*** Error Cannot Find Apps User for '||apps_id||' Is this an Apps Responsibility Id? ***';
			END IF;
      		APPS_USER:=usr;
		END IF;
	END IF;
END IF;
RETURN APPS_USER;
END EUL5_GET_APPS_USERRESP;
/
--
--
set feedback off
set verify off
set HEADING OFF
btitle left 'Check the FNDNAM you entered here --> '&&FNDNAM.' <-- very carefully.'skip 'If Incorrect rerun the script' 
SELECT ' '
FROM DUAL
prompt 
/
--
--
set feedback on
set verify on
set HEADING on
btitle off
