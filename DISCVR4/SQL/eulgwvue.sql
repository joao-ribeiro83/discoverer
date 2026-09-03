-- This SQL script contains template Create View
-- statements that can be used as a starting point
-- in creating a Discoverer End User Layer Gateway.
-- Executing the script as it is will not provide
-- a valid gateway. The SQL has to be modified to
-- appropriately map the view columns to the
-- metadata from which information is to be transferred
-- through the gateway.

CREATE OR REPLACE VIEW EUL_GW_SCHEMAS 
  	(s_schem_name, 
   	 s_qual_name)
AS SELECT 
	s_schem_name, 
   	s_qual_name
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_OBJS 
	(o_s_schem_name, 
	 o_obj_name, 
	 o_obj_type, 
	 o_hidden, 
	 o_table_name,
	 o_disp_name, 
	 o_description, 
	 o_summ_rfrsh_date, 
	 o_summ_validity)
AS SELECT
	 o_s_schem_name, 
	 o_obj_name, 
	 o_obj_type, 
	 o_hidden, 
	 o_table_name,
	 o_disp_name, 
	 o_description, 
	 o_summ_rfrsh_date, 
	 o_summ_validity
FROM	dual;

CREATE OR REPLACE VIEW EUL_GW_COLS 
	(c_o_schem_name,
	 c_o_obj_name, 
	 c_col_name,
	 c_sql_derivation,
	 c_datatype,
	 c_null_indicator, 
	 c_hidden,
	 c_length,
	 c_decimal_places,
	 c_disp_name,
	 c_heading, 
	 c_description,
	 c_disp_seq,
	 c_disp_length,
	 c_case_display, 
	 c_case_storage,
	 c_alignment,
	 c_format_mask,
	 c_c_lov_schem_name, 
	 c_c_lov_obj_name,
	 c_c_lov_col_name,
	 c_def_rollup_func, 
	 c_disp_null_value, 
	 c_ord_clause_pos,
	 c_ord_direction, 
	 c_placement,
	 c_content_type)
AS SELECT
	 c_o_schem_name,
	 c_o_obj_name, 
	 c_col_name,
	 c_sql_derivation,
	 c_datatype,
	 c_null_indicator, 
	 c_hidden,
	 c_length,
	 c_decimal_places,
	 c_disp_name,
	 c_heading, 
	 c_description,
	 c_disp_seq,
	 c_disp_length,
	 c_case_display, 
	 c_case_storage,
	 c_alignment,
	 c_format_mask,
	 c_c_lov_schem_name, 
	 c_c_lov_obj_name,
	 c_c_lov_col_name,
	 c_def_rollup_func, 
	 c_disp_null_value, 
	 c_ord_clause_pos,
	 c_ord_direction, 
	 c_placement,
	 c_content_type
FROM 	 dual;

CREATE OR REPLACE VIEW EUL_GW_FILTERS 
	(f_o_schem_name,
	 f_o_obj_name, 
	 f_disp_name,
	 f_mandatory_flag,
	 f_description,
	 f_sql)
AS SELECT
	 f_o_schem_name,
	 f_o_obj_name, 
	 f_disp_name,
	 f_mandatory_flag,
	 f_description,
	 f_sql
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_UKS 
	(uk_o_schem_name,
	 uk_o_obj_name, 
	 uk_constr_name,
	 uk_disp_name,
	 uk_prim_key_ind, 
	 uk_description)
AS SELECT
	 uk_o_schem_name,
	 uk_o_obj_name, 
	 uk_constr_name,
	 uk_disp_name,
	 uk_prim_key_ind, 
	 uk_description
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_UK_COLS 
	(ukc_uk_schem_name, 
	 ukc_uk_obj_name,
	 ukc_uk_constr_name,
	 ukc_c_col_name,
	 ukc_sequence)
AS SELECT
	 ukc_uk_schem_name, 
	 ukc_uk_obj_name,
	 ukc_uk_constr_name,
	 ukc_c_col_name,
	 ukc_sequence
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_FKS 
	(fk_o_schem_name,
	 fk_o_obj_name,
	 fk_constr_name,
	 fk_one_to_one,
	 fk_ojoin_master, 
	 fk_ojoin_detail,
	 fk_disp_name,
	 fk_description, 
	 fk_rem_schem_name,
	 fk_rem_obj_name,
	 fk_rem_uk_name, 
	 fk_sql_predicate)
AS SELECT
	 fk_o_schem_name,
	 fk_o_obj_name,
	 fk_constr_name,
	 fk_one_to_one,
	 fk_ojoin_master, 
	 fk_ojoin_detail,
	 fk_disp_name,
	 fk_description, 
	 fk_rem_schem_name,
	 fk_rem_obj_name,
	 fk_rem_uk_name, 
	 fk_sql_predicate
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_FK_COLS 
	(fkc_fk_schem_name, 
	 fkc_fk_obj_name, 
	 fkc_fk_constr_name, 
	 fkc_c_col_name, 
	 fkc_sequence)
AS SELECT
	 fkc_fk_schem_name, 
	 fkc_fk_obj_name, 
	 fkc_fk_constr_name, 
	 fkc_c_col_name, 
	 fkc_sequence
FROM dual;

CREATE OR REPLACE VIEW EUL_GW_OBJ_FK_USGS 
	(ofu_o_schem_name, 
	 ofu_o_obj_name,
	 ofu_fk_schem_name,
 	 ofu_fk_obj_name, 
	 ofu_fk_constr_name)
AS SELECT
	 ofu_o_schem_name, 
	 ofu_o_obj_name,
	 ofu_fk_schem_name,
 	 ofu_fk_obj_name, 
	 ofu_fk_constr_name
FROM dual;

-- End