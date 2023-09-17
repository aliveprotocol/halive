import type express from 'express'

export interface StreamRequestTypes extends express.Request {
    query: {
        quality?: string
        gw?: string
        fetchtimeout?: string
        l1only?: string
    }
}