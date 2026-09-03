-- This SQL script contains template Create Table
-- statements that can be used as a starting point
-- in creating a Discoverer End User Layer Gateway.

create table EUL_GW_SCHEMAS
(
	s_schem_name        	varchar2(64) not null,
	s_qual_name     		varchar2(64)
);

create table EUL_GW_OBJS
(
	o_s_schem_name         	varchar2(64) not null,
	o_obj_name           	varchar2(64) not null,
	o_obj_type           	varchar2(13) not null,
	o_hidden                varchar2(1) not null,
	o_table_name            varchar2(64) null,
	o_disp_name          	varchar2(100),
	o_description           varchar2(240),
	o_summ_rfrsh_date  	date,
	o_summ_validity      	varchar2(1)
);

create table EUL_GW_COLS
(
	c_o_schem_name            	varchar2(64) not null,
	c_o_obj_name            	varchar2(64) not null,
	c_col_name              	varchar2(64) not null,
	c_sql_derivation           	varchar2(240),
	c_datatype                 	varchar2(70) not null,
	c_null_indicator           	varchar2(10) not null,
	c_hidden                   	varchar2(1) not null,
	c_length                   	number(22),
	c_decimal_places           	number(22),
	c_disp_name             	varchar2(100),
	c_heading                  	varchar2(240),
	c_description              	varchar2(240),
	c_disp_seq         		number(22),
	c_disp_length           	number(22),
	c_case_display             	varchar2(10),
	c_case_storage            	varchar2(10),
	c_alignment                	varchar2(10),
	c_format_mask              	varchar2(100),
	c_c_lov_schem_name        	varchar2(64),
	c_c_lov_obj_name        	varchar2(64),
	c_c_lov_col_name        	varchar2(64),
	c_def_rollup_func  		varchar2(70),
	c_disp_null_value       	varchar2(240),
	c_ord_clause_pos    		number(22),
	c_ord_direction          	varchar2(10),
	c_placement                	varchar2(10),
	c_content_type             	varchar2(100)
);

create table EUL_GW_FILTERS
(
	f_o_schem_name         		varchar2(64) not null,
	f_o_obj_name         		varchar2(64) not null,
	f_disp_name          		varchar2(100) not null,
	f_mandatory_flag        	varchar2(1) not null,
	f_description           	varchar2(240),
	f_sql                   	varchar2(240)
);

create table eul_gw_uks
(
	uk_o_schem_name           	varchar2(64) not null,
	uk_o_obj_name           	varchar2(64) not null,
	uk_constr_name         		varchar2(64) not null,
	uk_disp_name            	varchar2(100),
	uk_prim_key_ind   		varchar2(1) not null,
	uk_description             	varchar2(240)
);

create table eul_gw_uk_cols
(
	ukc_uk_schem_name         	varchar2(64) not null,
	ukc_uk_obj_name         	varchar2(64) not null,
	ukc_uk_constr_name     		varchar2(64) not null,
	ukc_c_col_name          	varchar2(64) not null,
	ukc_sequence               	number(22) not null
);

create table eul_gw_fks
(
	fk_o_schem_name           	varchar2(64) not null,
	fk_o_obj_name           	varchar2(64) not null,
	fk_constr_name         		varchar2(64) not null,
	fk_one_to_one              	varchar2(1) not null,
	fk_ojoin_master       		varchar2(1) not null,
	fk_ojoin_detail       		varchar2(1) not null,
	fk_disp_name            	varchar2(100),
	fk_description             	varchar2(240),
	fk_rem_schem_name      		varchar2(64) not null,
	fk_rem_obj_name      		varchar2(64) not null,
	fk_rem_uk_name  			varchar2(64),
	fk_sql_predicate           	varchar2(240)
);

create table eul_gw_fk_cols
(
	fkc_fk_schem_name         	varchar2(64) not null,
	fkc_fk_obj_name         	varchar2(64) not null,
	fkc_fk_constr_name     		varchar2(64) not null,
	fkc_c_col_name          	varchar2(64) not null,
	fkc_sequence               	number(22) not null
);

create table eul_gw_obj_fk_usgs
(
	ofu_o_schem_name         	varchar2(64) not null,
	ofu_o_obj_name         		varchar2(64) not null,
	ofu_fk_schem_name        	varchar2(64) not null,
	ofu_fk_obj_name        		varchar2(64) not null,
	ofu_fk_constr_name    		varchar2(64) not null
);

-- End
