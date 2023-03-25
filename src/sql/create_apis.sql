DROP SCHEMA IF EXISTS halive_api CASCADE;
CREATE SCHEMA IF NOT EXISTS halive_api AUTHORIZATION halive_app;
GRANT USAGE ON SCHEMA halive_api TO halive_user;
GRANT USAGE ON SCHEMA halive_app TO halive_user;
GRANT SELECT ON ALL TABLES IN SCHEMA halive_api TO halive_user;
GRANT SELECT ON ALL TABLES IN SCHEMA halive_app TO halive_user;
GRANT SELECT ON TABLE hive.halive_app_accounts TO halive_user;

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

-- GET /rpc/get_stream_info?stream_author=HIVE_USERNAME&stream_link=STREAM_LINK
CREATE OR REPLACE FUNCTION halive_api.get_stream_info(stream_author VARCHAR, stream_link VARCHAR)
RETURNS jsonb
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
    _exists BOOLEAN = FALSE;
    _st_id_glob INTEGER = NULL;
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
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts WHERE name=stream_author;
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

    SELECT id, st_id, created, last_updated, first_streamed, last_streamed, chunk_finalized, chunk_head, l2_protocol, l2_pub, storage_protocol, storage_gw, ended
        INTO _st_id_glob, _st_id, _created, _last_updated, _first_streamed, _last_streamed, _chunk_finalized, _chunk_head, _l2_protocol, _l2_pub, _storage_protocol, _storage_gw, _ended
        FROM halive_app.streams
        WHERE streamer=_hive_user_id AND link=stream_link;
    
    RETURN jsonb_build_object(
        'id', _st_id_glob,
        'st_id', _st_id,
        'streamer', stream_author,
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

DROP TYPE IF EXISTS halive_api.hls_segments_type CASCADE;
CREATE TYPE halive_api.hls_segments_type AS (
    seq INTEGER,
    len NUMERIC,
    src_hash VARCHAR
);
CREATE OR REPLACE FUNCTION halive_api.get_hls_segments(_stream_id INTEGER)
RETURNS SETOF halive_api.hls_segments_type
AS
$function$
BEGIN
    RETURN QUERY
        SELECT seq, len, src_hash
        FROM halive_app.hls_segments
        WHERE stream_id=_stream_id
        ORDER BY seq;
END
$function$
LANGUAGE plpgsql STABLE;

-- GET /rpc/get_stream_chunks?stream_author=HIVE_USERNAME&stream_link=STREAM_LINK
CREATE OR REPLACE FUNCTION halive_api.get_stream_chunks(stream_author VARCHAR, stream_link VARCHAR)
RETURNS jsonb
AS
$function$
DECLARE
    c record;
    stream_id INTEGER;
    stream_info jsonb;
    chunks_arr jsonb[] DEFAULT '{}';
BEGIN
    SELECT halive_api.get_stream_info(stream_author, stream_link) INTO stream_info;
    IF stream_info ? 'error' THEN
        RETURN stream_info;
    END IF;
    stream_id := stream_info->'id';
    FOR c IN SELECT * FROM halive_api.get_hls_segments(stream_id) LOOP
        SELECT ARRAY_APPEND(chunks_arr, jsonb_build_object(
            'seq', c.seq,
            'len', c.len,
            'src_hash', c.src_hash
        )) INTO chunks_arr;
    END LOOP;

    RETURN jsonb_build_object(
        'id', stream_info->'id',
        'chunks', chunks_arr
    );
END
$function$
LANGUAGE plpgsql STABLE;