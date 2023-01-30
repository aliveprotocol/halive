SELECT hive.app_state_provider_drop_all('halive_app');
SELECT hive.app_remove_context('halive_app');
DROP SCHEMA IF EXISTS halive_app CASCADE;