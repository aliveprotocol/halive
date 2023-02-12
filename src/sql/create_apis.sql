DROP SCHEMA IF EXISTS halive_api CASCADE;
CREATE SCHEMA IF NOT EXISTS halive_api AUTHORIZATION halive_app;
GRANT USAGE ON SCHEMA halive_api TO halive_user;
GRANT USAGE ON SCHEMA halive_app TO halive_user;
GRANT SELECT ON ALL TABLES IN SCHEMA halive_api TO halive_user;
GRANT SELECT ON ALL TABLES IN SCHEMA halive_app TO halive_user;
GRANT SELECT ON TABLE halive_app_accounts IN SCHEMA hive TO halive_user;

-- GET /
CREATE OR REPLACE FUNCTION halive_api.home()
RETURNS jsonb
AS
$function$
DECLARE
    _last_processed_block INTEGER;
    _db_version INTEGER;
BEGIN
    SELECT last_processed_block, db_version INTO _last_processed_block, _db_version FROM halive_app.state;
    RETURN jsonb_build_object(
        'last_processed_block', _last_processed_block,
        'db_version', _db_version
    );
END
$function$
LANGUAGE plpgsql STABLE;

-- GET /rpc/get_stream_info?stream_username=HIVE_USERNAME&stream_link=LINK
CREATE OR REPLACE FUNCTION halive_api.get_stream_info(stream_username VARCHAR, stream_link VARCHAR)
RETURNS jsonb
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
    _exists BOOLEAN = FALSE;
    _st_id INTEGER = NULL;
    _created TIMESTAMP;
    _last_updated TIMESTAMP;
    _first_streamed TIMESTAMP;
    _last_streamed TIMESTAMP;
    _chunk_finalized INTEGER;
    _chunk_head INTEGER;
    _l2_protocol INTEGER;
    _l2_pub VARCHAR;
    _storage_protocol INTEGER;
    _storage_gw VARCHAR;
    _ended BOOLEAN;
BEGIN
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts WHERE name=stream_username;
    IF _hive_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Streamer does not exist');
    END IF;

    SELECT EXISTS INTO _exists (
        SELECT 1
        FROM halive_app.streams st
        WHERE st.streamer=_hive_user_id AND st.link=stream_link);

    IF _exists IS FALSE THEN
        RETURN jsonb_build_object('error', 'Stream does not exist');
    END IF;

    SELECT st_id, created, last_updated, first_streamed, last_streamed, chunk_finalized, chunk_head, l2_protocol, l2_pub, storage_protocol, storage_gw, ended
        INTO _st_id, _created, _last_updated, _first_streamed, _last_streamed, _chunk_finalized, _chunk_head, _l2_protocol, _l2_pub, _storage_protocol, _storage_gw, _ended
        FROM halive_app.streams
        WHERE streamer=_hive_user_id AND link=stream_link;
    
    RETURN jsonb_build_object(
        'id', _st_id,
        'streamer', stream_username,
        'link', stream_link,
        'created', _created,
        'last_updated', _last_updated,
        'first_streamed', _first_streamed,
        'last_streamed', _last_streamed,
        'chunk_finalized', _chunk_finalized,
        'chunk_head', _chunk_head,
        'l2_protocol', (SELECT protocol_name FROM halive_app.l2_protocols WHERE id=_l2_protocol),
        'l2_pub', _l2_pub,
        'storage_protocol', (SELECT protocol_name FROM halive_app.storage_protocols WHERE id=_storage_protocol),
        'storage_gw', _storage_gw,
        'ended', _ended
    );
END
$function$
LANGUAGE plpgsql STABLE;