--
--
--
--
--
--
-- EUL5.sql
-- This Script Creates the Functions required by the EUL5 Business Area and Workbooks
--
-- Updated By     	Comments						Date
-- -----------------    --------------------------------------------------  	------------
--  MJTAYLOR 		Upgraded to a v5 EUL					25/JAN/02				
--
--
--
--
--
--
--
-- This function gets a list of complex folders that a simple folder is used in.
--
--
create or replace function EUL5_GET_COMPLEX_FOLDER(SOBJ_ID in number, chk in boolean:=TRUE, fldrs in varchar2:='.')
return VARCHAR2 is
coname varchar2(2000);
--
--
objid		NUMBER;
objstr		VARCHAR2(2000):=fldrs;
chkid		NUMBER:=0;
chkstr		VARCHAR2(2000);
--
--
cursor COBJ is
  select od_obj_id_from
  from eul5_obj_deps                  
  where od_obj_id_to = SOBJ_ID;
--
--
begin
--
--
open COBJ;
loop
fetch COBJ into objid; 
exit when COBJ%NOTFOUND;
if COBJ%FOUND then
	chkstr:='.'||to_char(objid)||'.';
	chkid:=instr(objstr,chkstr,1,1);
	if chkid =0 then
		if length(objstr)+length(to_char(objid))>1998 then
			objstr:=objstr||'*.';
			exit;	
		else
			objstr:=objstr||to_char(objid)||'.';
			objstr:=EUL5_GET_COMPLEX_FOLDER(objid,FALSE,objstr);
		end if;
	end if;
end if;
end loop;
coname:=objstr;
close COBJ;
if chk = FALSE then
	return coname;
else
	coname:= rtrim(coname,'.');
	coname:= ltrim(coname,'.');
	return coname;
end if;
--
end EUL5_GET_COMPLEX_FOLDER;
/
--
--
-- This function returns a list of the simple folders that a complex folder is based upon
--
create or replace function EUL5_GET_SIMPLE_FOLDER(COBJ_ID in number, chk in boolean:=TRUE, fldrs in varchar2:='.')
return VARCHAR2 is soname varchar2(2000);
--
--
objid		NUMBER;
objtyp		VARCHAR2(20);
chkid		NUMBER:=0;
chkstr		VARCHAR2(2000);
objstr		VARCHAR2(2000):=fldrs;
--
--
--
cursor SOBJ is
  select  od_obj_id_to, obj_type
  from eul5_obj_deps,
         eul5_objs
  where eul5_objs.obj_id=EUL5_obj_deps.od_obj_id_to
  and od_obj_id_from = COBJ_ID;
--
--
begin
--
--
open SOBJ;
loop
fetch SOBJ into objid, objtyp; 
exit when SOBJ%NOTFOUND;
if SOBJ%FOUND then
	chkstr:='.'||to_char(objid)||'.';
	chkid:=instr(objstr,chkstr,1,1);
	if chkid =0 then
		if length(objstr)+length(to_char(objid))>1998 then
			objstr:=objstr||'*.';
			exit;
		else
			objstr:=objstr||to_char(objid)||'.';
			objstr:=EUL5_GET_SIMPLE_FOLDER(objid,FALSE,objstr);
		end if;
	end if;
end if;
end loop;
soname:=objstr;
close SOBJ;
if  chk = FALSE then
	return soname;
else
	soname:= rtrim(soname,'.');
	soname:= ltrim(soname,'.');
	return soname;
end if;
--
--
--
--
end EUL5_GET_SIMPLE_FOLDER;
/
--
-- 
-- This function gets a the base item ID that it relates too.
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_OBJECT(EXPID IN NUMBER,CHK IN BOOLEAN:=TRUE)
RETURN VARCHAR2 IS
DB_ITEM VARCHAR2(2000);
--
--
CIDEXP		NUMBER;
EXPTYPE 	VARCHAR2(10);
OBJNAME		VARCHAR2(2000);
OBJTYPE		VARCHAR2(10);
OBJITM		VARCHAR2(200);
CNTR		NUMBER:=0;
--
--
-- This cursor finds out if the item is a complex item (ie. dependant on another item)
-- 
CURSOR EXPOBJ IS
	SELECT CID_EXP_ID
	FROM EUL5_EXP_DEPS, EUL5_EXPRESSIONS
	WHERE EUL5_EXP_DEPS.CD_EXP_ID = EXPID
	AND CID_EXP_ID IS NOT NULL
	AND EUL5_EXP_DEPS.CID_EXP_ID = EUL5_EXPRESSIONS.EXP_ID;
--
--
-- This cursor looks to the dependant item to see if it is also based on another dependant item
--
CURSOR GET_EXP_TYPE IS
	SELECT EXP_TYPE
 	FROM EUL5_EXPRESSIONS
	WHERE EXP_ID=CIDEXP;
--
--
-- This cursor finally gets the database object the item is based upon
--
CURSOR GET_DB_ITEM IS
	SELECT OBJ_EXT_OWNER||'.'||SOBJ_EXT_TABLE||'.', IT_EXT_COLUMN, OBJ_TYPE
	FROM EUL5_EXPRESSIONS, EUL5_OBJS
	WHERE EUL5_OBJS.OBJ_ID=EUL5_EXPRESSIONS.IT_OBJ_ID
	AND EXP_ID = CIDEXP;
--
--
--
BEGIN
--
OPEN EXPOBJ;
LOOP
CNTR:=CNTR+1;
FETCH EXPOBJ INTO CIDEXP;
IF EXPOBJ%NOTFOUND THEN
	IF CHK=TRUE THEN
		IF CNTR=1 THEN
			CIDEXP:=EXPID;
			OPEN GET_EXP_TYPE;
			FETCH GET_EXP_TYPE INTO EXPTYPE;
				IF EXPTYPE <> 'CO' THEN
					IF CHK=TRUE THEN
						OBJNAME:='This item is not based on a database column';
						DB_ITEM:=OBJNAME;
						RETURN DB_ITEM;
					END IF;
				END IF;
			CLOSE GET_EXP_TYPE;
		ELSE
			EXIT;
		END IF;
	ELSE
		EXIT;
	END IF; 
END IF;
OPEN GET_EXP_TYPE;
	FETCH GET_EXP_TYPE INTO EXPTYPE;
	IF EXPTYPE ='CI' THEN
			OBJNAME := EUL5_GET_OBJECT(CIDEXP,FALSE);
			IF LENGTH(OBJNAME)+ LENGTH(DB_ITEM)>1999 THEN
				DB_ITEM:=DB_ITEM||'*';
				RETURN DB_ITEM;
			ELSE
				DB_ITEM := DB_ITEM||OBJNAME;
			END IF;
	ELSE	
		OPEN GET_DB_ITEM;
		FETCH GET_DB_ITEM INTO OBJNAME,OBJITM,OBJTYPE;
		IF OBJTYPE='CUO' THEN
			DB_ITEM:='Custom SQL Item - '||OBJITM;
		ELSE
			DB_ITEM:=chr(10)||OBJNAME||OBJITM;
		END IF;
		CLOSE GET_DB_ITEM;
	END IF;
CLOSE GET_EXP_TYPE;
END LOOP;
CLOSE EXPOBJ;
IF CHK=TRUE THEN
DB_ITEM:=LTRIM(DB_ITEM,chr(10));
END IF;
RETURN DB_ITEM;
END EUL5_GET_OBJECT;
/	
--
--
--
--
--
--
--
--
--
--
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_ITEM(EXPID IN NUMBER, CHK IN BOOLEAN:=TRUE)
RETURN VARCHAR2 IS
DEP_ITEM VARCHAR2(2000);
--
--
CIDEXP		NUMBER;
EXPTYPE 	VARCHAR2(10);
OBJNAME		VARCHAR2(2000);
EXPNAME		VARCHAR2(200);
OBJTYPE		VARCHAR2(10);
CNTR		NUMBER:=0;
--
--
-- This cursor finds out if the item is a complex item (ie. dependant on another item)
-- 
CURSOR EXPOBJ IS
	SELECT CID_EXP_ID
	FROM EUL5_EXP_DEPS, EUL5_EXPRESSIONS
	WHERE EUL5_EXP_DEPS.CD_EXP_ID = EXPID
	AND CID_EXP_ID IS NOT NULL
	AND EUL5_EXP_DEPS.CID_EXP_ID = EUL5_EXPRESSIONS.EXP_ID;
--
--
-- This cursor looks to the dependant item to see if it is also based on another dependant item
--
CURSOR GET_EXP_TYPE IS
	SELECT EXP_TYPE
 	FROM EUL5_EXPRESSIONS
	WHERE EXP_ID=CIDEXP;
--
--
--
--
CURSOR GET_EXP_NAME IS
	SELECT OBJ_NAME,EXP_NAME
 	FROM EUL5_EXPRESSIONS, EUL5_OBJS
	WHERE EUL5_OBJS.OBJ_ID=EUL5_EXPRESSIONS.IT_OBJ_ID
	AND EXP_ID=CIDEXP;
--
--
BEGIN
--
OPEN EXPOBJ;
LOOP
CNTR:=CNTR+1;
FETCH EXPOBJ INTO CIDEXP;
IF EXPOBJ%NOTFOUND THEN
	IF CHK=TRUE THEN
		IF CNTR=1 THEN
			CIDEXP:=EXPID;
			OPEN GET_EXP_TYPE;
			FETCH GET_EXP_TYPE INTO EXPTYPE;
				IF EXPTYPE <> 'CO' THEN
					IF CHK=TRUE THEN
						OBJNAME:='';
						DEP_ITEM:=OBJNAME;
						RETURN DEP_ITEM;
					END IF;
				END IF;
			CLOSE GET_EXP_TYPE;
		ELSE
			EXIT;
		END IF;
	ELSE
		EXIT;
	END IF; 
END IF;
OPEN GET_EXP_TYPE;
	FETCH GET_EXP_TYPE INTO EXPTYPE;
	IF EXPTYPE ='CI' THEN
			OBJNAME := EUL5_GET_ITEM(CIDEXP,FALSE);
			IF LENGTH(OBJNAME)+ LENGTH(DEP_ITEM)>1999 THEN
				DEP_ITEM:=DEP_ITEM||'*';
				RETURN DEP_ITEM;
			ELSE
				DEP_ITEM := DEP_ITEM||OBJNAME;
			END IF;
	ELSE	
		OPEN GET_EXP_NAME;
		FETCH GET_EXP_NAME INTO OBJNAME,EXPNAME;
			DEP_ITEM:=chr(10)||OBJNAME||'.'||EXPNAME;
		CLOSE GET_EXP_NAME;
	END IF;
CLOSE GET_EXP_TYPE;
END LOOP;
CLOSE EXPOBJ;
IF CHK=TRUE THEN
DEP_ITEM:=LTRIM(DEP_ITEM,chr(10));
END IF;
RETURN DEP_ITEM;
END EUL5_GET_ITEM;
--
/	
--
--
--
--
--
--
--
--
--
-- THIS IS USED IN HIERARCHIES SHEET It Orders the item rows in the hierarchy so that they can be displayed correctly
--
--
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_HIERORD(HIID IN NUMBER, 
					   HNID IN NUMBER, 
					   PARENT IN NUMBER:=1, 
					   ORDNO IN NUMBER:=0 )
RETURN NUMBER IS
HIERORD NUMBER;
--
--
TOPID	NUMBER;
CHILD	NUMBER:=PARENT;
TREEID	NUMBER;
IDNUM	NUMBER:=0; 
--
--
CURSOR GET_HIERTOP IS
	SELECT B.HN_ID
	FROM	EUL5_HIERARCHIES A, 
		EUL5_HI_NODES B,
		EUL5_HI_SEGMENTS C
	WHERE	A.HI_ID=B.HN_HI_ID
	AND	B.HN_ID=C.IHS_HN_ID_CHILD(+)
	AND	A.HI_ID=HIID
	AND	C.IHS_HI_ID IS NULL;
--
--	
--
CURSOR GET_TREE IS
	SELECT IHS_HN_ID_CHILD
	FROM EUL5_HI_SEGMENTS
	WHERE IHS_HN_ID_PARENT=CHILD
	AND IHS_HI_ID=HIID;
--
--
BEGIN
--
IF CHILD=1 THEN
	OPEN GET_HIERTOP;
	FETCH GET_HIERTOP INTO TOPID;	
	IDNUM:=IDNUM+1;
		IF TOPID=HNID THEN 
		   HIERORD:=IDNUM;
		   RETURN HIERORD;
		END IF;
	CHILD:=TOPID;	
	CLOSE GET_HIERTOP;
--
--
	OPEN GET_TREE;
	LOOP
	FETCH GET_TREE INTO TREEID;
	EXIT WHEN GET_TREE%NOTFOUND;
	IDNUM:=IDNUM+1;
		IF TREEID=HNID THEN
		   HIERORD:=IDNUM;
		   RETURN HIERORD;
		   EXIT;
		ELSE
		   IDNUM:=EUL5_GET_HIERORD(HIID,HNID,TREEID,IDNUM);
			IF CEIL(IDNUM)<>IDNUM THEN
			   HIERORD:=FLOOR(IDNUM);
			   RETURN HIERORD;
			   EXIT;
			   CLOSE GET_TREE;
			END IF;
		END IF;
	END LOOP;
ELSE
   IDNUM:=ORDNO;
   OPEN GET_TREE;
   LOOP
   FETCH GET_TREE INTO TREEID;
   EXIT WHEN GET_TREE%NOTFOUND;
   IDNUM:=IDNUM+1;
	IF TREEID=HNID THEN
	   IDNUM:=IDNUM+0.1;
	   HIERORD:=IDNUM;
	   RETURN HIERORD;
	   EXIT;
	   CLOSE GET_TREE;
	ELSE
	   IDNUM:=EUL5_GET_HIERORD(HIID,HNID,TREEID,IDNUM);
			IF CEIL(IDNUM)<>IDNUM THEN
			   HIERORD:=IDNUM;
			   RETURN HIERORD;
			   EXIT;
			   CLOSE GET_TREE;
			END IF;
--	   HIERORD:=IDNUM;
--	   RETURN HIERORD;
	END IF;
   END LOOP;
   HIERORD:=IDNUM;
   CLOSE GET_TREE;
   RETURN HIERORD;
END IF;
CLOSE GET_TREE;
--
HIERORD:=-1;
RETURN HIERORD;
END EUL5_GET_HIERORD;
/
--
--
--
--
--
--
--
--
--
--
-- This gets the level of each item in a hierarchy
--
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_HIERLVL(HIID IN NUMBER,
					   HNID IN NUMBER,
					   LVLNO IN NUMBER:=0)
RETURN NUMBER IS
HIERLVL NUMBER;
--
--
--
LVL	NUMBER;
PARENT	NUMBER;
--
--
--
CURSOR HIER_LEVEL IS 
	SELECT IHS_HN_ID_PARENT
	FROM EUL5_HI_SEGMENTS
	WHERE IHS_HI_ID=HIID
	AND IHS_HN_ID_CHILD=HNID;
--
--
BEGIN
LVL:=LVLNO;
LVL:=LVL+1; 
OPEN HIER_LEVEL;
FETCH HIER_LEVEL INTO PARENT;
IF HIER_LEVEL%NOTFOUND THEN
	HIERLVL:=LVL;
	RETURN HIERLVL;
	CLOSE HIER_LEVEL;
ELSE
	LVL:=EUL5_GET_HIERLVL(HIID,PARENT,LVL);
END IF;
HIERLVL:=LVL;
RETURN HIERLVL;
CLOSE HIER_LEVEL;
END EUL5_GET_HIERLVL;
/
--
-- This function gets the date last analysed
--
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_ADATE(OWNER_NAME IN VARCHAR2, TAB_NAME IN VARCHAR2)
RETURN VARCHAR2 IS
LAST_ANALYZED VARCHAR2(12);
--
--
--
--
LA_DATE  VARCHAR2(12):='*';

--
--
--
BEGIN
--
LAST_ANALYZED:='**';
--
	BEGIN
--
	SELECT DISTINCT TO_CHAR(TO_DATE(LAST_ANALYZED),'DD-MON-YYYY') INTO LA_DATE
		FROM ALL_TAB_COLUMNS
		WHERE  OWNER=OWNER_NAME
		AND TABLE_NAME=TAB_NAME;
--


	EXCEPTION
		WHEN OTHERS THEN
		LA_DATE:='Unknown';
	END;
--
IF LA_DATE IS NULL THEN 
	LA_DATE:='Not Analyzed';
END IF;
--
LAST_ANALYZED:=LA_DATE;
RETURN LAST_ANALYZED;
--
--
END EUL5_GET_ADATE;
/
--
--
--
-- This function returns a list of the simple folders that a complex folder is based upon
--
-- MJT  25-JAN-02 Fix for bug 1964856 added.
--
--
create or replace function EUL5_GET_ANALYZED(COBJ_ID in number, DATE_OR_TAB in varchar2, chk in boolean:=TRUE, fldrs in varchar2:=',')
return VARCHAR2 is soname varchar2(2000);
--
--
objid		NUMBER:=NULL;
objtyp		VARCHAR2(10);
objowner	VARCHAR2(64);
objtable	VARCHAR2(64);
chkid		NUMBER:=0;
rcrds		BOOLEAN:=TRUE;
chkstr		VARCHAR2(2000);
objstr		VARCHAR2(2000):=fldrs;
datestr		VARCHAR2(2000):=null;
endown		NUMBER;
endtab		NUMBER;
stpt		NUMBER;	
sze		NUMBER;
--
--
--
cursor COBJ is
  select  od_obj_id_to, obj_type, obj_ext_owner, sobj_ext_table
  from EUL5_obj_deps, EUL5_objs
  where EUL5_objs.obj_id=EUL5_obj_deps.od_obj_id_to
  and od_obj_id_from = COBJ_ID;
--
cursor SOBJ is
  select  obj_ext_owner, sobj_ext_table
  from  EUL5_objs
  where obj_id = COBJ_ID
  and obj_type = 'SOBJ';
--
begin
--
--
open COBJ;
loop
fetch COBJ into objid, objtyp, objowner, objtable; 
exit when COBJ%NOTFOUND;
if COBJ%FOUND then
	rcrds:=FALSE;
	chkstr:=objowner||'.'||objtable;
	chkid:=instr(objstr,chkstr,1,1);
	if chkid =0 then
		if length(objstr)+length(to_char(nvl(objid,0)))>1997 then
			objstr:=substr(objstr,1,1998)||'*'||CHR(10);
			exit;
		else
			if objtyp='SOBJ' then
				objstr:=objstr||objowner||'.'||objtable||chr(10);
			end if;
			objstr:=EUL5_GET_ANALYZED(objid,'T',FALSE,objstr);
		end if;
	end if;
end if;
end loop;
close COBJ;
 if  chk = FALSE then
	soname:=objstr;
 elsif	rcrds=FALSE then
		if DATE_OR_TAB='T' then
			soname:=objstr;
			soname:= rtrim(soname,CHR(10));
			soname:= ltrim(soname,',');
		else	
		
			soname:=objstr;			
			objstr:=ltrim(objstr,',');
			sze:=length(objstr);
			stpt:=1;
			if sze > 3 then
				loop
					endown:=instr(objstr,'.',stpt,1);
					endtab:=instr(objstr,chr(10),stpt,1)-1;
					datestr:=datestr||EUL5_GET_ADATE(substr(objstr,stpt,(endown-stpt)),substr(objstr,endown+1,(endtab-endown)))||chr(10);	
					stpt:=endtab+2;
  	                    	        exit when stpt+2 >= sze;
				end loop;
			end if;
			datestr:= rtrim(datestr,CHR(10));
			soname:=nvl(datestr,'Unknown');
		end if;
 elsif	rcrds=TRUE then
open SOBJ;
fetch SOBJ into objowner, objtable; 
	if SOBJ%FOUND then 
		objstr:=','||objowner||'.'||objtable||chr(10);
		soname:=objstr;
		soname:= rtrim(soname,CHR(10));
		soname:= ltrim(soname,',');
	else
		soname:='Unknown';
	end if;
 close SOBJ;
 if DATE_OR_TAB<>'T' then
 		if soname='Unknown' then
 			soname:='Unknown';
		else
			objstr:=ltrim(objstr,',');
			sze:=length(objstr);
			stpt:=1;
			if sze > 3 then
				loop
					endown:=instr(objstr,'.',stpt,1);
					endtab:=instr(objstr,chr(10),stpt,1)-1;
					datestr:=datestr||EUL5_GET_ADATE(substr(objstr,stpt,(endown-stpt)),substr(objstr,endown+1,(endtab-endown)))||chr(10);	
					stpt:=endtab+2;
					exit when stpt+2 >= sze;
				end loop;
			end if;
			datestr:= rtrim(datestr,CHR(10));
			soname:=nvl(datestr,'Unknown');
		end if;
	end if;
end if;
return soname;
--
end EUL5_GET_ANALYZED;
/
--
--
--
--
-- Returns a comma separated list of item ids from a raw bitmap-- 
-- MJT  29/10/97 created 
--
-- Returns a comma separated list of folder names from a comma separated list of object_ids.
--
-- AO	01-Mar-97 Added exception handler
-- MJT  03-Mar-97 Added string size execption handler
-- MJT  10-Mar-97 Added a space after the comma in the folder separator
-- MJT  12-APR-00 Fix for bug 996210 added.
--
create or replace function EUL5_GET_OBJECT_NAME(USEKEY in VARCHAR2, TYPEKEY in varchar2)
return VARCHAR2 is
oname varchar2(2000);
--
-- Type Key is either 'F' for folder or 'I' for item.
--
--
startpt 	NUMBER :=1;
endpt		NUMBER :=length(USEKEY);
pos		NUMBER :=1;
ctr		NUMBER :=0;
chklgth	NUMBER;
objid		NUMBER;
aggtype	NUMBER;
objname	VARCHAR2(100);
checkobjid  VARCHAR2(2000);
--
--
cursor folder is
  select obj_name
  from EUL5_objs                   
  where obj_id = objid;
--  exception when others then objname := '*';
--  end;
--
cursor item is
 select exp_name 
 from EUL5_expressions	
 where exp_id = objid;
-- exception when others then objname := '*';
-- end;
--
begin
--
-- This bit works out the id's position in the string and moves down the string by looping
--
while pos <> 0 loop
  aggtype:=0;
  ctr:=ctr+1;
  pos:=instr(USEKEY,'.',1,ctr);
begin
if pos=0 then
   if upper(TYPEKEY)='F' then
    checkobjid:=UPPER(substr(USEKEY,startpt,(endpt-startpt+1)));
    if substr(checkobjid,1,1)='S' then
     objid:=-1;
    else
     objid:=to_number(translate(checkobjid,'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ','0123456789'));
    end if;
   else 
    objid:= UPPER(substr(USEKEY,startpt,(endpt-startpt-1)));
    aggtype:=to_number(substr(USEKEY,endpt,1));
  end if;
else
   if  upper(TYPEKEY)='F' then
     checkobjid:= upper(substr(USEKEY,startpt,(pos-startpt)));
     if substr(checkobjid,1,1)='S' then
	objid:=-1;
     else
	objid:=to_number(translate(checkobjid,'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ','0123456789'));
     end if;
   else 
     objid:= to_number(substr(USEKEY,startpt,(pos-startpt-2)));
     aggtype:=  to_number(substr(USEKEY,pos-1,1));
   end if;
  startpt:=pos+1;
end if;
exception when others then objid:=-1;
end;
--
--
if upper(TYPEKEY) ='F' then
open folder;
fetch folder into objname;
-- exception when others then objname := '*';
-- end;
close folder;
end if;
--
--
if upper(TYPEKEY)='I' then
open item;
fetch item into objname;
close item;
-- exception when others then objname := '*';
-- end;
end if;
--
-- This bit builds up the string of folder names if it exceeds
-- 2000 chars it stops then places an '*' at the end.
--
if ctr=1 then
 if aggtype=0 then
 oname:=objname;
 elsif aggtype=1 then oname:=objname||' SUM'; 
 elsif aggtype=2 then oname:=objname||' AVG';
 elsif aggtype=3 then oname:=objname||' COUNT';
 elsif aggtype=4 then oname:=objname||' MAX';
 elsif aggtype=5 then oname:=objname||' MIN';
 else oname:=objname;
 end if;
else
    if aggtype=0 then
      chklgth:= length(oname)+length(objname)+2;
    elsif aggtype=1 then  chklgth:= length(oname)+length(objname)+6;
    elsif aggtype=2 then  chklgth:= length(oname)+length(objname)+6;
    elsif aggtype=3 then  chklgth:= length(oname)+length(objname)+8;
    elsif aggtype=4 then  chklgth:= length(oname)+length(objname)+6;
    elsif aggtype=5 then  chklgth:= length(oname)+length(objname)+6;
    else chklgth:= length(oname)+length(objname)+2;
    end if;
    if chklgth > 1999 then
        oname:=oname||'*';
        exit;
    else	
        if aggtype = 0 then
		if oname is not null then
	        oname:=oname||','||CHR(10)||objname;
		else
		  oname:=objname;
		end if;
        elsif aggtype=1 then oname:=oname||','||CHR(10)||objname||' SUM'; 
        elsif aggtype=2 then oname:=oname||','||CHR(10)||objname||' AVG';
        elsif aggtype=3 then oname:=oname||','||CHR(10)||objname||' COUNT';
        elsif aggtype=4 then oname:=oname||','||CHR(10)||objname||' MAX';
        elsif aggtype=5 then oname:=oname||','||CHR(10)||objname||' MIN';
        else  
		if objname is not null then
	 	 oname:=oname||','||CHR(10)||objname;
		else
		  oname:=objname;
		end if;
        end if;
   end if;
end if;
end loop;
--
--
return oname;
--
end EUL5_GET_OBJECT_NAME;
/
--
-- Returns a comma separated list of item ids from a raw bitmap-- 
-- MJT  29/10/97 created 
-- Inputs are QS_ID on the eul qpp statsitics table (id)
--
create or replace function EUL5_GET_ITEM_NAME(QSID in NUMBER)
return VARCHAR2 is
Itmid VARCHAR2(2000):=null;
--
startpt 		BINARY_INTEGER :=1;
BMP 		LONG RAW;
pos		BINARY_INTEGER :=0;
ctr		BINARY_INTEGER :=0;
chklgth		BINARY_INTEGER;
hexstring	VARCHAR2(10);
hexid		BINARY_INTEGER :=0;
decnibble1	NUMBER;
decnibble2	BINARY_INTEGER;
decnibble3	BINARY_INTEGER;
decnibble4	BINARY_INTEGER;
decnibble5	BINARY_INTEGER;
decnibble6	BINARY_INTEGER;
decnibble7	BINARY_INTEGER;
decnibble8	BINARY_INTEGER;
decnibble9	BINARY_INTEGER;
decnibble10 	BINARY_INTEGER;
hexchar		VARCHAR2(1);
expid		NUMBER;
aggtype		BINARY_INTEGER;
nibblezero	BOOLEAN;
--
-- Occasionally, due to a bug, the first 5 bytes of the string are not always populated with id of
-- the item so rather than go all the way down the string looking a every 5 bytes until it reaches
-- the end (a slow process) I count the number of empy stings I have found so far and when it 
-- reaches the the value held in 'noemptyblocks'  it moves on to the next string
--
noemptyblks  	BINARY_INTEGER:=10;
--
-- 
--
--
-- This cursor finds the Dimension values
--
cursor dbmp is
select qs_dbmp0||qs_dbmp1||qs_dbmp2||qs_dbmp3||qs_dbmp4||qs_dbmp5||qs_dbmp6||qs_dbmp7 from EUL5_qpp_stats
where qs_id = QSID;
--
--
-- This cursor finds the Measure values
--
cursor mbmp is
select  qs_mbmp0||qs_mbmp1||qs_mbmp2||qs_mbmp3||qs_mbmp4||qs_mbmp5||qs_mbmp6||qs_mbmp7 
from EUL5_qpp_stats
where qs_id = QSID;
--
--
begin
--
-- Loop Twice First loop deals with the Dimensions values the scond with the Measure Values 
--
for itype in 1..2 loop
if itype = 1 then
open dbmp;
else
open mbmp;
end if;
hexid:=0;
--
--
--This bit takes a five byte chunk in the string.
-- It then loops until it reaches the end of the string or it find no more values
--
while hexid <> noemptyblks loop
if itype = 1 then
fetch  dbmp into BMP;
else
fetch mbmp into BMP; 
end if;
 ctr:=ctr+1;
  pos:=pos+10; 
  if pos=4090 then
  hexid:= noemptyblks;
  startpt:=1;
  pos:=0;
 else
  hexstring:=nvl(substr(rawtohex(BMP),startpt,10),'0000000000');
 	if 
		hexstring = '0000000000' then 
		hexid:=hexid + 1;
		decnibble1:=0;
		decnibble2:=0;
		decnibble3:=0;
		decnibble4:=0;
		decnibble5:=0;
		decnibble6:=0;
		decnibble7:=0;
		decnibble8:=0;
		decnibble9:=0;
		decnibble10:=0;
		nibblezero:= TRUE;
			if hexid = noemptyblks then
			startpt:=1;
			pos:=0;
			end if;
--
--
-- Converts Hex Nibble into Decimal value. 
--
	else
		nibblezero:=FALSE;	
		hexchar:=substr(rawtohex(BMP),startpt,1);
		if hexchar = '0' then decnibble1:=0;
		elsif hexchar ='A' then decnibble1:=10;		
		elsif hexchar ='B' then decnibble1:=11;
		elsif hexchar ='C' then decnibble1:=12;
		elsif hexchar ='D' then decnibble1:=13;
		elsif hexchar ='E' then decnibble1:=14;
		elsif hexchar ='F' then decnibble1:=15;
		else decnibble1:=to_number(hexchar);
		end if;
		hexchar:=substr(rawtohex(BMP),startpt+1,1); 
		if hexchar = '0' then decnibble2:=0;
		elsif hexchar ='A' then decnibble2:=10;
		elsif hexchar ='B' then decnibble2:=11;
		elsif hexchar ='C' then decnibble2:=12;
		elsif hexchar ='D' then decnibble2:=13;
		elsif hexchar ='E' then decnibble2:=14;
		elsif hexchar ='F' then decnibble2:=15;
		else decnibble2:=to_number(hexchar);
		end if;
		hexchar:=substr(rawtohex(BMP),startpt+2,1);
		if hexchar = '0' then decnibble3:=0;
		elsif hexchar ='A' then decnibble3:=10;
		elsif hexchar ='B' then decnibble3:=11;
		elsif hexchar ='C' then decnibble3:=12;
		elsif hexchar ='D' then decnibble3:=13;
		elsif hexchar ='E' then decnibble3:=14;
		elsif hexchar ='F' then decnibble3:=15;
		else decnibble3:=to_number(hexchar);
		end if;
		hexchar:= substr(rawtohex(BMP),startpt+3,1);
		if hexchar = '0' then decnibble4:=0;
		elsif  hexchar ='A' then decnibble4:=10;
		elsif hexchar ='B' then decnibble4:=11;
		elsif hexchar ='C' then decnibble4:=12;
		elsif hexchar ='D' then decnibble4:=13;
		elsif hexchar ='E' then decnibble4:=14;
		elsif hexchar ='F' then decnibble4:=15;
		else decnibble4:=to_number(hexchar);
		end if;
		hexchar :=substr(rawtohex(BMP),startpt+4,1);
		if hexchar = '0' then decnibble5:=0;
		elsif hexchar ='A' then decnibble5:=10;
		elsif hexchar ='B' then decnibble5:=11;
		elsif hexchar ='C' then decnibble5:=12;
		elsif hexchar ='D' then decnibble5:=13;
		elsif hexchar ='E' then decnibble5:=14;
		elsif hexchar ='F' then decnibble5:=15;
		else decnibble5:=to_number(hexchar );
		end if;
		hexchar := substr(rawtohex(BMP),startpt+5,1);
		if hexchar = '0' then decnibble6:=0;
		elsif hexchar ='A' then decnibble6:=10;
		elsif hexchar='B' then decnibble6:=11;
		elsif hexchar='C' then decnibble6:=12;
		elsif hexchar='D' then decnibble6:=13;
		elsif hexchar='E' then decnibble6:=14;
		elsif hexchar='F' then decnibble6:=15;
		else decnibble6:=to_number(hexchar);
		end if;
		hexchar := substr(rawtohex(BMP),startpt+6,1);
		if hexchar = '0' then decnibble7:=0;
		elsif hexchar ='A' then decnibble7:=10;
		elsif hexchar='B' then decnibble7:=11;
		elsif hexchar='C' then decnibble7:=12;
		elsif hexchar='D' then decnibble7:=13;
		elsif hexchar='E' then decnibble7:=14;
		elsif hexchar='F' then decnibble7:=15;
		else decnibble7:=to_number(hexchar);
		end if;
		hexchar :=substr(rawtohex(BMP),startpt+7,1);
		if hexchar = '0' then decnibble8:=0;
		elsif hexchar ='A' then decnibble8:=10;
		elsif hexchar='B' then decnibble8:=11;
		elsif hexchar='C' then decnibble8:=12;
		elsif hexchar='D' then decnibble8:=13;
		elsif hexchar='E' then decnibble8:=14;
		elsif hexchar='F' then decnibble8:=15;
		else decnibble8:=to_number(hexchar);
		end if;
		hexchar:= substr(rawtohex(BMP),startpt+8,1);
		if hexchar = '0' then decnibble9:=0;
		elsif hexchar ='A' then decnibble9:=10;
		elsif hexchar='B' then decnibble9:=11;
		elsif hexchar='C' then decnibble9:=12;
		elsif hexchar='D' then decnibble9:=13;
		elsif hexchar='E' then decnibble9:=14;
		elsif hexchar='F' then decnibble9:=15;
		else decnibble9:=to_number(hexchar);
		end if;
	if itype = 2 then
		hexchar :=substr(rawtohex(BMP),startpt+9,1);
		if hexchar = '0' then decnibble10:=0;
		elsif hexchar ='A' then decnibble10:=10;
		elsif hexchar='B' then decnibble10:=11;
		elsif hexchar='C' then decnibble10:=12;
		elsif hexchar='D' then decnibble10:=13;
		elsif hexchar='E' then decnibble10:=14;
		elsif hexchar='F' then decnibble10:=15;
		else decnibble10:=to_number(hexchar);
		end if;
	end if;
--
--
-- Off set the nibble by One Byte 
-- Then calculate the Item id
--
if nibblezero = FALSE then
		decnibble1:=decnibble1*2;
		if decnibble2 > 7 then
		decnibble1:=decnibble1+1;
		decnibble2:=decnibble2-8;
		end if;
	decnibble1:=decnibble1 * 268435456;
	decnibble2:=decnibble2 * 2;
		if decnibble3 > 7 then
		decnibble2:=decnibble2+1;
		decnibble3:=decnibble3-8;
		end if;
	decnibble2:=decnibble2 * 16777216;
	decnibble3:=decnibble3*2;
		if decnibble4 > 7 then
		decnibble3:=decnibble3+1;
		decnibble4:=decnibble4-8;
		end if;
	decnibble3:=decnibble3 * 1048576;
	decnibble4:=decnibble4*2;
		if decnibble5 > 7 then
		decnibble4:=decnibble4+1;
		decnibble5:=decnibble5-8;
		end if;
	decnibble4:=decnibble4 * 65536;
	decnibble5:=decnibble5*2;
		if decnibble6 > 7 then
		decnibble5:=decnibble5+1;
		decnibble6:=decnibble6-8;
		end if;
	decnibble5:=decnibble5 * 4096;
	decnibble6:=decnibble6*2;
		if decnibble7 > 7 then
		decnibble6:=decnibble6+1;
		decnibble7:=decnibble7-8;
		end if;
	decnibble6:=decnibble6 * 256;
	decnibble7:=decnibble7*2;
		if decnibble8 > 7 then
		decnibble7:=decnibble7+1;
		decnibble8:=decnibble8-8;
		end if;
	decnibble7:=decnibble7 * 16;
	decnibble8:=decnibble8*2;
		if decnibble9 > 7 then
		decnibble8:=decnibble8+1;
		decnibble9:=decnibble9-8;
		end if;
if itype=2 then
	if decnibble9>0 then
	decnibble9:=(decnibble9-2)*8;
	end if;	
	decnibble10:=decnibble9+(decnibble10/2);
end if;
expid:= decnibble1 + decnibble2 + decnibble3 + decnibble4 + decnibble5 + decnibble6 + decnibble7 + decnibble8;
end if;
end if;
end if;
startpt:=pos+1;
--
--
-- Build up the string of item ids used in the query
--
if nibblezero = FALSE then
   if itype =1 then
          if nvl(length(itmid),0)=0 then
          itmid:=to_char(expid)||',0';
   else
          chklgth:= length(itmid)+length(to_char(expid))+4;
                 if chklgth > 1998 then
                   itmid:=itmid||'*';
                   exit;
                 else	
                   itmid:=itmid||'.'||to_char(expid)||',0';
                 end if;
   end if;
   else
   chklgth:= nvl(length(itmid),0)+length(to_char(expid))+4;
                 if chklgth > 1998 then
                   itmid:=itmid||'*';
                   exit;
                 elsif chklgth =length(to_char(expid))+4 then
		   itmid:=to_char(expid)||','||to_char(decnibble10);
		 else
                   itmid:=itmid||'.'||to_char(expid)||','||to_char(decnibble10);
                 end if;
   end if;
end if;
--
-- Go get the next five bytes in the string
--
end loop;
--
--
--  Close the cursor on the first loop for the dimensions 
--  on the second for the Measures	
--
if itype = 1 then
close dbmp;
else
close mbmp;
end if;
--
end loop;
--
return itmid;
-- return hexstring;
--
end EUL5_GET_ITEM_NAME;
/
--
--
-- This Function finds out if this is an apps EUL (If it Returns 1 = Yes)
--
CREATE OR REPLACE FUNCTION EUL5_GET_ISITAPPS_EUL
RETURN NUMBER IS
ISITAPPS NUMBER;
--
APPS  NUMBER:=0;
--
BEGIN
--
ISITAPPS:=0;
--
	BEGIN
--
	SELECT COUNT(*) INTO ISITAPPS
		FROM EUL5_APP_PARAMS
		WHERE  APP_TYPE='SP'
		AND APP_ID=1016;
--
	EXCEPTION
		WHEN OTHERS THEN
		ISITAPPS:=0;
	END;
--
RETURN ISITAPPS;
--
--
END EUL5_GET_ISITAPPS_EUL;
/
--
--
--
-- This Function finds the Username or Responsibliity if this is an apps EUL.
--
--
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_APPS_USERRESP(apps_id in varchar2,User_Resp in Varchar2:='U') RETURN VARCHAR2 IS 
APPS_USER VARCHAR2(100);
BEGIN
APPS_USER:='EUL5_APPS.sql has not been run.'||CHR(10)||'When you run the script ensure you are the EUL owner.';
RETURN APPS_USER;
END EUL5_GET_APPS_USERRESP;
/
--
--
--
-- This Function finds the URL segment variable required to build up the Lineage URL.
--
--
CREATE OR REPLACE FUNCTION EUL5_GET_LINURL(SAPP_ID IN NUMBER) 
RETURN VARCHAR2 IS 
LINURL_SEG VARCHAR2(240);
--
--
URL_SEG	VARCHAR2(240);
--
--
CURSOR LINURL IS
	SELECT SP_VALUE
 	FROM EUL5_APP_PARAMS
	WHERE APP_ID=SAPP_ID;
--
--
BEGIN
OPEN LINURL;
FETCH LINURL INTO URL_SEG;
CLOSE LINURL;
--
LINURL_SEG:= URL_SEG;
RETURN LINURL_SEG;
END EUL5_GET_LINURL;
/
--
-- Here are the grants required for an Apps EUL to fix bug 972213
--
--
grant execute on EUL5_GET_COMPLEX_FOLDER to public
/
grant execute on EUL5_GET_SIMPLE_FOLDER to public
/
grant execute on EUL5_GET_OBJECT to public
/
grant execute on EUL5_GET_ITEM to public
/
grant execute on EUL5_GET_HIERORD to public
/
grant execute on EUL5_GET_HIERLVL to public
/
grant execute on EUL5_GET_ADATE to public
/
grant execute on EUL5_GET_ANALYZED to public
/
grant execute on EUL5_GET_OBJECT_NAME to public
/
grant execute on EUL5_GET_ITEM_NAME to public
/
grant execute on EUL5_GET_APPS_USERRESP to public
/
grant execute on EUL5_GET_ISITAPPS_EUL to public
/
grant execute on EUL5_GET_LINURL to public
/
