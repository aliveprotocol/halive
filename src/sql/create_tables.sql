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
    chunk_finalized INTEGER,
    chunk_head INTEGER,
    l2_protocol INTEGER,
    l2_pub VARCHAR(100),
    storage_protocol INTEGER NOT NULL,
    ended BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(streamer, link)
);

CREATE TABLE IF NOT EXISTS halive_app.hls_segments(
    hive_rowid BIGINT NOT NULL DEFAULT nextval('hive.halive_app_hive_rowid_seq'),
    id SERIAL PRIMARY KEY,
    stream_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    src_hash VARCHAR(64),
    UNIQUE(stream_id,seq)
);

CREATE TABLE IF NOT EXISTS halive_app.state(
    id SERIAL PRIMARY KEY,
    last_processed_block INTEGER NOT NULL DEFAULT 0,
    db_version INTEGER NOT NULL DEFAULT 1
);