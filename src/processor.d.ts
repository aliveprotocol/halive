type ParsedOp = {
    valid: boolean
    op: any
    ts: Date
    streamer: string
    link: string
    seq: number
    src?: string
    len?: number
    storage?: string
    l2?: string
    l2_pub?: string
    gw?: string
}

declare namespace processor {
    const validateAndParse: (op: any) => Promise<ParsedOp>
    const process: (op: any) => Promise<boolean>
}

export = processor