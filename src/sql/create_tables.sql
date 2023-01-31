CREATE TABLE IF NOT EXISTS halive_app.l2_protocols(
    id SERIAL PRIMARY KEY,
    protocol_name VARCHAR(25) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS halive_app.storage_protocols(
    id SERIAL PRIMARY KEY,
    protocol_name VARCHAR(25) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS halive_app.hls_chunk_contents(
    file_hash VARCHAR(64) PRIMARY KEY,
    storage_protocol INTEGER REFERENCES halive_app.storage_protocols(id) NOT NULL,
    body VARCHAR(4200) NOT NULL
);

CREATE TABLE IF NOT EXISTS halive_app.streamer(
    hive_rowid BIGINT NOT NULL DEFAULT nextval('hive.halive_app_hive_rowid_seq'),
    id INTEGER PRIMARY KEY,
    next_stream_id INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS halive_app.streams(
    hive_rowid BIGINT NOT NULL DEFAULT nextval('hive.halive_app_hive_rowid_seq'),
    id INTEGER PRIMARY KEY,
    streamer INTEGER NOT NULL,
    link VARCHAR(50) NOT NULL,
    created TIMESTAMP NOT NULL,
    last_updated TIMESTAMP NOT NULL,
    first_streamed TIMESTAMP,
    last_streamed TIMESTAMP,
    chunk_finalized INTEGER,
    chunk_head INTEGER,
    l2_protocol INTEGER,
    l2_pub VARCHAR(100),
    storage_protocol INTEGER NOT NULL,
    storage_gw VARCHAR(100),
    ended BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT streams_streamer_link_unique UNIQUE(streamer, link)
);

CREATE TABLE IF NOT EXISTS halive_app.hls_segments(
    hive_rowid BIGINT NOT NULL DEFAULT nextval('hive.halive_app_hive_rowid_seq'),
    id SERIAL PRIMARY KEY,
    stream_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    len NUMERIC(8,6),
    src_hash VARCHAR(64),
    CONSTRAINT hls_sgmt_stream_id_seq_unique UNIQUE(stream_id, seq)
);

CREATE TABLE IF NOT EXISTS halive_app.state(
    id SERIAL PRIMARY KEY,
    last_processed_block INTEGER NOT NULL DEFAULT 0,
    db_version INTEGER NOT NULL DEFAULT 1
);