declare namespace haliveConfig {
    const postgres_url: string
    const http_host: string
    const http_port: number
    const ipfs_gateway: string
    const alivedb_url: string
    const chunk_fetch_timeout: number
    const log_level: 'warn' | 'info' | 'debug' | 'trace'
}

export = haliveConfig