DROP TYPE IF EXISTS halive_app.op_type CASCADE;
CREATE TYPE halive_app.op_type AS (
    id BIGINT,
    block_num INT,
    body TEXT
);

CREATE OR REPLACE FUNCTION halive_app.enum_op(IN _first_block INT, IN _last_block INT)
RETURNS SETOF halive_app.op_type
AS
$function$
BEGIN
    -- We only require custom_jsons (op type 18)
    RETURN QUERY
        SELECT
            id,
            block_num,
            body::TEXT
        FROM hive.halive_app_operations_view
        WHERE block_num >= _first_block AND block_num <= _last_block AND op_type_id=18
        ORDER BY block_num, id;
END
$function$
LANGUAGE plpgsql STABLE;

DROP TYPE IF EXISTS halive_app.block_type CASCADE;
CREATE TYPE halive_app.block_type AS (
    num INTEGER,
    created_at TIMESTAMP
);

CREATE OR REPLACE FUNCTION halive_app.enum_block(IN _first_block INT, IN _last_block INT)
RETURNS SETOF halive_app.block_type
AS
$function$
BEGIN
    -- Fetch block headers
    RETURN QUERY
        SELECT
            num,
            created_at
        FROM hive.halive_app_blocks_view
        WHERE num >= _first_block AND num <= _last_block
        ORDER BY num;
END
$function$
LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION halive_app.process_stream_push(
    _streamer_username VARCHAR,
    _stream_link VARCHAR,
    _sequence INTEGER,
    _length NUMERIC,
    _src_hash VARCHAR,
    _ts TIMESTAMP
)
RETURNS void
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
    _stream_id INTEGER = NULL;
    _chunk_head INTEGER = NULL;
    _chunk_finalized INTEGER = NULL;
    _ended BOOLEAN = FALSE;
BEGIN
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts WHERE name=_streamer_username;
    IF _hive_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not process non-existent streamer %', _streamer_username;
    END IF;

    SELECT id, chunk_finalized, chunk_head, ended
        INTO _stream_id, _chunk_finalized, _chunk_head, _ended
        FROM halive_app.streams
        WHERE streamer=_hive_user_id AND link=_stream_link;
    IF _ended IS TRUE THEN
        RAISE EXCEPTION 'Could not push stream to ended livestream %/%', _streamer_username, _stream_link;
    ELSIF _chunk_finalized IS NOT NULL AND _sequence <= _chunk_finalized THEN
        RAISE EXCEPTION 'Could not overwrite past stream chunks that are finalized';
    ELSIF _ended IS TRUE THEN
        RAISE EXCEPTION 'Cannot push new stream chunks to an ended stream';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM halive_app.hls_segments WHERE stream_id=_stream_id AND seq=_sequence) THEN
        INSERT INTO halive_app.hls_segments(stream_id, seq, len, src_hash)
            VALUES(_stream_id, _sequence, _length, _src_hash);
    ELSE
        UPDATE halive_app.hls_segments SET len=_length, src_hash=_src_hash WHERE stream_id=_stream_id AND seq=_sequence;
    END IF;

    IF _chunk_finalized IS NULL THEN
        UPDATE halive_app.streams SET chunk_head=_sequence, chunk_finalized=_sequence, first_streamed=_ts WHERE id=_stream_id;
    ELSIF _chunk_finalized = _chunk_head THEN
        IF _sequence = _chunk_finalized+1 THEN
            UPDATE halive_app.streams SET chunk_finalized=_chunk_finalized+1, chunk_head=_chunk_head+1 WHERE id=_stream_id;
        ELSIF _sequence > _chunk_finalized+1 THEN
            UPDATE halive_app.streams SET chunk_head=_sequence WHERE id=_stream_id;
        END IF;
    ELSIF _sequence > _chunk_head THEN
        UPDATE halive_app.streams SET chunk_head=_sequence WHERE id=_stream_id;
    ELSIF _sequence > _chunk_finalized AND _sequence <= _chunk_head THEN
        FOR __seq IN (_chunk_finalized+1).._chunk_head LOOP
            IF EXISTS (SELECT 1 FROM halive_app.hls_segments WHERE stream_id=_stream_id AND seq=__seq) THEN
                _chunk_finalized = _chunk_finalized+1;
            ELSE
                EXIT;
            END IF;
        END LOOP;
        UPDATE halive_app.streams SET chunk_finalized=_chunk_finalized WHERE id=_stream_id;
    END IF;
    UPDATE halive_app.streams SET last_streamed=_ts WHERE id=_stream_id;
END
$function$
LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION halive_app.process_stream_end(
    _streamer_username VARCHAR,
    _stream_link VARCHAR,
    _ts TIMESTAMP
)
RETURNS void
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
BEGIN
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts WHERE name=_streamer_username;
    IF _hive_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not process non-existent streamer %', _streamer_username;
    END IF;

    IF EXISTS (SELECT 1 FROM halive_app.streams WHERE streamer=_hive_user_id AND link=_stream_link) THEN
        UPDATE halive_app.streams SET ended=TRUE, last_updated=_ts WHERE streamer=_hive_user_id AND link=_stream_link;
    END IF;
END
$function$
LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION halive_app.process_stream_update(
    IN _streamer_username VARCHAR,
    IN _stream_link VARCHAR,
    IN _l2_protocol INTEGER,
    IN _l2_pub VARCHAR,
    IN _storage_protocol INTEGER,
    IN _storage_gw VARCHAR,
    IN _ts TIMESTAMP
)
RETURNS void
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
    _streamer_next_stream_id INTEGER = NULL;
    _existing_stream BOOLEAN = FALSE;
BEGIN
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts WHERE name=_streamer_username;
    IF _hive_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not process non-existent streamer %', _streamer_username;
    END IF;

    SELECT next_stream_id INTO _streamer_next_stream_id FROM halive_app.streamer WHERE id=_hive_user_id;
    IF _streamer_next_stream_id IS NULL THEN
        _streamer_next_stream_id = 0;
    END IF;
    IF _streamer_next_stream_id = 0 THEN
        INSERT INTO halive_app.streamer(id, next_stream_id) VALUES(_hive_user_id, 0);
    ELSE
        SELECT EXISTS INTO _existing_stream (
            SELECT 1
            FROM halive_app.streams st
            WHERE st.streamer=_hive_user_id AND st.link=_stream_link);
    END IF;

    -- If stream exists, allow use of same operation to update l2_protocol and l2_pub
    IF _existing_stream IS TRUE THEN
        UPDATE halive_app.streams SET
            l2_protocol = COALESCE(_l2_protocol, l2_protocol),
            l2_pub = COALESCE(_l2_pub, l2_pub),
            storage_gw = COALESCE(_storage_gw, storage_gw),
            last_updated = _ts
        WHERE streamer=_hive_user_id AND link=_stream_link;
    ELSE
        INSERT INTO halive_app.streams(st_id, streamer, link, created, last_updated, l2_protocol, l2_pub, storage_protocol)
            VALUES(_streamer_next_stream_id, _hive_user_id, _stream_link, _ts, _ts, _l2_protocol, _l2_pub, _storage_protocol);
        UPDATE halive_app.streamer SET next_stream_id=_streamer_next_stream_id+1 WHERE halive_app.streamer.id=_hive_user_id;
    END IF;
END
$function$
LANGUAGE plpgsql VOLATILE;

-- Get cached chunk contents
CREATE OR REPLACE FUNCTION halive_app.cached_chunk_contents(_file_hash VARCHAR, _storage_protocol INTEGER)
RETURNS VARCHAR
AS
$function$
DECLARE
    _result VARCHAR = '';
BEGIN
    SELECT body INTO _result
    FROM halive_app.hls_chunk_contents
    WHERE file_hash=_file_hash AND storage_protocol=_storage_protocol;

    RETURN _result;
END
$function$
LANGUAGE plpgsql STABLE;

-- Cache chunk
CREATE OR REPLACE FUNCTION halive_app.cache_chunk(_file_hash VARCHAR, _storage_protocol INTEGER, _contents VARCHAR)
RETURNS void
AS
$function$
BEGIN
    INSERT INTO halive_app.hls_chunk_contents(file_hash, storage_protocol, body)
    VALUES(_file_hash, _storage_protocol, _contents)
    ON CONFLICT (file_hash) DO UPDATE
    SET body=_contents;
END
$function$
LANGUAGE plpgsql VOLATILE;