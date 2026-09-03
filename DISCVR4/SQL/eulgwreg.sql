-- This SQL script contains a template EUL Gateway
-- registration script.

insert into EUL4_GATEWAYS
	(gw_id, gw_type, gw_gateway_name, gw_product_name, gw_description, 
 	egw_version, egw_database_link, egw_schema, egw_sql_paradigm, 
  gw_element_state, gw_created_by, gw_created_date, gw_updated_by, 
  gw_updated_date, notm)
values
	(
	EUL4_ID_SEQ.NEXTVAL,
	'EGW',
	'Test Gateway v1.1',
	'Odysseus Testing Enterprises Ltd.',
	'Test Gateway',
	'1.1',
	NULL,
	'EUL_GATEWAY_OWNER',
	'OBJECT',
  0,
  USER,
  SYSDATE,
  USER,
  SYSDATE,
	0
 )

-- End
