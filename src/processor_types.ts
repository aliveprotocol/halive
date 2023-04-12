export type ParsedOp = {
    valid: boolean
    op?: number
    ts?: Date
    streamer?: string
    link?: string
    seq?: number
    src?: string
    len?: number
    storage?: number
    l2?: number | null
    l2_pub?: string
    gw?: string

    // optional qualities
    [res: number]: string
}