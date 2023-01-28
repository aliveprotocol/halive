DROP TYPE IF EXISTS halive_app.op_type CASCADE;
CREATE TYPE halive_app.op_type AS (
    id BIGINT,
    block_num INT,
    created_at TIMESTAMP,
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
            created_at,
            body
        FROM hive.halive_app_operations_view
        JOIN hive.halive_app_blocks_view ON hive.halive_app_blocks_view.num = block_num
        WHERE block_num >= _first_block AND block_num <= _last_block AND op_type_id=18
        ORDER BY block_num, id;
END
$function$
LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION halive_app.process_stream_update(
    IN _streamer_username VARCHAR,
    IN _stream_link VARCHAR,
    IN _l2_protocol INTEGER,
    IN _l2_pub VARCHAR,
    IN _storage_protocol INTEGER
)
RETURNS void
AS
$function$
DECLARE
    _hive_user_id INTEGER = NULL;
    _streamer_next_stream_id INTEGER = NULL;
    _existing_stream BOOLEAN = FALSE;
BEGIN
    SELECT id INTO _hive_user_id FROM hive.halive_app_accounts_view WHERE name=_streamer_username;
    IF _hive_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not process non-existent streamer %', _streamer_username;
    END IF;

    SELECT next_stream_id INTO _streamer_next_stream_id FROM halive_app.streamer WHERE id=_hive_user_id;
    IF _streamer_next_stream_id IS NULL THEN
        _streamer_next_stream_id = 0
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
            l2_pub = COALESCE(_l2_pub, l2_pub)
        WHERE streamer=_hive_user_id AND link=_stream_link;
    ELSE
        INSERT INTO halive_app.streams(id, streamer, link, l2_protocol, l2_pub, storage_protocol)
            VALUES(_streamer_next_stream_id, _hive_user_id, _stream_link, _l2_protocol, _l2_pub, _storage_protocol);
        UPDATE halive_app.streamer SET next_stream_id=_streamer_next_stream_id+1 WHERE halive_app.streamer.id=_hive_user_id;
    END IF;
END
$function$
LANGUAGE plpgsql VOLATILE;