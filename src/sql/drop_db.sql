ALTER TABLE halive_app.streamer DROP CONSTRAINT IF EXISTS streamer_fk;
ALTER TABLE halive_app.streams DROP CONSTRAINT IF EXISTS streams_streamer_fk;
ALTER TABLE halive_app.streams DROP CONSTRAINT IF EXISTS streams_l2_protocol_fk;
ALTER TABLE halive_app.streams DROP CONSTRAINT IF EXISTS streams_storage_protocol_fk;
ALTER TABLE halive_app.hls_segments DROP CONSTRAINT IF EXISTS hls_segment_stream_id_fk;
SELECT hive.app_state_provider_drop_all('halive_app');
SELECT hive.app_remove_context('halive_app');
DROP SCHEMA IF EXISTS halive_app CASCADE;